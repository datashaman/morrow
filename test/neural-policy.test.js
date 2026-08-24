import assert from "node:assert/strict";
import test from "node:test";
import { MotivationCitizenPolicy } from "../src/citizen-policy.ts";
import {
  ACTION_KINDS,
  createSharedNeuralWeights,
  encodeNeuralAction,
  encodeNeuralObservation,
  NEURAL_ACTION_SCHEMA,
  NEURAL_OBSERVATION_SCHEMA,
  NEURAL_SCHEMA_VERSION,
  ShadowCitizenPolicy,
  SharedNeuralPolicy,
} from "../src/neural-policy.ts";
import { TownSimulation } from "../src/simulation.js";

const personalObservation = {
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

test("neural observation and action schemas are versioned and fixed-width", () => {
  const observation = encodeNeuralObservation(personalObservation);
  const action = encodeNeuralAction(personalObservation, "do-nothing");

  assert.equal(NEURAL_OBSERVATION_SCHEMA.version, NEURAL_SCHEMA_VERSION);
  assert.equal(NEURAL_ACTION_SCHEMA.version, NEURAL_SCHEMA_VERSION);
  assert.equal(observation.length, NEURAL_OBSERVATION_SCHEMA.features.length);
  assert.equal(action.length, NEURAL_ACTION_SCHEMA.kinds.length + NEURAL_ACTION_SCHEMA.numericFeatures.length);
  assert.ok(observation.every(Number.isFinite));
  assert.ok(action.every(Number.isFinite));
});

test("shared neural inference is reproducible and always returns a masked legal action", () => {
  const first = new SharedNeuralPolicy(createSharedNeuralWeights(42));
  const replay = new SharedNeuralPolicy(createSharedNeuralWeights(42));
  const legalActions = ["do-nothing", "social-visit"];

  const firstInference = first.infer(personalObservation, legalActions);
  const replayInference = replay.infer(personalObservation, legalActions);

  assert.deepEqual(firstInference, replayInference);
  assert.ok(legalActions.includes(firstInference.action));
  assert.equal(firstInference.legalMask["do-nothing"], true);
  assert.equal(firstInference.legalMask["buy-food"], false);
});

test("the neural mask records an illegal unmasked preference without selecting it", () => {
  const inputSize = NEURAL_OBSERVATION_SCHEMA.features.length + NEURAL_ACTION_SCHEMA.kinds.length + NEURAL_ACTION_SCHEMA.numericFeatures.length;
  const weights = Array(inputSize).fill(0);
  weights[NEURAL_OBSERVATION_SCHEMA.features.length + ACTION_KINDS.indexOf("take-owner-distribution")] = 5;
  const neural = new SharedNeuralPolicy({
    version: "test-illegal-preference",
    hiddenWeights: [weights],
    hiddenBias: [0],
    outputWeights: [1],
    outputBias: 0,
  });

  const inference = neural.infer(personalObservation, ["do-nothing"]);

  assert.equal(inference.action, "do-nothing");
  assert.equal(inference.unmaskedActionKind, "take-owner-distribution");
  assert.equal(inference.invalidPreferenceBeforeMask, true);
});

test("shadow policy preserves the active choice and records the neural comparison", () => {
  const active = { id: "active-test", decide: () => ({ action: "do-nothing", reasons: ["active stayed in control"], scores: { "do-nothing": 1 } }) };
  const shadowPolicy = new ShadowCitizenPolicy(active, new SharedNeuralPolicy(createSharedNeuralWeights(42)));
  const decision = shadowPolicy.decide({ observation: personalObservation, legalActions: ["do-nothing", "social-visit"], random: () => 0 });

  assert.equal(decision.action, "do-nothing");
  assert.equal(decision.reasons[0], "active stayed in control");
  assert.ok(["do-nothing", "social-visit"].includes(decision.shadow.action));
  assert.equal(decision.shadow.diverged, decision.shadow.action !== decision.action);
  assert.equal(decision.shadow.schemaVersion, 1);
});

test("the default town records neural shadow traces while its passed gate remains disabled", () => {
  const town = new TownSimulation({ seed: 42 });
  const firm = town.firms[0];
  const person = town.people[firm.employees[0]];

  town.considerAttendance(person, firm);

  assert.equal(town.citizenPolicy.fallbackPolicy instanceof MotivationCitizenPolicy, true);
  assert.equal(town.snapshot().citizenPolicy.mode, "deterministic");
  assert.equal(person.decisions[0].shadow.policy, "neural-shadow-schema-1");
  assert.ok(person.decisions[0].legalActions.includes(person.decisions[0].shadow.action));
});

test("shadow inference does not alter active-policy state or consume simulation randomness", () => {
  const shadowTown = new TownSimulation({ seed: 2026 });
  const activeOnlyTown = new TownSimulation({ seed: 2026, citizenPolicy: new MotivationCitizenPolicy() });

  for (let step = 0; step < 70; step += 1) {
    shadowTown.step();
    activeOnlyTown.step();
  }

  const { citizenPolicy: shadowMetadata, ...shadowSnapshot } = shadowTown.snapshot();
  const { citizenPolicy: activeMetadata, ...activeSnapshot } = activeOnlyTown.snapshot();
  assert.equal(shadowMetadata.mode, "deterministic");
  assert.equal(activeMetadata.mode, "deterministic");
  assert.deepEqual(shadowSnapshot, activeSnapshot);
  assert.deepEqual(
    shadowTown.people.map(({ cash, health, stress, employer, housed, hungryDays }) => ({ cash, health, stress, employer, housed, hungryDays })),
    activeOnlyTown.people.map(({ cash, health, stress, employer, housed, hungryDays }) => ({ cash, health, stress, employer, housed, hungryDays })),
  );
  assert.deepEqual(
    shadowTown.firms.map(({ cash, price, inventory, employees, status }) => ({ cash, price, inventory, employees, status })),
    activeOnlyTown.firms.map(({ cash, price, inventory, employees, status }) => ({ cash, price, inventory, employees, status })),
  );
});
