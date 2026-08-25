import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ACTION_KINDS,
  LEGACY_KNOWLEDGE_MIGRATION_SUFFIX,
  loadSharedNeuralWeightArtifact,
  scoreNeuralInput,
} from "../src/neural-policy.ts";
import {
  exportTrajectoryDataset,
  REWARD_HYPOTHESIS_VERSION,
  TRAJECTORY_SCHEMA_VERSION,
} from "../src/trajectory-export.ts";

test("trajectory exports are deterministic, synthetic, versioned, and legally masked", () => {
  const config = { seeds: [42], days: 1 };
  const first = exportTrajectoryDataset(config);
  const replay = exportTrajectoryDataset(config);

  assert.deepEqual(first, replay);
  assert.equal(first.metadata.schemaVersion, TRAJECTORY_SCHEMA_VERSION);
  assert.equal(first.metadata.rewardHypothesisVersion, REWARD_HYPOTHESIS_VERSION);
  assert.ok(first.samples.length > 0);
  first.samples.forEach((sample) => {
    assert.ok(sample.legalActions.some((candidate) => candidate.action === sample.chosenAction));
    assert.equal(sample.legalMask[sample.legalActions.find((candidate) => candidate.action === sample.chosenAction).kind], true);
    assert.equal(sample.reward.version, REWARD_HYPOTHESIS_VERSION);
    assert.equal(Object.keys(sample.legalMask).length, ACTION_KINDS.length);
  });
  const serialized = JSON.stringify(first);
  assert.doesNotMatch(serialized, /citizenName|firmName|relationships|ledger|events/);
  assert.match(first.metadata.rewardNotice, /Hypothetical/);
});

test("TypeScript validates Python-exported weights and reproduces their golden score", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/python-exported-weights.json", import.meta.url), "utf8"));
  const loaded = loadSharedNeuralWeightArtifact(fixture);

  loaded.goldenVectors.forEach((vector) => {
    const actual = scoreNeuralInput(loaded.weights, [...vector.observation, ...vector.action]);
    assert.ok(Math.abs(actual - vector.expectedScore) < 1e-12);
  });
  assert.equal(loaded.artifact.training.objective, "reward-weighted-active-policy-imitation-v1");
  assert.equal(loaded.artifact.neuralSchemaVersion, 2);
  assert.equal(loaded.weights.version, `${fixture.weightsVersion}${LEGACY_KNOWLEDGE_MIGRATION_SUFFIX}`);
  assert.equal(loaded.artifact.training.migration.rule, "append-zero-weight-general-retail-inventory-v1");
  const legacyObservationWidth = fixture.goldenVectors[0].observation.length;
  loaded.weights.hiddenWeights.forEach((row, index) => {
    assert.deepEqual(row.slice(legacyObservationWidth, legacyObservationWidth + 3), [0, 0, 0]);
    assert.deepEqual(row.slice(0, legacyObservationWidth), fixture.weights.hiddenWeights[index].slice(0, legacyObservationWidth));
    assert.deepEqual(row.slice(legacyObservationWidth + 3), fixture.weights.hiddenWeights[index].slice(legacyObservationWidth));
  });
});

test("weight loading rejects incompatible schemas, shapes, and non-finite values", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/python-exported-weights.json", import.meta.url), "utf8"));
  assert.throws(() => loadSharedNeuralWeightArtifact({ ...fixture, neuralSchemaVersion: 999 }), /schema mismatch/);
  assert.throws(() => loadSharedNeuralWeightArtifact({ ...fixture, actionKinds: fixture.actionKinds.slice(1) }), /action-kind schema mismatch/);
  assert.throws(() => loadSharedNeuralWeightArtifact({
    ...fixture,
    weights: { ...fixture.weights, hiddenWeights: [[...fixture.weights.hiddenWeights[0], 0]] },
  }), /hiddenWeights/);
  assert.throws(() => loadSharedNeuralWeightArtifact({
    ...fixture,
    weights: { ...fixture.weights, outputBias: Number.POSITIVE_INFINITY },
  }), /outputBias/);
});
