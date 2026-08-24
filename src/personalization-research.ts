import {
  MotivationCitizenPolicy,
  PERSONAL_TIME_ACTIONS,
  type CitizenAction,
  type CitizenPolicy,
  type CitizenPolicyDecision,
  type CitizenPolicyInput,
} from "./citizen-policy.ts";
import {
  NEURAL_SCHEMA_VERSION,
  SharedNeuralPolicy,
  type ShadowDecision,
  type SharedNeuralWeights,
} from "./neural-policy.ts";
import { createRandom } from "./random.js";

export const PERSONALIZATION_RESEARCH_SCHEMA_VERSION = 1;
export const PERSONALIZATION_STATE_VERSION = 1;
export const PERSONALIZATION_ACTIONS = PERSONAL_TIME_ACTIONS;

export type PersonalizationVariant = "profile-only" | "learned-embedding" | "bounded-adaptation";
export type PersonalizationTable = Readonly<Record<number, readonly number[]>>;

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

function actionIndex(action: string) {
  return PERSONALIZATION_ACTIONS.indexOf(action as (typeof PERSONALIZATION_ACTIONS)[number]);
}

function softmax(scores: Readonly<Record<string, number>>) {
  const entries = Object.entries(scores);
  const maximum = Math.max(...entries.map(([, score]) => score));
  const exponentials = entries.map(([action, score]) => [action, Math.exp(score - maximum)] as const);
  const total = exponentials.reduce((sum, [, value]) => sum + value, 0);
  return Object.freeze(Object.fromEntries(exponentials.map(([action, value]) => [action, value / total])));
}

export function learnPersonalTimeEmbeddings(dataset: any, limit = 0.25) {
  if (dataset?.metadata?.format !== "morrow-policy-trajectories" || !Array.isArray(dataset.samples)) throw new Error("Personalization training requires a versioned trajectory dataset");
  const counts = new Map<number, number[]>();
  let samples = 0;
  dataset.samples.forEach((sample: any) => {
    if (sample.observationKind !== "personal-time" || !Number.isInteger(sample.agentSlot)) return;
    const index = actionIndex(sample.chosenAction);
    if (index < 0) return;
    const citizenCounts = counts.get(sample.agentSlot) ?? Array(PERSONALIZATION_ACTIONS.length).fill(0);
    citizenCounts[index] += 1;
    counts.set(sample.agentSlot, citizenCounts);
    samples += 1;
  });
  const table = Object.fromEntries([...counts.entries()].map(([slot, citizenCounts]) => {
    const total = citizenCounts.reduce((sum, count) => sum + count, 0);
    const logs = citizenCounts.map((count) => Math.log((count + 1) / (total + PERSONALIZATION_ACTIONS.length)));
    const mean = logs.reduce((sum, value) => sum + value, 0) / logs.length;
    return [slot, Object.freeze(logs.map((value) => clamp((value - mean) * 0.08, limit)))];
  }));
  return Object.freeze({
    format: "morrow-personal-time-embeddings",
    version: PERSONALIZATION_RESEARCH_SCHEMA_VERSION,
    dimensions: PERSONALIZATION_ACTIONS.length,
    actions: Object.freeze([...PERSONALIZATION_ACTIONS]),
    trainingSamples: samples,
    trainingSeeds: Object.freeze([...(dataset.metadata.seeds ?? [])]),
    trainingDays: dataset.metadata.days,
    table: Object.freeze(table) as PersonalizationTable,
  });
}

export class PersonalizationResearchPolicy implements CitizenPolicy {
  readonly id: string;
  private adaptation = new Map<number, number[]>();
  private audit: any[] = [];
  private sequence = 0;

  constructor(
    readonly variant: PersonalizationVariant,
    readonly neuralPolicy: SharedNeuralPolicy,
    readonly embeddings: PersonalizationTable = Object.freeze({}),
    readonly adaptationSeed = 7103,
    readonly adaptationStep = 0.012,
    readonly adaptationLimit = 0.18,
    readonly fallbackPolicy: CitizenPolicy = new MotivationCitizenPolicy(),
  ) {
    this.id = `research-${variant}-personal-time-schema-${PERSONALIZATION_RESEARCH_SCHEMA_VERSION}`;
  }

  private initialAdaptation(citizenId: number) {
    const random = createRandom((this.adaptationSeed ^ Math.imul(citizenId + 1, 0x9e3779b1)) >>> 0);
    return PERSONALIZATION_ACTIONS.map(() => (random() * 2 - 1) * 0.005);
  }

  private adaptationFor(citizenId: number) {
    if (!this.adaptation.has(citizenId)) this.adaptation.set(citizenId, this.initialAdaptation(citizenId));
    return this.adaptation.get(citizenId)!;
  }

  private updateAdaptation(citizenId: number, teacherAction: CitizenAction, chosenAction: CitizenAction) {
    if (this.variant !== "bounded-adaptation") return;
    const values = this.adaptationFor(citizenId);
    const before = [...values];
    const teacherIndex = actionIndex(teacherAction);
    PERSONALIZATION_ACTIONS.forEach((_, index) => {
      const direction = index === teacherIndex ? 1 : -1 / (PERSONALIZATION_ACTIONS.length - 1);
      values[index] = clamp(values[index] + this.adaptationStep * direction, this.adaptationLimit);
    });
    this.sequence += 1;
    this.audit.push(Object.freeze({ sequence: this.sequence, citizenId, teacherAction, chosenAction, before, after: [...values] }));
  }

  decide(input: CitizenPolicyInput): CitizenPolicyDecision {
    const fallback = this.fallbackPolicy.decide(input);
    const inference = this.neuralPolicy.infer(input.observation, input.legalActions);
    if (input.observation.kind !== "personal-time") return fallback;
    const citizenId = input.observation.citizenId;
    const embedding = this.embeddings[citizenId] ?? Array(PERSONALIZATION_ACTIONS.length).fill(0);
    const adaptation = this.variant === "bounded-adaptation" ? this.adaptationFor(citizenId) : Array(PERSONALIZATION_ACTIONS.length).fill(0);
    const scores = Object.freeze(Object.fromEntries(input.legalActions.map((action) => {
      const index = actionIndex(action);
      return [action, inference.legalScores[action] + (index < 0 ? 0 : embedding[index] + adaptation[index])];
    })));
    const action = input.legalActions.reduce((best, candidate) => scores[candidate] > scores[best] ? candidate : best);
    const shadow: ShadowDecision = Object.freeze({
      policy: this.id,
      weightsVersion: this.neuralPolicy.weights.version,
      schemaVersion: NEURAL_SCHEMA_VERSION,
      action,
      diverged: action !== fallback.action,
      unmaskedPreference: inference.unmaskedPreference,
      unmaskedActionKind: inference.unmaskedActionKind,
      invalidPreferenceBeforeMask: inference.invalidPreferenceBeforeMask,
      legalMask: inference.legalMask,
      scores,
    });
    this.updateAdaptation(citizenId, fallback.action, action);
    return {
      action,
      reasons: [`The ${this.variant} research policy selected the highest-scoring currently legal personal-time action.`],
      scores,
      control: {
        mode: "neural",
        domain: "personal-time",
        policy: this.id,
        fallbackPolicy: this.fallbackPolicy.id,
        weightsVersion: this.neuralPolicy.weights.version,
        schemaVersion: NEURAL_SCHEMA_VERSION,
        gateVersion: 0,
        probabilities: softmax(scores),
      },
      shadow,
    };
  }

  serializeState() {
    return Object.freeze({
      format: "morrow-bounded-personalization-state",
      version: PERSONALIZATION_STATE_VERSION,
      variant: this.variant,
      adaptationSeed: this.adaptationSeed,
      adaptationStep: this.adaptationStep,
      adaptationLimit: this.adaptationLimit,
      sequence: this.sequence,
      citizens: Object.freeze([...this.adaptation.entries()].sort(([a], [b]) => a - b).map(([citizenId, values]) => Object.freeze({ citizenId, values: Object.freeze([...values]) }))),
    });
  }

  restoreState(value: any) {
    if (value?.format !== "morrow-bounded-personalization-state" || value.version !== PERSONALIZATION_STATE_VERSION || value.variant !== this.variant) throw new Error("Unsupported personalization state");
    if (value.adaptationSeed !== this.adaptationSeed || value.adaptationStep !== this.adaptationStep || value.adaptationLimit !== this.adaptationLimit) throw new Error("Personalization state configuration mismatch");
    if (!Number.isInteger(value.sequence) || !Array.isArray(value.citizens)) throw new Error("Invalid personalization state shape");
    const restored = new Map<number, number[]>();
    value.citizens.forEach((entry: any) => {
      if (!Number.isInteger(entry.citizenId) || !Array.isArray(entry.values) || entry.values.length !== PERSONALIZATION_ACTIONS.length || entry.values.some((item: unknown) => typeof item !== "number" || !Number.isFinite(item) || Math.abs(item) > this.adaptationLimit)) throw new Error("Invalid personalization citizen state");
      restored.set(entry.citizenId, [...entry.values]);
    });
    this.adaptation = restored;
    this.sequence = value.sequence;
    this.audit = [];
  }

  resetState() {
    this.adaptation.clear();
    this.audit = [];
    this.sequence = 0;
  }

  auditTrail() {
    return Object.freeze([...this.audit]);
  }

  metadata() {
    return Object.freeze({
      id: this.id,
      mode: "research",
      controlledDomain: "personal-time",
      fallbackPolicy: this.fallbackPolicy.id,
      weightsVersion: this.neuralPolicy.weights.version,
      personalizationVariant: this.variant,
      personalizationStateVersion: PERSONALIZATION_STATE_VERSION,
      adaptationSeed: this.adaptationSeed,
      adaptationEntries: this.sequence,
      stateScalars: this.adaptation.size * PERSONALIZATION_ACTIONS.length,
    });
  }
}

export function createPersonalizationResearchPolicy(variant: PersonalizationVariant, weights: SharedNeuralWeights, embeddings: PersonalizationTable = Object.freeze({})) {
  return new PersonalizationResearchPolicy(variant, new SharedNeuralPolicy(weights), embeddings);
}
