# Optional offline training and weight exchange

Morrow's runtime remains TypeScript-only. Python is an optional offline development tool for training the shared pair-scoring network; the browser never starts, contacts, or depends on a Python service.

## Reproducible workflow

Export synthetic trajectories:

```sh
npm run export:trajectories -- --seeds 101,202,303 --days 90 --output morrow-trajectories.json
```

Train with Python's standard library:

```sh
python3 scripts/train_shared_policy.py \
  --input morrow-trajectories.json \
  --output morrow-weights.json \
  --epochs 3 \
  --learning-rate 0.01 \
  --hidden-size 12 \
  --training-seed 3001 \
  --reward-scale 0.25
```

Neither generated file is required to run Morrow. Keep experimental large datasets and weights outside Git unless they are an intentional small fixture.

## Trajectory schema v1

`morrow-policy-trajectories` contains only synthetic simulation state. Names, ledgers, events, relationships, browser state, and external or personal data are excluded. Metadata records simulation/schema versions, seeds, days, active policy IDs, exact feature names and widths, action kinds, and the reward-hypothesis version.

Each sample contains:

- seed, simulated day, phase, and per-agent decision sequence;
- encoded observation and decision kind;
- every concrete legal action with kind and encoded action vector;
- the complete action-kind legal mask;
- the active policy's chosen legal action;
- a versioned hypothetical reward total and named components.

The dataset does not export illegal concrete actions. The trainer verifies that the target action occurs in the exported legal set and cannot add, unlock, or relabel an action.

## Reward hypothesis v1

`narrative-proxy-v1` assigns small immediate proxies for food/housing fulfillment, work participation, and owner-option continuity, worker protection, and personal safety. The default training objective is `reward-weighted-active-policy-imitation-v1`: imitate the active policy over its legal alternatives, with the proxy reward only scaling sample weight.

These values are explicit gameplay hypotheses. They are not welfare, utility, health, fairness, productivity, or policy measurements. Changing a component or value requires a new reward-hypothesis version. A trained model cannot redefine the legal-action generator or mask.

## Weight artifact v1

`morrow-shared-policy-weights` JSON records:

- format, neural schema, action-kind order, and weights versions;
- pair-MLP architecture, input width, hidden width, and `tanh` activation;
- finite hidden/output matrices and biases;
- training script, Python version, objective and notice, dataset seeds/days, trajectory/reward versions, sample count, hyperparameters, and epoch losses;
- golden encoded observation/action vectors with expected scores.

`loadSharedNeuralWeightArtifact()` rejects unknown formats, neural-schema or action-order mismatches, unsupported architectures, wrong matrix/vector shapes, missing golden vectors, and non-finite values before constructing runtime weights.

## Cross-runtime golden test

[`test/fixtures/python-exported-weights.json`](../test/fixtures/python-exported-weights.json) is a deliberately tiny artifact produced by the Python script. Node tests load it through the TypeScript validator and reproduce Python's expected score to within `1e-12`. This protects feature order, shape, activation, bias, and matrix-orientation compatibility.

Loading compatible weights still does not authorize neural control. Imported weights remain usable only by the shadow policy until the separate activation-gate roadmap slice is satisfied.
