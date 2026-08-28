import assert from "node:assert/strict";
import test from "node:test";
import { MotivationCitizenPolicy } from "../src/citizen-policy.ts";
import { KNOWLEDGE_VOCATIONAL_DOMAINS } from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

const profile = { comfort: 1, connection: 1, mastery: 1, security: 1, foodQuality: 1, planning: 1, avoidance: 1 };

test("guardian school funding weighs education need against protected-care scarcity and price", () => {
  const policy = new MotivationCitizenPolicy();
  const base = {
    kind: "dependent-school-funding",
    citizenId: 0,
    citizenName: "Guardian",
    dependentId: 40,
    dependentName: "Student",
    schoolId: 7,
    stress: 0.1,
    educationNeed: 0.9,
    careScarcity: 0.1,
    costPressure: 0.1,
    profile,
  };
  const legalActions = ["defer-dependent-school-funding", "fund-dependent-school:7"];

  assert.equal(policy.decide({ observation: base, legalActions, random: () => 0 }).action, "fund-dependent-school:7");
  assert.equal(policy.decide({ observation: { ...base, stress: 1, educationNeed: 0, careScarcity: 1, costPressure: 1 }, legalActions, random: () => 0 }).action, "defer-dependent-school-funding");
});

test("dependent attendance responds to education need, missed lessons, and physical barriers", () => {
  const policy = new MotivationCitizenPolicy();
  const base = {
    kind: "dependent-school-attendance",
    citizenId: 40,
    citizenName: "Student",
    schoolId: 7,
    educationNeed: 0.8,
    missedLessonRate: 0.6,
    hunger: 0,
    health: 0.9,
    sleepDebt: 0.1,
    stress: 0.1,
    reliability: 0.8,
    profile,
  };
  const legalActions = ["miss-dependent-school", "attend-dependent-school:7"];

  assert.equal(policy.decide({ observation: base, legalActions, random: () => 0 }).action, "attend-dependent-school:7");
  assert.equal(policy.decide({ observation: { ...base, educationNeed: 0, missedLessonRate: 0, hunger: 1, health: 0, sleepDebt: 1, stress: 1, reliability: 0, profile: { ...profile, mastery: 0.7, planning: 0.7, avoidance: 1.3 } }, legalActions, random: () => 0 }).action, "miss-dependent-school");
});

test("school funding and attendance ties retain the documented defer and miss actions", () => {
  const policy = new MotivationCitizenPolicy();
  const funding = {
    kind: "dependent-school-funding", citizenId: 0, citizenName: "Guardian", dependentId: 40, dependentName: "Child",
    schoolId: 7, stress: 0, educationNeed: 0, careScarcity: 0, costPressure: 0, profile: { ...profile, mastery: 0.35, planning: 0, connection: 0, security: 0, avoidance: 0 },
  };
  const attendance = {
    kind: "dependent-school-attendance", citizenId: 40, citizenName: "Child", schoolId: 7, educationNeed: 0, missedLessonRate: 0,
    hunger: 0, health: 1, sleepDebt: 0, stress: 0, reliability: 0, profile: { ...profile, mastery: 0, planning: 0, avoidance: 0 },
  };

  assert.equal(policy.decide({ observation: funding, legalActions: ["defer-dependent-school-funding", "fund-dependent-school:7"], random: () => 0 }).action, "defer-dependent-school-funding");
  assert.equal(policy.decide({ observation: attendance, legalActions: ["miss-dependent-school", "attend-dependent-school:7"], random: () => 0 }).action, "miss-dependent-school");
});

test("entering the student stage selects one stable canonical trade domain without consuming town randomness", () => {
  const first = new TownSimulation({ seed: 91, lifecycleEnabled: true });
  const second = new TownSimulation({ seed: 91, lifecycleEnabled: true });
  const a = first.createNewborn([0, 1]);
  const b = second.createNewborn([0, 1]);
  first.day = a.birthDay + 84;
  second.day = b.birthDay + 84;

  first.resolveLifecycleStages();
  second.resolveLifecycleStages();

  assert.equal(KNOWLEDGE_VOCATIONAL_DOMAINS.includes(a.studyDomain), true);
  assert.equal(a.studyDomain, b.studyDomain);
  assert.equal(a.studyDomainSelectionDay, first.day);
  const selected = a.studyDomain;
  first.day += 1;
  first.resolveLifecycleStages();
  assert.equal(a.studyDomain, selected);
  assert.equal(a.lifecycleHistory.filter((entry) => entry.type === "study-domain-selected").length, 1);
});
