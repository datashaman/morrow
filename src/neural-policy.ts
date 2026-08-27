import { createRandom } from "./random.js";
import type {
  CitizenAction,
  CitizenObservation,
  CitizenPolicy,
  CitizenPolicyDecision,
  CitizenPolicyInput,
  MotivationProfile,
} from "./citizen-policy.ts";

export const NEURAL_SCHEMA_VERSION = 2;
export const NEURAL_WEIGHTS_VERSION = "shared-mlp-seed-2901-h12-v2";
export const LEGACY_NEURAL_SCHEMA_VERSION = 1;
export const LEGACY_KNOWLEDGE_MIGRATION_SUFFIX = "-schema2-zero-knowledge";

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
    "knowledge:general", "knowledge:retail", "knowledge:inventory",
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
  const knowledge = source.knowledgeProfile ?? {};
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
    clamp01(knowledge.general),
    clamp01(knowledge.retail),
    clamp01(knowledge.inventory),
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

export type SharedNeuralWeightArtifact = Readonly<{
  format: "morrow-shared-policy-weights";
  formatVersion: 1;
  neuralSchemaVersion: number;
  weightsVersion: string;
  architecture: Readonly<{ type: "pair-mlp"; activation: "tanh"; inputSize: number; hiddenSize: number }>;
  actionKinds: readonly string[];
  training: Readonly<Record<string, unknown>>;
  weights: Readonly<{
    hiddenWeights: readonly (readonly number[])[];
    hiddenBias: readonly number[];
    outputWeights: readonly number[];
    outputBias: number;
  }>;
  goldenVectors: readonly Readonly<{ observation: readonly number[]; action: readonly number[]; expectedScore: number }>[];
}>;

const expectedNeuralInputSize = () => NEURAL_OBSERVATION_SCHEMA.features.length + ACTION_KINDS.length + ACTION_NUMERIC_FEATURES.length;
const KNOWLEDGE_FEATURE_COUNT = 3;

export function migrateSharedNeuralWeightArtifactV1(value: unknown) {
  const artifact = value as any;
  if (!artifact || artifact.neuralSchemaVersion !== LEGACY_NEURAL_SCHEMA_VERSION) throw new Error("Expected a neural schema-v1 artifact");
  const legacyObservationWidth = NEURAL_OBSERVATION_SCHEMA.features.length - KNOWLEDGE_FEATURE_COUNT;
  const legacyInputSize = expectedNeuralInputSize() - KNOWLEDGE_FEATURE_COUNT;
  if (artifact.architecture?.inputSize !== legacyInputSize) throw new Error("Invalid legacy neural input size");
  if (!Array.isArray(artifact.weights?.hiddenWeights)
    || artifact.weights.hiddenWeights.some((row: unknown) => !Array.isArray(row) || row.length !== legacyInputSize)) {
    throw new Error("Invalid legacy hiddenWeights");
  }
  if (!Array.isArray(artifact.goldenVectors)
    || artifact.goldenVectors.some((vector: any) => !Array.isArray(vector?.observation) || vector.observation.length !== legacyObservationWidth)) {
    throw new Error("Invalid legacy golden observation width");
  }
  return {
    ...artifact,
    neuralSchemaVersion: NEURAL_SCHEMA_VERSION,
    weightsVersion: `${artifact.weightsVersion}${LEGACY_KNOWLEDGE_MIGRATION_SUFFIX}`,
    architecture: { ...artifact.architecture, inputSize: expectedNeuralInputSize() },
    training: {
      ...artifact.training,
      migration: {
        fromNeuralSchemaVersion: LEGACY_NEURAL_SCHEMA_VERSION,
        rule: "append-zero-weight-general-retail-inventory-v1",
        notice: "Compatibility migration only; knowledge inputs have no trained influence.",
      },
    },
    weights: {
      ...artifact.weights,
      hiddenWeights: artifact.weights.hiddenWeights.map((row: number[]) => [
        ...row.slice(0, legacyObservationWidth),
        ...Array(KNOWLEDGE_FEATURE_COUNT).fill(0),
        ...row.slice(legacyObservationWidth),
      ]),
    },
    goldenVectors: artifact.goldenVectors.map((vector: any) => ({
      ...vector,
      observation: [...vector.observation, ...Array(KNOWLEDGE_FEATURE_COUNT).fill(0)],
    })),
  };
}

function finiteVector(value: unknown, length: number, label: string): number[] {
  if (!Array.isArray(value) || value.length !== length || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    throw new Error(`Invalid ${label}; expected ${length} finite numbers`);
  }
  return [...value];
}

export function loadSharedNeuralWeightArtifact(value: unknown) {
  const source = value as any;
  const artifact = source?.neuralSchemaVersion === LEGACY_NEURAL_SCHEMA_VERSION
    ? migrateSharedNeuralWeightArtifactV1(source)
    : source;
  if (!artifact || artifact.format !== "morrow-shared-policy-weights" || artifact.formatVersion !== 1) throw new Error("Unsupported neural weight artifact format");
  if (artifact.neuralSchemaVersion !== NEURAL_SCHEMA_VERSION) throw new Error(`Neural schema mismatch: expected ${NEURAL_SCHEMA_VERSION}`);
  if (!Array.isArray(artifact.actionKinds) || artifact.actionKinds.length !== ACTION_KINDS.length || artifact.actionKinds.some((kind: string, index: number) => kind !== ACTION_KINDS[index])) {
    throw new Error("Neural action-kind schema mismatch");
  }
  const architecture = artifact.architecture;
  const inputSize = expectedNeuralInputSize();
  if (!architecture || architecture.type !== "pair-mlp" || architecture.activation !== "tanh" || architecture.inputSize !== inputSize || !Number.isInteger(architecture.hiddenSize) || architecture.hiddenSize < 1) {
    throw new Error("Unsupported neural weight architecture");
  }
  const hiddenSize = architecture.hiddenSize;
  if (!Array.isArray(artifact.weights?.hiddenWeights) || artifact.weights.hiddenWeights.length !== hiddenSize) throw new Error("Invalid hidden-weight matrix height");
  const hiddenWeights = artifact.weights.hiddenWeights.map((row: unknown, index: number) => finiteVector(row, inputSize, `hiddenWeights[${index}]`));
  const hiddenBias = finiteVector(artifact.weights.hiddenBias, hiddenSize, "hiddenBias");
  const outputWeights = finiteVector(artifact.weights.outputWeights, hiddenSize, "outputWeights");
  if (typeof artifact.weights.outputBias !== "number" || !Number.isFinite(artifact.weights.outputBias)) throw new Error("Invalid outputBias");
  if (typeof artifact.weightsVersion !== "string" || !artifact.weightsVersion) throw new Error("Missing weightsVersion");
  if (!Array.isArray(artifact.goldenVectors) || !artifact.goldenVectors.length) throw new Error("Weight artifact requires golden vectors");
  const goldenVectors = artifact.goldenVectors.map((vector: any, index: number) => ({
    observation: finiteVector(vector?.observation, NEURAL_OBSERVATION_SCHEMA.features.length, `goldenVectors[${index}].observation`),
    action: finiteVector(vector?.action, ACTION_KINDS.length + ACTION_NUMERIC_FEATURES.length, `goldenVectors[${index}].action`),
    expectedScore: typeof vector?.expectedScore === "number" && Number.isFinite(vector.expectedScore)
      ? vector.expectedScore
      : (() => { throw new Error(`Invalid goldenVectors[${index}].expectedScore`); })(),
  }));
  const weights: SharedNeuralWeights = Object.freeze({
    version: artifact.weightsVersion,
    hiddenWeights: Object.freeze(hiddenWeights.map((row: number[]) => Object.freeze(row))),
    hiddenBias: Object.freeze(hiddenBias),
    outputWeights: Object.freeze(outputWeights),
    outputBias: artifact.weights.outputBias,
  });
  return Object.freeze({ artifact: artifact as SharedNeuralWeightArtifact, weights, goldenVectors: Object.freeze(goldenVectors) });
}

export function scoreNeuralInput(weights: SharedNeuralWeights, input: readonly number[]) {
  if (input.length !== expectedNeuralInputSize() || input.some((value) => !Number.isFinite(value))) throw new Error("Invalid encoded neural input");
  const hidden = weights.hiddenWeights.map((row, index) => Math.tanh(
    row.reduce((sum, weight, inputIndex) => sum + weight * input[inputIndex], weights.hiddenBias[index]),
  ));
  return hidden.reduce((sum, value, index) => sum + value * weights.outputWeights[index], weights.outputBias);
}

export function createSharedNeuralWeights(seed = 2901, hiddenSize = 12): SharedNeuralWeights {
  const random = createRandom(seed);
  const inputSize = NEURAL_OBSERVATION_SCHEMA.features.length + ACTION_KINDS.length + ACTION_NUMERIC_FEATURES.length;
  const weight = (scale: number) => (random() * 2 - 1) * scale;
  const inputScale = 0.8 / Math.sqrt(inputSize);
  return Object.freeze({
    version: seed === 2901 && hiddenSize === 12 ? NEURAL_WEIGHTS_VERSION : `shared-mlp-seed-${seed}-h${hiddenSize}-v2`,
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
    return scoreNeuralInput(this.weights, input);
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
    if (["health", "education", "clinical-care"].includes(input.observation.kind)) return { ...active, policy: this.activePolicy.id } as CitizenPolicyDecision;
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

export type NeuralActivationGate = Readonly<{
  format: "morrow-neural-activation-gate";
  version: 1;
  passed: boolean;
  domain: "personal-time";
  neuralSchemaVersion: number;
  weightsVersion: string;
  baselinePolicy: string;
  candidatePolicy: string;
  evidence: Readonly<Record<string, unknown>>;
}>;

function probabilities(scores: Readonly<Record<string, number>>) {
  const entries = Object.entries(scores);
  const maximum = Math.max(...entries.map(([, score]) => score));
  const exponentials = entries.map(([action, score]) => [action, Math.exp(score - maximum)] as const);
  const total = exponentials.reduce((sum, [, value]) => sum + value, 0);
  return Object.freeze(Object.fromEntries(exponentials.map(([action, value]) => [action, value / total])));
}

export function validateNeuralActivationGate(gate: NeuralActivationGate, neuralPolicy: SharedNeuralPolicy, fallbackPolicy: CitizenPolicy) {
  if (!gate || gate.format !== "morrow-neural-activation-gate" || gate.version !== 1 || !gate.passed) throw new Error("Neural activation requires a passed versioned gate");
  if (gate.domain !== "personal-time") throw new Error("Neural activation is limited to personal-time decisions");
  if (gate.neuralSchemaVersion !== NEURAL_SCHEMA_VERSION) throw new Error("Neural activation gate schema mismatch");
  if (gate.weightsVersion !== neuralPolicy.weights.version) throw new Error("Neural activation gate weights mismatch");
  if (gate.baselinePolicy !== fallbackPolicy.id) throw new Error("Neural activation gate fallback-policy mismatch");
  const expectedCandidatePolicy = `${fallbackPolicy.id}+gated-neural-personal-time-schema-${NEURAL_SCHEMA_VERSION}`;
  if (gate.candidatePolicy !== expectedCandidatePolicy) throw new Error("Neural activation gate candidate-policy mismatch");
  const checks = (gate.evidence as any)?.checks;
  const requiredChecks = ["zeroFailures", "zeroIllegalAppliedActions", "cashConserved", "stableReplay", "controlledPersonalTimeOnly", "boundedOutcomes"];
  if (!checks || requiredChecks.some((name) => checks[name] !== true)) throw new Error("Neural activation gate evidence is incomplete or failed");
  const outcomeBounds = (gate.evidence as any)?.outcomeBounds;
  if (!outcomeBounds || !Object.values(outcomeBounds).length || Object.values(outcomeBounds).some((result: any) => result?.passed !== true)) {
    throw new Error("Neural activation outcome bounds did not pass");
  }
  return gate;
}

export class GatedNeuralCitizenPolicy implements CitizenPolicy {
  readonly id: string;
  private enabled: boolean;

  constructor(
    readonly fallbackPolicy: CitizenPolicy,
    readonly neuralPolicy: SharedNeuralPolicy,
    readonly gate: NeuralActivationGate,
    enabled = false,
  ) {
    validateNeuralActivationGate(gate, neuralPolicy, fallbackPolicy);
    this.enabled = enabled;
    this.id = `${fallbackPolicy.id}+gated-neural-personal-time-schema-${NEURAL_SCHEMA_VERSION}`;
  }

  setEnabled(enabled: boolean) {
    if (enabled) validateNeuralActivationGate(this.gate, this.neuralPolicy, this.fallbackPolicy);
    this.enabled = Boolean(enabled);
  }

  metadata() {
    return Object.freeze({
      id: this.id,
      mode: this.enabled ? "neural" : "deterministic",
      controlledDomain: this.enabled ? "personal-time" : null,
      fallbackPolicy: this.fallbackPolicy.id,
      neuralPolicy: this.neuralPolicy.id,
      weightsVersion: this.neuralPolicy.weights.version,
      schemaVersion: NEURAL_SCHEMA_VERSION,
      gateVersion: this.gate.version,
      gatePassed: this.gate.passed,
    });
  }

  decide(input: CitizenPolicyInput): CitizenPolicyDecision {
    const fallback = this.fallbackPolicy.decide(input);
    // These domains remain outside the personal-time activation gate.
    // Keep them under the auditable motivation fallback until a future gate covers them.
    if (["health", "education", "clinical-care", "workday-plan", "sleep"].includes(input.observation.kind)) return { ...fallback, policy: this.fallbackPolicy.id } as CitizenPolicyDecision;
    const inference = this.neuralPolicy.infer(input.observation, input.legalActions);
    const neuralControls = this.enabled && input.observation.kind === "personal-time";
    const shadow: ShadowDecision = Object.freeze({
      policy: this.neuralPolicy.id,
      weightsVersion: this.neuralPolicy.weights.version,
      schemaVersion: NEURAL_SCHEMA_VERSION,
      action: inference.action,
      diverged: inference.action !== fallback.action,
      unmaskedPreference: inference.unmaskedPreference,
      unmaskedActionKind: inference.unmaskedActionKind,
      invalidPreferenceBeforeMask: inference.invalidPreferenceBeforeMask,
      legalMask: inference.legalMask,
      scores: inference.legalScores,
    });
    return {
      ...(neuralControls ? {
        action: inference.action,
        reasons: ["The gated shared neural policy selected the highest-scoring masked personal-time action."],
        scores: inference.legalScores,
      } : fallback),
      control: Object.freeze({
        mode: neuralControls ? "neural" : "deterministic",
        domain: "personal-time",
        policy: neuralControls ? this.neuralPolicy.id : this.fallbackPolicy.id,
        fallbackPolicy: this.fallbackPolicy.id,
        weightsVersion: this.neuralPolicy.weights.version,
        schemaVersion: NEURAL_SCHEMA_VERSION,
        gateVersion: this.gate.version,
        probabilities: probabilities(inference.legalScores),
      }),
      shadow,
    } as CitizenPolicyDecision;
  }
}
