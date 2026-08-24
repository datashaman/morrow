import { MotivationCitizenPolicy } from "./citizen-policy.ts";
import {
  GatedNeuralCitizenPolicy,
  NEURAL_SCHEMA_VERSION,
  SharedNeuralPolicy,
  type NeuralActivationGate,
  type SharedNeuralWeights,
} from "./neural-policy.ts";
import { evaluatePolicies } from "./policy-evaluation.ts";

export const ACTIVATION_GATE_SCHEMA_VERSION = 1;

export const DEFAULT_ACTIVATION_BOUNDS = Object.freeze({
  survivalRate: 0.05,
  employmentRate: 0.05,
  hungry: 2,
  unhoused: 2,
  insolventFirms: 1,
});

function candidateFactory(weights: SharedNeuralWeights) {
  return () => {
    const fallback = new MotivationCitizenPolicy();
    const gate: NeuralActivationGate = {
      format: "morrow-neural-activation-gate",
      version: ACTIVATION_GATE_SCHEMA_VERSION,
      passed: true,
      domain: "personal-time",
      neuralSchemaVersion: NEURAL_SCHEMA_VERSION,
      weightsVersion: weights.version,
      baselinePolicy: fallback.id,
      candidatePolicy: `motivation-v3+gated-neural-personal-time-schema-${NEURAL_SCHEMA_VERSION}`,
      evidence: {
        purpose: "headless-candidate-evaluation",
        checks: {
          zeroFailures: true,
          zeroIllegalAppliedActions: true,
          cashConserved: true,
          stableReplay: true,
          controlledPersonalTimeOnly: true,
          boundedOutcomes: true,
        },
        outcomeBounds: { evaluationBootstrap: { passed: true } },
      },
    };
    return new GatedNeuralCitizenPolicy(fallback, new SharedNeuralPolicy(weights), gate, true);
  };
}

export function evaluatePersonalTimeActivationGate({
  weights,
  seeds,
  days,
  bounds = DEFAULT_ACTIVATION_BOUNDS,
}: {
  weights: SharedNeuralWeights;
  seeds: readonly number[];
  days: number;
  bounds?: Readonly<Record<keyof typeof DEFAULT_ACTIVATION_BOUNDS, number>>;
}) {
  const config = {
    seeds,
    days,
    baseline: "motivation",
    policies: ["neural-personal-time"],
    policyFactories: {
      motivation: () => new MotivationCitizenPolicy(),
      "neural-personal-time": candidateFactory(weights),
    },
  } as const;
  const first = evaluatePolicies(config);
  const replay = evaluatePolicies(config);
  const stableReplay = JSON.stringify(first) === JSON.stringify(replay);
  const runs = first.runs.map(({ result }) => result);
  const candidateRuns = first.runs.filter(({ name }) => name === "neural-personal-time").map(({ result }) => result);
  const zeroFailures = first.status === "passed" && runs.every((run) => run.status === "passed");
  const zeroIllegalAppliedActions = runs.every((run) => run.invalidActions === 0);
  const cashConserved = runs.every((run) => run.cash.conserved && run.cash.difference === 0);
  const controlledPersonalTimeOnly = candidateRuns.every((run) => run.control.neuralDecisions > 0 && run.control.neuralOutsidePersonalTime === 0);
  const deltas = first.comparisons["neural-personal-time"].deltas;
  const outcomeBounds = Object.fromEntries(Object.entries(bounds).map(([metric, maximum]) => {
    const delta = deltas[metric as keyof typeof deltas];
    return [metric, { delta, maximumAbsoluteDelta: maximum, passed: Math.abs(delta) <= maximum }];
  }));
  const boundedOutcomes = Object.values(outcomeBounds).every((result) => result.passed);
  const checks = { zeroFailures, zeroIllegalAppliedActions, cashConserved, stableReplay, controlledPersonalTimeOnly, boundedOutcomes };
  const passed = Object.values(checks).every(Boolean);
  const candidatePolicy = candidateFactory(weights)();
  const gate: NeuralActivationGate = Object.freeze({
    format: "morrow-neural-activation-gate",
    version: ACTIVATION_GATE_SCHEMA_VERSION,
    passed,
    domain: "personal-time",
    neuralSchemaVersion: NEURAL_SCHEMA_VERSION,
    weightsVersion: weights.version,
    baselinePolicy: "motivation-v3",
    candidatePolicy: candidatePolicy.id,
    evidence: Object.freeze({
      seeds: [...seeds],
      days,
      checks,
      outcomeBounds,
      reportSchemaVersion: first.metadata.schemaVersion,
      notice: "Technical replay and hypothesis bounds for a personal-time-only tracer bullet; not evidence of realism, fairness, or empirical safety.",
    }),
  });
  return { gate, report: first, replay } as const;
}
