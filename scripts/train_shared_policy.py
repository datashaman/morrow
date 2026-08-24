#!/usr/bin/env python3
"""Optional standard-library trainer for Morrow's shared pair-scoring MLP."""

import argparse
import hashlib
import json
import math
import platform
import random
from pathlib import Path


ARTIFACT_FORMAT = "morrow-shared-policy-weights"
ARTIFACT_FORMAT_VERSION = 1
SUPPORTED_TRAJECTORY_SCHEMAS = {1, 2}
SUPPORTED_NEURAL_SCHEMA = 1
OBJECTIVE = "reward-weighted-active-policy-imitation-v1"


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Versioned Morrow trajectory JSON")
    parser.add_argument("--output", required=True, help="Output weight artifact JSON")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--learning-rate", type=float, default=0.01)
    parser.add_argument("--hidden-size", type=int, default=12)
    parser.add_argument("--training-seed", type=int, default=3001)
    parser.add_argument("--reward-scale", type=float, default=0.25)
    return parser.parse_args()


def validate_dataset(dataset):
    metadata = dataset.get("metadata", {})
    if metadata.get("format") != "morrow-policy-trajectories" or metadata.get("schemaVersion") not in SUPPORTED_TRAJECTORY_SCHEMAS:
        raise ValueError("unsupported trajectory schema")
    if metadata.get("neuralSchemaVersion") != SUPPORTED_NEURAL_SCHEMA:
        raise ValueError("neural schema mismatch")
    observation_width = metadata.get("observationWidth")
    action_width = metadata.get("actionWidth")
    if not isinstance(observation_width, int) or not isinstance(action_width, int):
        raise ValueError("missing vector widths")
    samples = dataset.get("samples")
    if not isinstance(samples, list) or not samples:
        raise ValueError("trajectory dataset has no samples")
    for sample in samples:
        if len(sample.get("observation", [])) != observation_width:
            raise ValueError("observation width mismatch")
        legal = sample.get("legalActions", [])
        if not legal or any(len(candidate.get("vector", [])) != action_width for candidate in legal):
            raise ValueError("legal action vector mismatch")
        if sample.get("chosenAction") not in [candidate.get("action") for candidate in legal]:
            raise ValueError("chosen action is not legal in exported dataset")
        if sample.get("reward", {}).get("version") != metadata.get("rewardHypothesisVersion"):
            raise ValueError("reward hypothesis version mismatch")
    return metadata, samples, observation_width, action_width


def initialize_weights(input_size, hidden_size, seed):
    rng = random.Random(seed)
    input_scale = 0.8 / math.sqrt(input_size)
    uniform = lambda scale: (rng.random() * 2.0 - 1.0) * scale
    return {
        "hiddenWeights": [[uniform(input_scale) for _ in range(input_size)] for _ in range(hidden_size)],
        "hiddenBias": [uniform(0.08) for _ in range(hidden_size)],
        "outputWeights": [uniform(0.35) for _ in range(hidden_size)],
        "outputBias": uniform(0.05),
    }


def forward(weights, inputs):
    hidden = [
        math.tanh(sum(weight * value for weight, value in zip(row, inputs)) + weights["hiddenBias"][index])
        for index, row in enumerate(weights["hiddenWeights"])
    ]
    score = sum(weight * value for weight, value in zip(weights["outputWeights"], hidden)) + weights["outputBias"]
    return hidden, score


def train_sample(weights, sample, learning_rate, reward_scale):
    candidates = sample["legalActions"]
    inputs = [sample["observation"] + candidate["vector"] for candidate in candidates]
    forwards = [forward(weights, values) for values in inputs]
    logits = [result[1] for result in forwards]
    maximum = max(logits)
    exponentials = [math.exp(value - maximum) for value in logits]
    total = sum(exponentials)
    probabilities = [value / total for value in exponentials]
    target = next(index for index, candidate in enumerate(candidates) if candidate["action"] == sample["chosenAction"])
    reward_weight = max(0.1, 1.0 + float(sample["reward"]["total"]) * reward_scale)
    derivatives = [(probability - float(index == target)) * reward_weight for index, probability in enumerate(probabilities)]
    hidden_size = len(weights["hiddenBias"])
    input_size = len(inputs[0])
    grad_hidden_weights = [[0.0] * input_size for _ in range(hidden_size)]
    grad_hidden_bias = [0.0] * hidden_size
    grad_output_weights = [0.0] * hidden_size
    grad_output_bias = sum(derivatives)
    for derivative, values, (hidden, _) in zip(derivatives, inputs, forwards):
        for hidden_index in range(hidden_size):
            grad_output_weights[hidden_index] += derivative * hidden[hidden_index]
            hidden_derivative = derivative * weights["outputWeights"][hidden_index] * (1.0 - hidden[hidden_index] ** 2)
            grad_hidden_bias[hidden_index] += hidden_derivative
            for input_index in range(input_size):
                grad_hidden_weights[hidden_index][input_index] += hidden_derivative * values[input_index]
    for hidden_index in range(hidden_size):
        weights["outputWeights"][hidden_index] -= learning_rate * grad_output_weights[hidden_index]
        weights["hiddenBias"][hidden_index] -= learning_rate * grad_hidden_bias[hidden_index]
        for input_index in range(input_size):
            weights["hiddenWeights"][hidden_index][input_index] -= learning_rate * grad_hidden_weights[hidden_index][input_index]
    weights["outputBias"] -= learning_rate * grad_output_bias
    return -math.log(max(1e-12, probabilities[target])) * reward_weight


def main():
    args = parse_args()
    if args.epochs < 1 or args.hidden_size < 1 or args.learning_rate <= 0:
        raise ValueError("epochs, hidden size, and learning rate must be positive")
    dataset = json.loads(Path(args.input).read_text(encoding="utf-8"))
    metadata, samples, observation_width, action_width = validate_dataset(dataset)
    input_size = observation_width + action_width
    weights = initialize_weights(input_size, args.hidden_size, args.training_seed)
    epoch_losses = []
    for _ in range(args.epochs):
        loss = sum(train_sample(weights, sample, args.learning_rate, args.reward_scale) for sample in samples) / len(samples)
        epoch_losses.append(loss)
    canonical_weights = json.dumps(weights, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical_weights.encode("utf-8")).hexdigest()[:16]
    golden_vectors = []
    for sample in samples[:3]:
        candidate = next(item for item in sample["legalActions"] if item["action"] == sample["chosenAction"])
        expected_score = forward(weights, sample["observation"] + candidate["vector"])[1]
        golden_vectors.append({
            "observation": sample["observation"],
            "action": candidate["vector"],
            "expectedScore": expected_score,
        })
    artifact = {
        "format": ARTIFACT_FORMAT,
        "formatVersion": ARTIFACT_FORMAT_VERSION,
        "neuralSchemaVersion": metadata["neuralSchemaVersion"],
        "weightsVersion": f"python-{OBJECTIVE}-{digest}",
        "architecture": {"type": "pair-mlp", "activation": "tanh", "inputSize": input_size, "hiddenSize": args.hidden_size},
        "actionKinds": metadata["actionKinds"],
        "training": {
            "script": "scripts/train_shared_policy.py",
            "pythonVersion": platform.python_version(),
            "objective": OBJECTIVE,
            "objectiveNotice": "Hypothetical reward-weighted imitation of the active policy; not an empirical welfare objective.",
            "trajectorySchemaVersion": metadata["schemaVersion"],
            "rewardHypothesisVersion": metadata["rewardHypothesisVersion"],
            "datasetSeeds": metadata["seeds"],
            "datasetDays": metadata["days"],
            "samples": len(samples),
            "epochs": args.epochs,
            "learningRate": args.learning_rate,
            "hiddenSize": args.hidden_size,
            "trainingSeed": args.training_seed,
            "rewardScale": args.reward_scale,
            "epochLosses": epoch_losses,
        },
        "weights": weights,
        "goldenVectors": golden_vectors,
    }
    Path(args.output).write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {artifact['weightsVersion']} with {len(samples)} samples to {args.output}")


if __name__ == "__main__":
    main()
