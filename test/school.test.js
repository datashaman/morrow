import assert from "node:assert/strict";
import test from "node:test";
import {
  EDUCATION_RESERVE_DAYS,
  EDUCATION_SKILL_GAIN,
  EDUCATION_SKILL_THRESHOLD,
  OPPORTUNITY_OBSERVATION_DAYS,
  OPPORTUNITY_STARTUP_CAPITAL,
  RETAIL_COURSE_INVENTORY_TRANSFER_RATE,
  RETAIL_COURSE_LEARNING_RATE,
} from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

function prepareStudents(town, skill = 0.3) {
  town.people.forEach((person) => {
    person.cash = 100;
    person.health = 0.9;
    person.skill = skill;
    person.knowledgeProfile.general = skill;
  });
  town.initialMoney = town.totalMoney();
}

function observeSchoolWindow(town) {
  let result;
  for (let offset = 0; offset < OPPORTUNITY_OBSERVATION_DAYS; offset += 1) {
    town.day = offset + 1;
    const observed = town.observeFirmOpportunities();
    result = Array.isArray(observed) ? observed.find((entry) => entry.archetypeId === "school") : observed;
  }
  return result;
}

function foundSchool(seed = 42) {
  const town = new TownSimulation({ seed, policy: { shockRisk: 0 } });
  prepareStudents(town);
  return { town, school: observeSchoolWindow(town) };
}

test("Morrow School begins as an explicit finite education opportunity", () => {
  const town = new TownSimulation({ seed: 42 });
  const archetype = town.firmArchetype("school");
  const opportunity = town.firmOpportunities().find((entry) => entry.archetypeId === "school");

  assert.equal(archetype.sells, "education");
  assert.equal(archetype.production, "direct");
  assert.equal(archetype.transactionsPerWorker, 5);
  assert.equal(town.firms.some((firm) => firm.archetypeId === "school"), false);
  assert.equal(opportunity.ready, false);
});

test("a town without eligible solvent students cannot found a school", () => {
  const town = new TownSimulation({ seed: 42 });
  prepareStudents(town, EDUCATION_SKILL_THRESHOLD);

  const opportunity = observeSchoolWindow(town);

  assert.equal(opportunity.expectedDailyDemand, 0);
  assert.equal(opportunity.ready, false);
  assert.match(opportunity.reasons.join(" "), /demand does not cover/);
});

test("sustained student demand founds a one-teacher school with exact capital", () => {
  const town = new TownSimulation({ seed: 42 });
  prepareStudents(town);
  const totalBefore = town.totalMoney();
  const founder = town.founderCandidates()[0];
  const founderBefore = founder.cash;

  const school = observeSchoolWindow(town);

  assert.equal(school.instanceId, "school:1");
  assert.equal(school.owner, founder.id);
  assert.equal(school.foundingDay, OPPORTUNITY_OBSERVATION_DAYS);
  assert.equal(school.cash, OPPORTUNITY_STARTUP_CAPITAL);
  assert.equal(founder.cash, founderBefore - OPPORTUNITY_STARTUP_CAPITAL);
  assert.deepEqual(school.employees, [founder.id]);
  assert.deepEqual(town.contracts.filter((contract) => contract.buyerId === school.id).map((contract) => contract.supplier), ["Makers Guild"]);
  assert.equal(town.totalMoney(), totalBefore);
  town.assertInvariants();
});

test("a paid lesson transfers exact cash and gradually raises bounded skill", () => {
  const { town, school } = foundSchool();
  const student = town.people.find((person) => person.id !== school.owner);
  student.cash = 30;
  student.skill = 0.3;
  student.knowledgeProfile.general = 0.3;
  student.stress = 0;
  student.motivationProfile = { ...student.motivationProfile, mastery: 1.3, planning: 1.3, security: 0.7, avoidance: 0.7 };
  school.inventory = 2;
  town.initialMoney = town.totalMoney();
  const studentBefore = student.cash;
  const schoolBefore = school.cash;

  assert.equal(town.considerEducation(student, school), true);
  assert.equal(student.cash, studentBefore - school.price);
  assert.equal(school.cash, schoolBefore + school.price);
  assert.equal(school.inventory, 1);
  assert.equal(student.skill, 0.3 + EDUCATION_SKILL_GAIN);
  assert.equal(student.knowledgeProfile.general, student.skill);
  assert.equal(student.knowledgeProfile.retail, RETAIL_COURSE_LEARNING_RATE);
  assert.equal(student.knowledgeProfile.inventory, RETAIL_COURSE_INVENTORY_TRANSFER_RATE);
  assert.deepEqual(student.learningHistory.map(({ source, sourceName, domain, rule }) => ({ source, sourceName, domain, rule })), [
    { source: "education", sourceName: school.name, domain: "inventory", rule: "paid-retail-course-inventory-transfer-v1" },
    { source: "education", sourceName: school.name, domain: "retail", rule: "paid-retail-course-retail-v1" },
    { source: "education", sourceName: school.name, domain: "general", rule: "paid-retail-course-general-skill-v1" },
  ]);
  assert.ok(student.learningHistory.every((record) => record.phase === "Personal time" && record.after > record.before));
  assert.equal(student.educationSeller, school.id);
  assert.match(student.ledger[0].text, /bought 1 lesson from Morrow School/);
  assert.equal(student.decisions[0].kind, "education");
  assert.match(student.events[0].text, /retail operations course raised skill/);
  town.assertInvariants();
});

test("education protects essential reserves and cannot create a partial purchase", () => {
  const { town, school } = foundSchool();
  const student = town.people.find((person) => person.id !== school.owner);
  const reserve = town.essentialCost() * EDUCATION_RESERVE_DAYS;
  student.cash = school.price + reserve - 0.01;
  student.skill = 0.3;
  student.knowledgeProfile.general = 0.3;
  school.inventory = 2;
  const before = { cash: student.cash, skill: student.skill, knowledge: structuredClone(student.knowledgeProfile), learning: structuredClone(student.learningHistory), stock: school.inventory };

  assert.equal(town.considerEducation(student, school), false);
  assert.deepEqual({ cash: student.cash, skill: student.skill, knowledge: student.knowledgeProfile, learning: student.learningHistory, stock: school.inventory }, before);
  assert.deepEqual(student.decisions[0].legalActions, ["defer-education"]);
});

test("one attending teacher enforces finite daily lesson capacity", () => {
  const { town, school } = foundSchool();
  school.inventory = 10;
  town.people[school.owner].attended = true;
  const students = town.people.filter((person) => person.id !== school.owner).slice(0, 6);
  students.forEach((student) => {
    student.cash = 100;
    student.skill = 0.3;
    student.stress = 0;
    student.motivationProfile = { ...student.motivationProfile, mastery: 1.3, planning: 1.3, security: 0.7, avoidance: 0.7 };
  });

  const results = students.map((student) => town.considerEducation(student, school));

  assert.deepEqual(results, [true, true, true, true, true, false]);
  assert.equal(school.transactionsToday, 5);
  assert.equal(school.inventory, 5);
});

test("school insolvency removes its teaching job and ends maintenance supply", () => {
  const { town, school } = foundSchool();
  const teacher = town.people[school.owner];

  town.closeFirm(school, "school fees could not sustain operations");

  assert.equal(school.active, false);
  assert.equal(teacher.employer, -1);
  assert.equal(school.employees.length, 0);
  assert.equal(town.contracts.filter((contract) => contract.buyerId === school.id && contract.active).length, 0);
  assert.match(teacher.events[0].text, /business insolvency ended employment/);
});

test("school formation and teacher selection reproduce from the same seed", () => {
  const first = foundSchool(404);
  const second = foundSchool(404);
  assert.deepEqual(
    { owner: first.school.owner, day: first.school.foundingDay, staff: first.school.employees },
    { owner: second.school.owner, day: second.school.foundingDay, staff: second.school.employees },
  );
});
