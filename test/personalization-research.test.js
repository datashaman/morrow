import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePersonalizationResearch } from "../src/personalization-evaluation.ts";
import {
  createPersonalizationResearchPolicy,
  learnPersonalTimeEmbeddings,
} from "../src/personalization-research.ts";
import { BUNDLED_NEURAL_ARTIFACT, BUNDLED_NEURAL_WEIGHTS } from "../src/neural-runtime.ts";
import { exportTrajectoryDataset } from "../src/trajectory-export.ts";

const observation = {
  kind: "personal-time",
  citizenId: 7,
  citizenName: "Citizen",
  stress: 0.5,
  runwayDays: 4,
  focus: "belonging",
  needs: { physiological: 1, safety: 0.5, belonging: 0.3, esteem: 0.4, growth: 0.2 },
  relationshipCount: 1,
  strongestRelationship: 0.5,
  profile: { comfort: 1, connection: 1, mastery: 1, security: 1, foodQuality: 1, planning: 1, avoidance: 1 },
};
const input = { observation, legalActions: ["do-nothing", "social-visit"], random: () => 0 };

test("synthetic trajectory slots train deterministic bounded four-value embeddings", () => {
  const dataset = exportTrajectoryDataset({ seeds: [11, 22], days: 2 });
  const first = learnPersonalTimeEmbeddings(dataset);
  const replay = learnPersonalTimeEmbeddings(dataset);

  assert.deepEqual(first, replay);
  assert.ok(dataset.samples.every((sample) => Number.isInteger(sample.agentSlot)));
  assert.equal(first.dimensions, 4);
  assert.ok(first.trainingSamples > 0);
  assert.ok(Object.values(first.table).every((values) => values.length === 4 && values.every((value) => Number.isFinite(value) && Math.abs(value) <= 0.25)));
  assert.doesNotMatch(JSON.stringify(dataset), /citizenName/);
});

test("all research variants choose only from the supplied legal personal-time actions", () => {
  const dataset = exportTrajectoryDataset({ seeds: [11], days: 1 });
  const embeddings = learnPersonalTimeEmbeddings(dataset);
  [
    createPersonalizationResearchPolicy("profile-only", BUNDLED_NEURAL_WEIGHTS),
    createPersonalizationResearchPolicy("learned-embedding", BUNDLED_NEURAL_WEIGHTS, embeddings.table),
    createPersonalizationResearchPolicy("bounded-adaptation", BUNDLED_NEURAL_WEIGHTS),
  ].forEach((policy) => {
    const decision = policy.decide(input);
    assert.ok(input.legalActions.includes(decision.action));
    assert.equal(decision.control.domain, "personal-time");
  });
});

test("bounded adaptation state serializes, restores, resets, and retains an audit trail", () => {
  const original = createPersonalizationResearchPolicy("bounded-adaptation", BUNDLED_NEURAL_WEIGHTS);
  original.decide(input);
  const saved = original.serializeState();
  assert.equal(saved.citizens[0].values.length, 4);
  assert.equal(original.auditTrail().length, 1);

  const restored = createPersonalizationResearchPolicy("bounded-adaptation", BUNDLED_NEURAL_WEIGHTS);
  restored.restoreState(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored.decide(input), original.decide(input));
  assert.deepEqual(restored.serializeState(), original.serializeState());

  original.resetState();
  assert.equal(original.auditTrail().length, 0);
  assert.equal(original.serializeState().sequence, 0);
  assert.throws(() => restored.restoreState({ ...saved, adaptationLimit: 999 }), /configuration mismatch/);
});

test("personalization research is reproducible and measures diversity, sample cost, and invariant safety", () => {
  const config = {
    weights: BUNDLED_NEURAL_WEIGHTS,
    baseTrainingSamples: Number(BUNDLED_NEURAL_ARTIFACT.training.samples),
    trainingSeeds: [11],
    trainingDays: 2,
    evaluationSeeds: [101],
    evaluationDays: 2,
    learningCurveDays: [1, 2],
  };
  const first = evaluatePersonalizationResearch(config);
  const replay = evaluatePersonalizationResearch(config);

  assert.deepEqual(first, replay);
  assert.equal(first.status, "passed");
  assert.equal(first.recommendation, "retain-profile-only");
  assert.deepEqual(Object.keys(first.variants), ["profile-only", "learned-embedding", "bounded-adaptation"]);
  Object.values(first.variants).forEach((variant) => {
    assert.equal(variant.stability.deterministicReplay, true);
    assert.equal(variant.stability.illegalAppliedActions, 0);
    assert.equal(variant.stability.cashConserved, true);
    assert.ok(Number.isFinite(variant.behavioralDiversity.meanPersonalTimeEntropy));
  });
  assert.ok(first.sampleEfficiency["learned-embedding"].learningCurve.every((point) => point.additionalTrainingSamples > 0));
  assert.match(first.adaptationStateContract.legalBoundary, /legal personal-time actions/);
});
