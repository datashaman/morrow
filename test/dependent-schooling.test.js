import assert from "node:assert/strict";
import test from "node:test";
import { MotivationCitizenPolicy } from "../src/citizen-policy.ts";
import { KNOWLEDGE_VOCATIONAL_DOMAINS, OPPORTUNITY_OBSERVATION_DAYS } from "../src/config.js";
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

test("school funding protects three days of guardian essentials and allocated dependent meals", () => {
  const town = new TownSimulation({ seed: 91, lifecycleEnabled: true });
  const dependent = town.createNewborn([0]);
  const guardian = town.people[0];
  dependent.lifecycleStage = "child";
  const school = { active: true, price: 4.5 };
  const reserve = town.guardianSchoolProtectedReserve(guardian);
  dependent.restrictedInheritance = 1.5;
  guardian.cash = reserve + 3;

  assert.equal(town.guardianCanFundSchool(guardian, dependent, school), true);
  guardian.cash = reserve + 2.99;
  assert.equal(town.guardianCanFundSchool(guardian, dependent, school), false);
  assert.equal(town.guardianSchoolProtectedReserve(guardian), reserve);
});

test("education need uses general skill and only the latest five scheduled lessons", () => {
  const town = new TownSimulation({ seed: 91, lifecycleEnabled: true });
  const dependent = town.createNewborn([0]);
  dependent.knowledgeProfile.general = 0.4;
  ["missed", "attended", "missed", "missed", "attended", "missed"].forEach((outcome) => {
    town.recordDependentSchool(dependent, outcome, { scheduled: true });
  });
  town.recordDependentSchool(dependent, "park", { scheduled: false });

  assert.equal(town.recentScheduledSchoolRecords(dependent).length, 5);
  assert.equal(town.dependentEducationNeed(dependent), 0.55 * 0.6 + 0.45 * 0.6);
});

test("a delivered dependent lesson exact-pays restricted funds, protected guardian cash, and finite assistance", () => {
  const town = new TownSimulation({ seed: 91, lifecycleEnabled: true, welfareMode: "combined", policy: { supportRate: 100, shockRisk: 0 } });
  town.people.forEach((person) => { person.cash = 100; person.skill = 0.3; person.knowledgeProfile.general = 0.3; });
  town.initialMoney = town.totalMoney();
  for (let day = 1; day <= OPPORTUNITY_OBSERVATION_DAYS; day += 1) { town.day = day; town.observeFirmOpportunities(); }
  const school = town.firms.find((firm) => firm.archetypeId === "school");
  const dependent = town.createNewborn([0]);
  const guardian = town.people[0];
  dependent.lifecycleStage = "child";
  dependent.restrictedInheritance = 1;
  guardian.cash = town.guardianSchoolProtectedReserve(guardian) + 1;
  school.inventory = 2;
  school.transactionsToday = 0;
  const moneyBefore = town.totalMoney();
  const schoolBefore = school.cash;

  const result = town.executeDependentSchooling(dependent, { schoolId: school.id, guardianId: guardian.id, attend: true });

  assert.equal(result.completed, true);
  assert.equal(dependent.restrictedInheritance, 0);
  assert.equal(guardian.cash, town.guardianSchoolProtectedReserve(guardian));
  assert.equal(school.cash, schoolBefore + school.price);
  assert.equal(dependent.skill, 0.05 + 0.004 * 0.95);
  assert.equal(dependent.schoolHistory[0].outcome, "attended");
  assert.equal(dependent.welfareHistory[0].treasuryContribution, school.price - 2);
  assert.equal(town.totalMoney(), moneyBefore);
});

test("a dependent who misses a funded lesson creates history but no school revenue", () => {
  const town = new TownSimulation({ seed: 91, lifecycleEnabled: true });
  const dependent = town.createNewborn([0]);
  const school = town.firms[0];
  const cashBefore = school.cash;
  const stockBefore = school.inventory;

  const result = town.executeDependentSchooling(dependent, { schoolId: school.id, guardianId: 0, attend: false });

  assert.equal(result.completed, true);
  assert.equal(dependent.schoolHistory[0].outcome, "missed");
  assert.equal(school.cash, cashBefore);
  assert.equal(school.inventory, stockBefore);
});
