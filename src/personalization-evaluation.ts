import {
  createPersonalizationResearchPolicy,
  learnPersonalTimeEmbeddings,
  PERSONALIZATION_RESEARCH_SCHEMA_VERSION,
  PERSONALIZATION_STATE_VERSION,
  type PersonalizationTable,
  type PersonalizationVariant,
} from "./personalization-research.ts";
import { evaluatePolicies, evaluatePolicyRun } from "./policy-evaluation.ts";
import { exportTrajectoryDataset } from "./trajectory-export.ts";
import type { SharedNeuralWeights } from "./neural-policy.ts";

export const PERSONALIZATION_REPORT_SCHEMA_VERSION = 1;

type ResearchConfig = Readonly<{
  weights: SharedNeuralWeights;
  trainingSeeds: readonly number[];
  trainingDays: number;
  evaluationSeeds: readonly number[];
  evaluationDays: number;
  baseTrainingSamples: number;
  learningCurveDays?: readonly number[];
}>;

function policyFactory(variant: PersonalizationVariant, weights: SharedNeuralWeights, embeddings: PersonalizationTable = Object.freeze({})) {
  return () => createPersonalizationResearchPolicy(variant, weights, embeddings);
}

function agreementFor(weights: SharedNeuralWeights, embeddings: PersonalizationTable, seeds: readonly number[], days: number) {
  const runs = seeds.map((seed) => evaluatePolicyRun({
    seed,
    days,
    policyFactory: policyFactory("learned-embedding", weights, embeddings),
  }));
  const controlled = runs.reduce((sum, run) => sum + run.control.neuralDecisions, 0);
  const divergences = runs.reduce((sum, run) => sum + run.control.divergencesFromFallback, 0);
  return {
    agreementRate: controlled ? 1 - divergences / controlled : 0,
    controlledDecisions: controlled,
    failures: runs.filter((run) => run.status === "failed").length,
    illegalAppliedActions: runs.reduce((sum, run) => sum + run.invalidActions, 0),
    cashConserved: runs.every((run) => run.cash.conserved),
  };
}

export function evaluatePersonalizationResearch(config: ResearchConfig) {
  const learningCurveDays = [...new Set(config.learningCurveDays ?? [1, Math.min(5, config.trainingDays), config.trainingDays])]
    .filter((days) => Number.isInteger(days) && days > 0 && days <= config.trainingDays)
    .sort((a, b) => a - b);
  const trainingDataset = exportTrajectoryDataset({ seeds: config.trainingSeeds, days: config.trainingDays });
  const learned = learnPersonalTimeEmbeddings(trainingDataset);
  const factories = {
    "profile-only": policyFactory("profile-only", config.weights),
    "learned-embedding": policyFactory("learned-embedding", config.weights, learned.table),
    "bounded-adaptation": policyFactory("bounded-adaptation", config.weights),
  };
  const evaluationConfig = {
    seeds: config.evaluationSeeds,
    days: config.evaluationDays,
    baseline: "profile-only",
    policies: ["learned-embedding", "bounded-adaptation"],
    policyFactories: factories,
  } as const;
  const first = evaluatePolicies(evaluationConfig);
  const replay = evaluatePolicies(evaluationConfig);
  const stableReplay = JSON.stringify(first) === JSON.stringify(replay);
  const variants = Object.fromEntries(Object.keys(factories).map((name) => {
    const aggregate = first.aggregates[name];
    const runs = first.runs.filter((run) => run.name === name).map((run) => run.result);
    return [name, {
      behavioralDiversity: {
        meanPersonalTimeEntropy: aggregate.means.personalTimeEntropy,
        betweenCitizenActionVariance: aggregate.means.betweenCitizenActionVariance,
        meanDistinctPersonalTimeProfiles: aggregate.means.distinctPersonalTimeProfiles,
      },
      stability: {
        deterministicReplay: stableReplay,
        failures: aggregate.failures,
        illegalAppliedActions: runs.reduce((sum, run) => sum + run.invalidActions, 0),
        cashConserved: runs.every((run) => run.cash.conserved && run.cash.difference === 0),
      },
      fallbackAgreementRate: aggregate.means.neuralControlledDecisions
        ? 1 - aggregate.means.neuralControlDivergences / aggregate.means.neuralControlledDecisions
        : 0,
      meanControlledDecisions: aggregate.means.neuralControlledDecisions,
      interpretability: name === "profile-only"
        ? { cost: "low", perCitizenStateScalars: 0, mutableState: false, extraTrace: "shared scores plus existing motivation profile" }
        : name === "learned-embedding"
          ? { cost: "medium", perCitizenStateScalars: 4, mutableState: false, extraTrace: "four offline preference offsets plus training provenance" }
          : { cost: "high", perCitizenStateScalars: 4, mutableState: true, extraTrace: "seeded offsets, every bounded update, sequence, and teacher action" },
    }];
  }));
  const curveEvaluationSeeds = config.evaluationSeeds.slice(0, Math.min(2, config.evaluationSeeds.length));
  const curveEvaluationDays = Math.min(7, config.evaluationDays);
  const embeddingLearningCurve = learningCurveDays.map((days) => {
    const dataset = days === config.trainingDays
      ? trainingDataset
      : exportTrajectoryDataset({ seeds: config.trainingSeeds, days });
    const embeddings = learnPersonalTimeEmbeddings(dataset);
    return { trainingDays: days, additionalTrainingSamples: embeddings.trainingSamples, ...agreementFor(config.weights, embeddings.table, curveEvaluationSeeds, curveEvaluationDays) };
  });
  const adaptationRuns = first.runs.filter((run) => run.name === "bounded-adaptation").map((run) => run.result);
  const meanOnlineUpdates = adaptationRuns.reduce((sum, run) => sum + Number(run.policyMetadata.adaptationEntries ?? 0), 0) / Math.max(1, adaptationRuns.length);
  const safetyAccepted = Object.values(variants).every((variant: any) => variant.stability.failures === 0
    && variant.stability.illegalAppliedActions === 0
    && variant.stability.cashConserved
    && variant.stability.deterministicReplay);
  return Object.freeze({
    metadata: Object.freeze({
      format: "morrow-personalization-research",
      schemaVersion: PERSONALIZATION_REPORT_SCHEMA_VERSION,
      personalizationSchemaVersion: PERSONALIZATION_RESEARCH_SCHEMA_VERSION,
      weightsVersion: config.weights.version,
      trainingSeeds: [...config.trainingSeeds],
      trainingDays: config.trainingDays,
      evaluationSeeds: [...config.evaluationSeeds],
      evaluationDays: config.evaluationDays,
      variants: Object.keys(factories),
      interpretationNotice: "Synthetic, uncalibrated policy research; diversity and agreement metrics are not evidence of realistic personality or welfare.",
    }),
    status: first.status === "passed" && stableReplay && safetyAccepted ? "passed" : "failed",
    recommendation: "retain-profile-only",
    decisionRationale: "Learned embeddings and mutable adaptation add identity state, training or audit cost, and replay obligations without a demonstrated held-out outcome benefit over profile-only behavior.",
    variants,
    sampleEfficiency: Object.freeze({
      "profile-only": { baseTrainingSamples: config.baseTrainingSamples, additionalTrainingSamples: 0, onlineUpdates: 0 },
      "learned-embedding": { baseTrainingSamples: config.baseTrainingSamples, learningCurve: embeddingLearningCurve },
      "bounded-adaptation": { baseTrainingSamples: config.baseTrainingSamples, additionalTrainingSamples: 0, meanOnlineUpdates },
    }),
    adaptationStateContract: Object.freeze({
      format: "morrow-bounded-personalization-state",
      version: PERSONALIZATION_STATE_VERSION,
      seededBy: "fixed adaptationSeed plus synthetic citizen slot",
      serialization: "sorted citizen slots with four finite bounded offsets, update sequence, seed, step, and limit",
      reset: "clear offsets, sequence, and audit; lazy seeded initialization reproduces the first state",
      audit: "each update records sequence, synthetic citizen slot, teacher and chosen actions, and before/after offsets",
      legalBoundary: "personalization re-ranks only TownSimulation-provided legal personal-time actions; simulation validation and accounting invariants remain authoritative",
    }),
    evaluation: first,
  });
}
