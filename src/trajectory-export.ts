import type { CitizenPolicy } from "./citizen-policy.ts";
import { PHASES } from "./config.js";
import {
  ACTION_KINDS,
  actionKind,
  encodeNeuralAction,
  encodeNeuralObservation,
  NEURAL_ACTION_SCHEMA,
  NEURAL_OBSERVATION_SCHEMA,
  NEURAL_SCHEMA_VERSION,
} from "./neural-policy.ts";
import { TownSimulation } from "./simulation.js";

export const TRAJECTORY_SCHEMA_VERSION = 1;
export const REWARD_HYPOTHESIS_VERSION = "narrative-proxy-v1";

const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export function hypothesizedReward(observation: any, action: string) {
  const components: Record<string, number> = {
    essentialFulfillment: 0,
    workParticipation: 0,
    firmContinuity: 0,
    workerProtection: 0,
    personalSafety: 0,
  };
  if (observation.kind === "food") components.essentialFulfillment = action === "skip-food" ? -0.8 : 0.4;
  if (observation.kind === "housing") components.essentialFulfillment = ["defer-housing", "remain-unhoused"].includes(action) ? -0.5 : 0.3;
  if (observation.kind === "attendance") components.workParticipation = action === "attend-shift" ? 0.15 : -0.25;
  if (observation.kind === "job-offer") components.workParticipation = action === "accept-job-offer" ? 0.2 : -0.1;
  if (observation.kind === "job-search") components.workParticipation = action.startsWith("apply-job:") ? 0.1 : -0.05;
  if (observation.kind === "owner") {
    const option = observation.options.find((candidate: any) => candidate.action === action);
    components.firmContinuity = (option?.firmContinuity ?? 0) * 0.25;
    components.workerProtection = (option?.workerProtection ?? 0) * 0.15;
    components.personalSafety = (option?.personalSafety ?? 0) * 0.1;
  }
  const total = round(Object.values(components).reduce((sum, value) => sum + value, 0));
  return Object.freeze({ version: REWARD_HYPOTHESIS_VERSION, total, components: Object.freeze(components) });
}

export type TrajectoryExportConfig = Readonly<{
  seeds: readonly number[];
  days: number;
  policyFactory?: () => CitizenPolicy;
}>;

export function exportTrajectoryDataset(config: TrajectoryExportConfig) {
  if (!config.seeds.length) throw new Error("At least one trajectory seed is required");
  if (!Number.isInteger(config.days) || config.days < 1) throw new Error("Trajectory days must be a positive integer");
  const samples: any[] = [];
  const policyIds = new Set<string>();
  const weightsVersions = new Set<string>();
  config.seeds.forEach((seed) => {
    const options = config.policyFactory ? { seed, citizenPolicy: config.policyFactory() } : { seed };
    const town: any = new TownSimulation(options as any);
    for (let day = 0; day < config.days && !town.isExtinct(); day += 1) {
      for (let phase = 0; phase < PHASES.length; phase += 1) town.step();
    }
    policyIds.add(town.citizenPolicy.id);
    const weightsVersion = town.policyMetadata().weightsVersion;
    if (weightsVersion) weightsVersions.add(weightsVersion);
    town.people.forEach((person: any) => person.decisions.forEach((decision: any) => {
      const observationVector = encodeNeuralObservation(decision.observation);
      const legalActions = decision.legalActions.map((action: string) => ({
        action,
        kind: actionKind(action),
        vector: encodeNeuralAction(decision.observation, action),
      }));
      const legalKinds = new Set(legalActions.map((candidate: any) => candidate.kind));
      samples.push({
        seed,
        day: decision.day,
        phase: decision.phase,
        decisionSequence: decision.sequence,
        observationKind: decision.kind,
        observation: observationVector,
        legalActions,
        legalMask: Object.fromEntries(ACTION_KINDS.map((kind) => [kind, legalKinds.has(kind)])),
        chosenAction: decision.chosenAction,
        reward: hypothesizedReward(decision.observation, decision.chosenAction),
      });
    }));
  });
  samples.sort((a, b) => a.seed - b.seed || a.day - b.day || PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase) || a.decisionSequence - b.decisionSequence);
  return {
    metadata: {
      format: "morrow-policy-trajectories",
      schemaVersion: TRAJECTORY_SCHEMA_VERSION,
      neuralSchemaVersion: NEURAL_SCHEMA_VERSION,
      rewardHypothesisVersion: REWARD_HYPOTHESIS_VERSION,
      simulation: "Morrow",
      simulationVersion: "0.1.0",
      seeds: [...config.seeds],
      days: config.days,
      policyIds: [...policyIds].sort(),
      weightsVersions: [...weightsVersions].sort(),
      observationFeatures: [...NEURAL_OBSERVATION_SCHEMA.features],
      actionKinds: [...ACTION_KINDS],
      actionNumericFeatures: [...NEURAL_ACTION_SCHEMA.numericFeatures],
      observationWidth: NEURAL_OBSERVATION_SCHEMA.features.length,
      actionWidth: NEURAL_ACTION_SCHEMA.kinds.length + NEURAL_ACTION_SCHEMA.numericFeatures.length,
      rewardNotice: "Hypothetical narrative proxies for training experiments; not empirical welfare measurements or legal-action definitions.",
    },
    samples,
  } as const;
}
