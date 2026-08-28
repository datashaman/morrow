import assert from "node:assert/strict";
import test from "node:test";
import { citizenLifecycleEvidence, citizenSelectorOptions, lifecycleEventLabel, nextLifecycleTransition } from "../src/lifecycle-presentation.js";
import { TownSimulation } from "../src/simulation.js";

test("dependent lifecycle evidence exposes transitions, family, guardians, school, and study state", () => {
  const town = new TownSimulation({ seed: 58, lifecycleEnabled: true });
  const dependent = town.createNewborn([0, 1]);
  dependent.lifecycleStage = "student";
  dependent.birthDay = 1;
  town.day = 90;
  dependent.ageDays = 89;
  dependent.studyDomain = "teaching";
  town.recordDependentSchool(dependent, "missed", { school: { id: 8, name: "Morrow School" }, guardian: town.people[0] });
  town.gestations.push({ id: 99, status: "active", parentIds: [0, 1], dueDay: 110 });

  const evidence = citizenLifecycleEvidence(dependent, { people: town.people, gestations: town.gestations, day: town.day });

  assert.equal(evidence.stageLabel, "Student");
  assert.deepEqual(nextLifecycleTransition(dependent, town.day), { ageDays: 89, nextStage: "adult", transitionDay: 169, daysRemaining: 79 });
  assert.deepEqual(evidence.parentNames, [town.people[0].name, town.people[1].name]);
  assert.deepEqual(evidence.guardianNames, [town.people[0].name, town.people[1].name]);
  assert.equal(evidence.residentialGuardianName, town.people[0].name);
  assert.equal(evidence.latestLesson.outcome, "missed");
  assert.equal(evidence.missedLessons, 1);
});

test("adult lifecycle evidence exposes partner, children, dependents, gestation, and cooldown", () => {
  const town = new TownSimulation({ seed: 58, lifecycleEnabled: true });
  const adult = town.people[0];
  const partner = town.people[1];
  adult.partnerId = partner.id;
  partner.partnerId = adult.id;
  const child = town.createNewborn([adult.id, partner.id]);
  town.gestations.push({ id: 99, status: "active", parentIds: [adult.id, partner.id], dueDay: 40 });

  const evidence = citizenLifecycleEvidence(adult, { people: town.people, gestations: town.gestations, day: town.day });

  assert.equal(evidence.partnerName, partner.name);
  assert.deepEqual(evidence.childNames, [child.name]);
  assert.deepEqual(evidence.dependentNames, [child.name]);
  assert.equal(evidence.activeGestationDueDay, 40);
});

test("selector and lifecycle labels retain stage, death, and structured event identity", () => {
  const people = [
    { id: 0, name: "Amina", alive: true, lifecycleStage: "adult", deathDay: null },
    { id: 1, name: "River", alive: true, lifecycleStage: "child", deathDay: null },
    { id: 2, name: "Jonah", alive: false, lifecycleStage: "adult", deathDay: 12 },
  ];

  assert.deepEqual(citizenSelectorOptions(people).map(({ label }) => label), ["Amina · Adult", "River · Child", "Jonah · Died D12"]);
  assert.equal(lifecycleEventLabel("study-domain-selected"), "Study Domain Selected");
});
