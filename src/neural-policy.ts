import { createRandom } from "./random.js";
import type {
  CitizenAction,
  CitizenObservation,
  CitizenPolicy,
  CitizenPolicyDecision,
  CitizenPolicyInput,
  MotivationProfile,
} from "./citizen-policy.ts";

export const NEURAL_SCHEMA_VERSION = 1;
export const NEURAL_WEIGHTS_VERSION = "shared-mlp-seed-2901-h12-v1";

export const ACTION_KINDS = [
  "accept-job-offer", "decline-job-offer", "attend-shift", "miss-shift", "skip-job-search", "apply-job",
  "do-nothing", "buy-comfort", "social-visit", "buy-learning-tools", "skip-food", "eat-stored-food", "buy-food",
  "defer-housing", "remain-unhoused", "pay-housing", "secure-housing", "draw-owner-wage", "waive-owner-wage",
  "contribute-owner-capital", "wait-on-owner-financing", "choose-voluntary-insolvency", "hold-owner-price",
  "lower-owner-price", "raise-owner-price", "retain-owner-cash", "take-owner-distribution",
] as const;

export type ActionKind = (typeof ACTION_KINDS)[number];

const OBSERVATION_KINDS = ["job-offer", "job-search", "attendance", "personal-time", "food", "housing", "owner"] as const;
const PROFILE_FEATURES: (keyof MotivationProfile)[] = ["comfort", "connection", "mastery", "security", "foodQuality", "planning", "avoidance"];
const ACTION_NUMERIC_FEATURES = [
  "amount", "resultingPrice", "totalPrice", "unitPrice", "units", "effectiveQuality", "age", "capacityAvailable",
  "offeredWage", "reservationWage", "personalSafety", "firmContinuity", "workerProtection", "growth", "extraction", "exitRelief",
] as const;

export const NEURAL_OBSERVATION_SCHEMA = Object.freeze({
  version: NEURAL_SCHEMA_VERSION,
  features: Object.freeze([
    "bias", ...OBSERVATION_KINDS.map((kind) => `kind:${kind}`), ...PROFILE_FEATURES.map((name) => `profile:${name}`),
    "stress", "health", "hungryDays", "runwayDays", "reliability", "safetyNeed", "firmTrouble", "optionCount", "firmRunwayDays", "ownerRunwayDays",
  ]),
});

export const NEURAL_ACTION_SCHEMA = Object.freeze({
  version: NEURAL_SCHEMA_VERSION,
  kinds: ACTION_KINDS,
  numericFeatures: ACTION_NUMERIC_FEATURES,
});

const clamp01 = (value: unknown) => Math.max(0, Math.min(1, Number(value) || 0));

export function actionKind(action: string): ActionKind {
  const dynamic = ["apply-job", "eat-stored-food", "buy-food", "pay-housing", "secure-housing"]
    .find((prefix) => action.startsWith(`${prefix}:`));
  const kind = (dynamic ?? action) as ActionKind;
  if (!ACTION_KINDS.includes(kind)) throw new Error(`Unknown neural action kind: ${action}`);
  return kind;
}

export function encodeNeuralObservation(observation: CitizenObservation) {
  const source = observation as any;
  const profile = (source.profile ?? {}) as Partial<MotivationProfile>;
  const options = Array.isArray(source.options) ? source.options : [];
  return [
    1,
    ...OBSERVATION_KINDS.map((kind) => Number(observation.kind === kind)),
    ...PROFILE_FEATURES.map((name) => clamp01((profile[name] ?? 1) / 1.3)),
    clamp01(source.stress),
    clamp01(source.health),
    clamp01(source.hungryDays / 3),
    clamp01((source.runwayDays ?? source.ownerRunwayDays) / 20),
    clamp01(source.reliability),
    clamp01(source.safetyNeed ?? source.needs?.safety),
    clamp01(source.firmTrouble / 4),
    clamp01(options.length / 8),
    clamp01(source.firmRunwayDays / 10),
    clamp01(source.ownerRunwayDays / 20),
  ];
}

function optionForAction(observation: CitizenObservation, action: string) {
  const options = (observation as any).options;
  return Array.isArray(options) ? options.find((option) => option.action === action) : undefined;
}

export function encodeNeuralAction(observation: CitizenObservation, action: string) {
  const kind = actionKind(action);
  const option = optionForAction(observation, action) ?? {};
  const source = { ...(observation as any), ...option };
  const scales: Record<(typeof ACTION_NUMERIC_FEATURES)[number], number> = {
    amount: 300, resultingPrice: 20, totalPrice: 50, unitPrice: 20, units: 5, effectiveQuality: 1, age: 10,
    capacityAvailable: 1, offeredWage: 15, reservationWage: 15, personalSafety: 1, firmContinuity: 1,
    workerProtection: 1, growth: 1, extraction: 1, exitRelief: 1,
  };
  return [
    ...ACTION_KINDS.map((candidate) => Number(candidate === kind)),
    ...ACTION_NUMERIC_FEATURES.map((name) => name === "capacityAvailable"
      ? Number(Boolean(source[name]))
      : clamp01(source[name] / scales[name])),
  ];
}

export type SharedNeuralWeights = Readonly<{
  version: string;
  hiddenWeights: readonly (readonly number[])[];
  hiddenBias: readonly number[];
  outputWeights: readonly number[];
  outputBias: number;
}>;

export function createSharedNeuralWeights(seed = 2901, hiddenSize = 12): SharedNeuralWeights {
  const random = createRandom(seed);
  const inputSize = NEURAL_OBSERVATION_SCHEMA.features.length + ACTION_KINDS.length + ACTION_NUMERIC_FEATURES.length;
  const weight = (scale: number) => (random() * 2 - 1) * scale;
  const inputScale = 0.8 / Math.sqrt(inputSize);
  return Object.freeze({
    version: seed === 2901 && hiddenSize === 12 ? NEURAL_WEIGHTS_VERSION : `shared-mlp-seed-${seed}-h${hiddenSize}-v1`,
    hiddenWeights: Object.freeze(Array.from({ length: hiddenSize }, () => Object.freeze(Array.from({ length: inputSize }, () => weight(inputScale))))),
    hiddenBias: Object.freeze(Array.from({ length: hiddenSize }, () => weight(0.08))),
    outputWeights: Object.freeze(Array.from({ length: hiddenSize }, () => weight(0.35))),
    outputBias: weight(0.05),
  });
}

export type NeuralInference = Readonly<{
  action: CitizenAction;
  legalScores: Readonly<Record<string, number>>;
  legalMask: Readonly<Record<ActionKind, boolean>>;
  unmaskedPreference: string;
  unmaskedActionKind: ActionKind;
  invalidPreferenceBeforeMask: boolean;
}>;

export class SharedNeuralPolicy implements CitizenPolicy {
  readonly id = `neural-shadow-schema-${NEURAL_SCHEMA_VERSION}`;
  readonly weights: SharedNeuralWeights;

  constructor(weights = createSharedNeuralWeights()) {
    this.weights = weights;
  }

  score(observation: CitizenObservation, action: string) {
    const input = [...encodeNeuralObservation(observation), ...encodeNeuralAction(observation, action)];
    const hidden = this.weights.hiddenWeights.map((weights, index) => Math.tanh(
      weights.reduce((sum, weight, inputIndex) => sum + weight * input[inputIndex], this.weights.hiddenBias[index]),
    ));
    return hidden.reduce((sum, value, index) => sum + value * this.weights.outputWeights[index], this.weights.outputBias);
  }

  infer(observation: CitizenObservation, legalActions: readonly CitizenAction[]): NeuralInference {
    if (!legalActions.length) throw new Error("Neural policy requires at least one legal action");
    const legalKinds = new Set(legalActions.map(actionKind));
    const legalScores = Object.fromEntries(legalActions.map((action) => [action, this.score(observation, action)]));
    const syntheticIllegal = ACTION_KINDS.filter((kind) => !legalKinds.has(kind)).map((kind) => ({
      action: `illegal-kind:${kind}`,
      kind,
      score: this.score(observation, kind),
    }));
    const legalCandidates = legalActions.map((action) => ({ action, kind: actionKind(action), score: legalScores[action] }));
    const bestLegal = legalCandidates.reduce((best, candidate) => candidate.score > best.score ? candidate : best);
    const bestUnmasked = [...legalCandidates, ...syntheticIllegal].reduce((best, candidate) => candidate.score > best.score ? candidate : best);
    return Object.freeze({
      action: bestLegal.action,
      legalScores: Object.freeze(legalScores),
      legalMask: Object.freeze(Object.fromEntries(ACTION_KINDS.map((kind) => [kind, legalKinds.has(kind)])) as Record<ActionKind, boolean>),
      unmaskedPreference: bestUnmasked.action,
      unmaskedActionKind: bestUnmasked.kind,
      invalidPreferenceBeforeMask: bestUnmasked.action.startsWith("illegal-kind:"),
    });
  }

  decide({ observation, legalActions }: CitizenPolicyInput): CitizenPolicyDecision {
    const inference = this.infer(observation, legalActions);
    return {
      action: inference.action,
      reasons: ["The shared neural policy selected the highest-scoring legal action after applying the versioned mask."],
      scores: inference.legalScores,
    };
  }
}

export type ShadowDecision = Readonly<{
  policy: string;
  weightsVersion: string;
  schemaVersion: number;
  action: CitizenAction;
  diverged: boolean;
  unmaskedPreference: string;
  unmaskedActionKind: ActionKind;
  invalidPreferenceBeforeMask: boolean;
  legalMask: Readonly<Record<ActionKind, boolean>>;
  scores: Readonly<Record<string, number>>;
}>;

export class ShadowCitizenPolicy implements CitizenPolicy {
  readonly id: string;

  constructor(readonly activePolicy: CitizenPolicy, readonly neuralPolicy = new SharedNeuralPolicy()) {
    this.id = `${activePolicy.id}+${neuralPolicy.id}`;
  }

  decide(input: CitizenPolicyInput): CitizenPolicyDecision {
    const active = this.activePolicy.decide(input);
    const inference = this.neuralPolicy.infer(input.observation, input.legalActions);
    const shadow: ShadowDecision = Object.freeze({
      policy: this.neuralPolicy.id,
      weightsVersion: this.neuralPolicy.weights.version,
      schemaVersion: NEURAL_SCHEMA_VERSION,
      action: inference.action,
      diverged: inference.action !== active.action,
      unmaskedPreference: inference.unmaskedPreference,
      unmaskedActionKind: inference.unmaskedActionKind,
      invalidPreferenceBeforeMask: inference.invalidPreferenceBeforeMask,
      legalMask: inference.legalMask,
      scores: inference.legalScores,
    });
    return { ...active, shadow } as CitizenPolicyDecision;
  }
}
