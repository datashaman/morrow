import { MotivationCitizenPolicy } from "./citizen-policy.ts";
import artifact from "./policy-artifacts/shared-policy-weights.v1.json" with { type: "json" };
import {
  GatedNeuralCitizenPolicy,
  loadSharedNeuralWeightArtifact,
  SharedNeuralPolicy,
  type NeuralActivationGate,
} from "./neural-policy.ts";

const loadedArtifact = loadSharedNeuralWeightArtifact(artifact);

export const BUNDLED_NEURAL_ARTIFACT = loadedArtifact.artifact;
export const BUNDLED_NEURAL_WEIGHTS = loadedArtifact.weights;

export const BUNDLED_NEURAL_ACTIVATION_GATE: NeuralActivationGate = Object.freeze({
  format: "morrow-neural-activation-gate",
  version: 1,
  passed: true,
  domain: "personal-time",
  neuralSchemaVersion: 2,
  weightsVersion: "python-reward-weighted-active-policy-imitation-v1-390ffbfc893def94-schema2-zero-knowledge",
  baselinePolicy: "motivation-v3",
  candidatePolicy: "motivation-v3+gated-neural-personal-time-schema-2",
  evidence: Object.freeze({
    seeds: Object.freeze([101, 202, 303, 404, 505]),
    days: 30,
    checks: Object.freeze({
      zeroFailures: true,
      zeroIllegalAppliedActions: true,
      cashConserved: true,
      stableReplay: true,
      controlledPersonalTimeOnly: true,
      boundedOutcomes: true,
    }),
    outcomeBounds: Object.freeze({
      survivalRate: Object.freeze({ delta: 0, maximumAbsoluteDelta: 0.05, passed: true }),
      employmentRate: Object.freeze({ delta: 0, maximumAbsoluteDelta: 0.05, passed: true }),
      hungry: Object.freeze({ delta: 0, maximumAbsoluteDelta: 2, passed: true }),
      unhoused: Object.freeze({ delta: 0, maximumAbsoluteDelta: 2, passed: true }),
      insolventFirms: Object.freeze({ delta: 0, maximumAbsoluteDelta: 1, passed: true }),
    }),
    reportSchemaVersion: 2,
    notice: "Technical replay and hypothesis bounds for a personal-time-only tracer bullet; not evidence of realism, fairness, or empirical safety.",
  }),
});

export function createDefaultCitizenPolicy(enabled = false) {
  return new GatedNeuralCitizenPolicy(
    new MotivationCitizenPolicy(),
    new SharedNeuralPolicy(BUNDLED_NEURAL_WEIGHTS),
    BUNDLED_NEURAL_ACTIVATION_GATE,
    enabled,
  );
}
