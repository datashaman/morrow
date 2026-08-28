import assert from "node:assert/strict";
import test from "node:test";
import { TownSimulation } from "../src/simulation.js";

const sleepPolicy = {
  id: "sleep-fixture",
  decide({ legalActions }) {
    return { action: legalActions[0], reasons: ["fixture"], scores: {} };
  },
};

const lateStudyPolicy = {
  id: "late-study-fixture",
  decide({ observation, legalActions }) {
    const preferred = observation.kind === "sleep" ? "late-self-study" : legalActions[0];
    return { action: legalActions.includes(preferred) ? preferred : legalActions[0], reasons: ["fixture"], scores: {} };
  },
};

test("sleep quality and debt follow the bounded overnight formula", () => {
  const town = new TownSimulation({ seed: 42, sleepEnabled: true, citizenPolicy: sleepPolicy });
  const person = town.people[0];
  person.housed = false;
  person.hungryDays = 1;
  person.stress = 0.8;
  person.sleepDebt = 0.2;

  const record = town.resolveSleep(person);

  assert.equal(record.action, "sleep");
  assert.equal(record.sleepQuality, 0.3);
  assert.equal(record.debtBefore, 0.2);
  assert.equal(record.debtAfterAccrual, 0.45);
  assert.equal(Math.round(record.debtAfter * 100), 36);
  assert.equal(person.lastSleepQuality, 0.3);
  assert.equal(person.sleepHistory[0], record);
  assert.match(person.events[0].text, /poor sleep increased sleep debt/);
});

test("legal late study preserves the existing self-study benefit but repays no debt", () => {
  const town = new TownSimulation({ seed: 42, sleepEnabled: true, citizenPolicy: lateStudyPolicy });
  const person = town.people[0];
  person.focus = "growth";
  person.hungryDays = 0;
  person.health = 0.8;
  person.stress = 0.1;
  person.sleepDebt = 0.1;
  const beforeSkill = person.skill;
  const beforeGrowth = person.growth;

  const record = town.resolveSleep(person);

  assert.equal(record.action, "late-self-study");
  assert.equal(record.debtAfter, 0.35);
  assert.equal(person.lastSleepQuality, null);
  assert.equal(person.skill, beforeSkill + 0.003);
  assert.equal(person.growth, beforeGrowth + 0.006);
  assert.match(person.events[0].text, /late self-study instead of sleep/);
});

test("late study is excluded when hunger, health, debt, or focus makes it illegal", () => {
  const town = new TownSimulation({ seed: 42, sleepEnabled: true, citizenPolicy: lateStudyPolicy });
  const person = town.people[0];
  person.focus = "growth";
  person.hungryDays = 1;
  person.health = 0.8;
  person.sleepDebt = 0.1;

  const record = town.resolveSleep(person);

  assert.equal(record.action, "sleep");
  const decision = person.decisions.find((candidate) => candidate.kind === "sleep");
  assert.deepEqual(decision.legalActions, ["sleep"]);
});

test("dependents sleep automatically and never receive a late-study action", () => {
  const rejectingPolicy = {
    id: "reject-dependent-sleep-policy",
    decide({ observation, legalActions }) {
      if (observation.kind === "sleep") throw new Error("dependent sleep reached citizen policy");
      return { action: legalActions[0], reasons: ["fixture"] };
    },
  };
  const town = new TownSimulation({ seed: 42, lifecycleEnabled: true, sleepEnabled: true, citizenPolicy: rejectingPolicy });
  const dependent = town.createNewborn([0, 1]);
  dependent.focus = "growth";
  dependent.sleepDebt = 0.1;
  const skillBefore = dependent.skill;

  const record = town.resolveSleep(dependent);

  assert.equal(record.action, "sleep");
  assert.equal(dependent.decisions[0].policy, "dependent-sleep-v1");
  assert.deepEqual(dependent.decisions[0].legalActions, ["sleep"]);
  assert.equal(dependent.skill, skillBefore);
  assert.ok(dependent.sleepDebt < 0.35);
});

test("sleep debt lowers physiological need, raises stress pressure, and causes bounded health loss", () => {
  const town = new TownSimulation({ seed: 42, sleepEnabled: true, citizenPolicy: sleepPolicy });
  const person = town.people[0];
  person.sleepDebt = 1;
  person.health = 0.8;
  person.hungryDays = 0;
  person.housed = true;
  const reliabilityBefore = person.reliability;
  const physiologicalWithDebt = town.assessNeeds(person).physiological;
  const pressureWithDebt = town.stressPressure(person);
  const loss = town.applySleepDebtConsequences(person);

  town.sleepEnabled = false;
  person.health = 0.8;
  const physiologicalWithoutDebt = town.assessNeeds(person).physiological;
  const pressureWithoutDebt = town.stressPressure(person);

  assert.equal(Math.round((physiologicalWithoutDebt - physiologicalWithDebt) * 100), 30);
  assert.equal(Math.round((pressureWithDebt - pressureWithoutDebt) * 100), 14);
  assert.equal(Math.round(loss * 1_000), 6);
  assert.equal(person.reliability, reliabilityBefore);
});

test("fourteen overnight records replay exactly, remain bounded, and conserve cash", () => {
  const run = () => {
    const town = new TownSimulation({ seed: 42, sleepEnabled: true, citizenPolicy: lateStudyPolicy });
    const initialMoney = town.totalMoney();
    for (let day = 1; day <= 14; day += 1) {
      town.day = day;
      town.people.forEach((person) => {
        person.focus = "growth";
        town.resolveSleep(person);
      });
    }
    return {
      initialMoney,
      money: town.totalMoney(),
      people: town.people.map((person) => ({ debt: person.sleepDebt, history: person.sleepHistory })),
    };
  };

  const first = run();
  const replay = run();
  assert.deepEqual(first, replay);
  assert.equal(first.money, first.initialMoney);
  assert.ok(first.people.every((person) => person.debt >= 0 && person.debt <= 1 && person.history.length === 14));
});

test("disabled sleep is behavior-neutral and reset clears all overnight state", () => {
  const town = new TownSimulation({ seed: 42, sleepEnabled: false, citizenPolicy: sleepPolicy });
  const person = town.people[0];
  const before = { debt: person.sleepDebt, health: person.health, decisions: person.decisions.length };

  assert.equal(town.resolveSleep(person), null);
  assert.deepEqual({ debt: person.sleepDebt, health: person.health, decisions: person.decisions.length }, before);

  town.sleepEnabled = true;
  town.resolveSleep(person);
  assert.equal(person.sleepHistory.length, 1);
  town.reset();
  assert.equal(town.people[0].sleepDebt, 0);
  assert.equal(town.people[0].lastSleepQuality, null);
  assert.deepEqual(town.people[0].sleepHistory, []);
});
