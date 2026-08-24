import assert from "node:assert/strict";
import test from "node:test";
import { MotivationCitizenPolicy } from "../src/citizen-policy.ts";
import { evaluatePersonalTimeActivationGate } from "../src/neural-activation-evaluation.ts";
import {
  BUNDLED_NEURAL_ACTIVATION_GATE,
  BUNDLED_NEURAL_WEIGHTS,
  createDefaultCitizenPolicy,
} from "../src/neural-runtime.ts";
import {
  GatedNeuralCitizenPolicy,
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

test("activation refuses failed, mismatched, or over-broad gate certificates", () => {
  const fallback = new MotivationCitizenPolicy();
  const neural = new SharedNeuralPolicy(BUNDLED_NEURAL_WEIGHTS);
  assert.throws(() => new GatedNeuralCitizenPolicy(fallback, neural, { ...BUNDLED_NEURAL_ACTIVATION_GATE, passed: false }), /requires a passed/);
  assert.throws(() => new GatedNeuralCitizenPolicy(fallback, neural, { ...BUNDLED_NEURAL_ACTIVATION_GATE, weightsVersion: "other" }), /weights mismatch/);
  assert.throws(() => new GatedNeuralCitizenPolicy(fallback, neural, { ...BUNDLED_NEURAL_ACTIVATION_GATE, candidatePolicy: "other" }), /candidate-policy mismatch/);
  assert.throws(() => new GatedNeuralCitizenPolicy(fallback, neural, { ...BUNDLED_NEURAL_ACTIVATION_GATE, domain: "food" }), /limited to personal-time/);
  assert.throws(() => new GatedNeuralCitizenPolicy(fallback, neural, {
    ...BUNDLED_NEURAL_ACTIVATION_GATE,
    evidence: { ...BUNDLED_NEURAL_ACTIVATION_GATE.evidence, checks: { ...BUNDLED_NEURAL_ACTIVATION_GATE.evidence.checks, cashConserved: false } },
  }), /evidence is incomplete or failed/);
});

test("a passed gate controls only personal time and records masked scores and probabilities", () => {
  const policy = createDefaultCitizenPolicy(true);
  const personal = policy.decide({ observation: personalObservation, legalActions: ["do-nothing", "social-visit"], random: () => 0 });
  const attendance = policy.decide({
    observation: {
      kind: "attendance", citizenId: 7, citizenName: "Citizen", firmId: 1, firmName: "Firm", health: 1,
      stress: 0, hungryDays: 0, runwayDays: 10, reliability: 1, missedWork: 0, baselineMissChance: 0.01,
      attendanceDraw: 0.5, profile: personalObservation.profile,
    },
    legalActions: ["attend-shift", "miss-shift"],
    random: () => 0,
  });

  assert.equal(personal.control.mode, "neural");
  assert.ok(["do-nothing", "social-visit"].includes(personal.action));
  assert.ok(Math.abs(Object.values(personal.control.probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  assert.equal(attendance.control.mode, "deterministic");
  assert.equal(attendance.action, "attend-shift");
});

test("runtime switching changes the next decision without resetting the town", () => {
  const town = new TownSimulation({ seed: 42 });
  const people = town.people;
  const day = town.day;

  const enabled = town.setNeuralControl(true);
  town.personalPhase();
  assert.equal(enabled.mode, "neural");
  assert.equal(town.people, people);
  assert.equal(town.day, day);
  assert.ok(town.people.flatMap((person) => person.decisions).some((decision) => decision.kind === "personal-time" && decision.control.mode === "neural"));

  const disabled = town.setNeuralControl(false);
  town.personalPhase();
  assert.equal(disabled.mode, "deterministic");
  assert.ok(town.people.filter((person) => person.alive).every((person) => person.decisions[0].control.mode === "deterministic"));
});

test("the reproducible multi-seed personal-time activation gate passes all checks", () => {
  const first = evaluatePersonalTimeActivationGate({ weights: BUNDLED_NEURAL_WEIGHTS, seeds: [101, 202], days: 3 });
  const replay = evaluatePersonalTimeActivationGate({ weights: BUNDLED_NEURAL_WEIGHTS, seeds: [101, 202], days: 3 });

  assert.deepEqual(first, replay);
  assert.equal(first.gate.passed, true);
  assert.ok(Object.values(first.gate.evidence.checks).every(Boolean));
  assert.equal(first.report.metadata.weightVersions["neural-personal-time"][0], BUNDLED_NEURAL_WEIGHTS.version);
  assert.ok(first.report.runs.filter(({ name }) => name === "neural-personal-time").every(({ result }) => result.control.neuralOutsidePersonalTime === 0));
});
