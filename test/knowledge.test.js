import assert from "node:assert/strict";
import test from "node:test";
import {
  GROCERY_KNOWLEDGE_CAPACITY_BONUS,
  INVENTORY_WORK_LEARNING_RATE,
  KNOWLEDGE_SCHEMA_VERSION,
  RETAIL_WORK_LEARNING_RATE,
} from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

test("citizens begin with versioned general knowledge and no vocational knowledge", () => {
  const town = new TownSimulation({ seed: 42 });

  town.people.forEach((person) => {
    assert.deepEqual(person.knowledgeProfile, {
      version: KNOWLEDGE_SCHEMA_VERSION,
      general: person.skill,
      retail: 0,
      inventory: 0,
    });
    assert.deepEqual(person.learningHistory, []);
  });
  town.firms.forEach((firm) => {
    assert.equal(firm.knowledgeCapacityCarry, 0);
    assert.equal(firm.knowledgeCapacitySlotsToday, 0);
    assert.equal(firm.lastKnowledgeCapacityDay, null);
  });
});

test("an attended grocery shift records bounded retail and inventory learning", () => {
  const town = new TownSimulation({ seed: 42 });
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  const worker = town.people[grocer.employees[0]];
  worker.attended = true;

  const records = town.applyWorkplaceLearning(worker, grocer);

  assert.equal(records.length, 2);
  assert.equal(worker.knowledgeProfile.retail, RETAIL_WORK_LEARNING_RATE);
  assert.equal(worker.knowledgeProfile.inventory, INVENTORY_WORK_LEARNING_RATE);
  assert.deepEqual(worker.learningHistory.map(({ source, sourceId, sourceName, domain, before, rule }) => ({ source, sourceId, sourceName, domain, before, rule })), [
    { source: "workplace", sourceId: grocer.id, sourceName: grocer.name, domain: "inventory", before: 0, rule: "attended-grocery-shift-inventory-v1" },
    { source: "workplace", sourceId: grocer.id, sourceName: grocer.name, domain: "retail", before: 0, rule: "attended-grocery-shift-retail-v1" },
  ]);
  assert.ok(worker.learningHistory.every((record) => record.day === town.day && record.phase === "Production" && record.after > record.before));
});

test("absence and unrelated work create no vocational learning", () => {
  const town = new TownSimulation({ seed: 42 });
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  const housing = town.firms.find((firm) => firm.archetypeId === "housing-provider");
  const grocerWorker = town.people[grocer.employees[0]];
  const housingWorker = town.people[housing.employees[0]];
  grocerWorker.attended = false;
  housingWorker.attended = true;

  assert.deepEqual(town.applyWorkplaceLearning(grocerWorker, grocer), []);
  assert.deepEqual(town.applyWorkplaceLearning(housingWorker, housing), []);
  assert.deepEqual(grocerWorker.learningHistory, []);
  assert.deepEqual(housingWorker.learningHistory, []);
});

test("grocery knowledge accumulates a bounded contribution into whole daily slots", () => {
  const town = new TownSimulation({ seed: 42 });
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  const housing = town.firms.find((firm) => firm.archetypeId === "housing-provider");
  [...grocer.employees, ...housing.employees].forEach((id) => { town.people[id].attended = true; });
  const baseGroceryCapacity = grocer.employees.length * grocer.transactionsPerWorker;
  const baseHousingCapacity = housing.employees.length * housing.transactionsPerWorker;

  assert.equal(town.transactionCapacity(grocer), baseGroceryCapacity);
  grocer.employees.forEach((id) => {
    town.people[id].knowledgeProfile.retail = 1;
    town.people[id].knowledgeProfile.inventory = 1;
  });
  housing.employees.forEach((id) => {
    town.people[id].knowledgeProfile.retail = 1;
    town.people[id].knowledgeProfile.inventory = 1;
  });

  const moneyBefore = town.totalMoney();
  assert.equal(town.accrueKnowledgeCapacity(grocer), Math.floor(baseGroceryCapacity * GROCERY_KNOWLEDGE_CAPACITY_BONUS));
  assert.equal(grocer.knowledgeCapacityCarry, 0.3);
  assert.equal(town.transactionCapacity(grocer), Math.floor(baseGroceryCapacity * (1 + GROCERY_KNOWLEDGE_CAPACITY_BONUS)));
  assert.equal(town.transactionCapacity(housing), baseHousingCapacity);
  assert.equal(town.totalMoney(), moneyBefore);
  assert.match(grocer.events[0].text, /worker knowledge made 6 extra transaction slots available; 30.0% carry remains/);
});

test("knowledge capacity accrues once per day and capacity reads are pure", () => {
  const town = new TownSimulation({ seed: 42 });
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  grocer.employees.forEach((id) => {
    town.people[id].attended = true;
    town.people[id].knowledgeProfile.retail = 0.2;
    town.people[id].knowledgeProfile.inventory = 0.2;
  });

  assert.equal(town.accrueKnowledgeCapacity(grocer), 1);
  const accrued = { carry: grocer.knowledgeCapacityCarry, slots: grocer.knowledgeCapacitySlotsToday, events: grocer.events.length };
  assert.equal(town.accrueKnowledgeCapacity(grocer), accrued.slots);
  assert.equal(town.transactionCapacity(grocer), grocer.employees.length * grocer.transactionsPerWorker + 1);
  assert.equal(town.transactionCapacity(grocer), grocer.employees.length * grocer.transactionsPerWorker + 1);
  assert.deepEqual({ carry: grocer.knowledgeCapacityCarry, slots: grocer.knowledgeCapacitySlotsToday, events: grocer.events.length }, accrued);

  town.day += 1;
  assert.equal(town.accrueKnowledgeCapacity(grocer), 1);
  assert.equal(grocer.knowledgeCapacityCarry, 0.52);
  grocer.cash = 1_000;
  town.initialMoney = town.totalMoney();
  town.finishFirmSettlement(grocer);
  assert.equal(grocer.knowledgeCapacitySlotsToday, 0);
  assert.equal(grocer.knowledgeCapacityCarry, 0.52);
});

test("production accrues capacity after attended workplace learning", () => {
  const citizenPolicy = {
    id: "always-attend-test",
    decide: ({ observation, legalActions }) => ({
      action: observation.kind === "attendance" ? "attend-shift" : legalActions[0],
      reasons: ["test policy"],
    }),
  };
  const town = new TownSimulation({ seed: 42, citizenPolicy });
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");

  town.productionPhase();

  assert.equal(grocer.lastKnowledgeCapacityDay, town.day);
  assert.ok(grocer.knowledgeCapacityCarry > 0);
  assert.ok(grocer.employees.every((id) => town.people[id].learningHistory.length === 2));
  const before = { carry: grocer.knowledgeCapacityCarry, slots: grocer.knowledgeCapacitySlotsToday };
  town.accrueKnowledgeCapacity(grocer);
  assert.deepEqual({ carry: grocer.knowledgeCapacityCarry, slots: grocer.knowledgeCapacitySlotsToday }, before);
});

test("an earned knowledge slot can serve one additional transaction that day", () => {
  const town = new TownSimulation({ seed: 42 });
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  const shopper = town.people.find((person) => !grocer.employees.includes(person.id));
  grocer.employees.forEach((id) => {
    town.people[id].attended = true;
    town.people[id].knowledgeProfile.retail = 0.2;
    town.people[id].knowledgeProfile.inventory = 0.2;
  });
  town.accrueKnowledgeCapacity(grocer);
  const scalarCapacity = grocer.employees.length * grocer.transactionsPerWorker;
  grocer.transactionsToday = scalarCapacity;

  assert.equal(town.requestTransaction(grocer, shopper, "food"), true);
  assert.equal(town.requestTransaction(grocer, shopper, "food"), false);
  assert.equal(grocer.transactionsToday, scalarCapacity + 1);
  assert.match(shopper.events[0].text, /no staffed capacity/);
});

test("absence, unrelated sectors, inactive firms, and disabled knowledge accrue no capacity", () => {
  const town = new TownSimulation({ seed: 42 });
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  const housing = town.firms.find((firm) => firm.archetypeId === "housing-provider");
  grocer.knowledgeCapacityCarry = 0.4;
  grocer.employees.forEach((id) => {
    town.people[id].attended = false;
    town.people[id].knowledgeProfile.retail = 1;
    town.people[id].knowledgeProfile.inventory = 1;
  });
  housing.employees.forEach((id) => {
    town.people[id].attended = true;
    town.people[id].knowledgeProfile.retail = 1;
    town.people[id].knowledgeProfile.inventory = 1;
  });

  assert.equal(town.accrueKnowledgeCapacity(grocer), 0);
  assert.equal(grocer.knowledgeCapacityCarry, 0.4);
  assert.equal(town.accrueKnowledgeCapacity(housing), 0);
  assert.equal(housing.knowledgeCapacityCarry, 0);
  town.day += 1;
  grocer.active = false;
  assert.equal(town.accrueKnowledgeCapacity(grocer), 0);
  assert.equal(grocer.knowledgeCapacityCarry, 0.4);

  const disabled = new TownSimulation({ seed: 42, knowledgeEnabled: false });
  const disabledGrocer = disabled.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  disabledGrocer.employees.forEach((id) => {
    disabled.people[id].attended = true;
    disabled.people[id].knowledgeProfile.retail = 1;
    disabled.people[id].knowledgeProfile.inventory = 1;
  });
  assert.equal(disabled.accrueKnowledgeCapacity(disabledGrocer), 0);
  assert.equal(disabled.transactionCapacity(disabledGrocer), disabledGrocer.employees.length * disabledGrocer.transactionsPerWorker);
});

test("knowledge can be disabled for a scalar-skill baseline without changing money", () => {
  const town = new TownSimulation({ seed: 42, knowledgeEnabled: false });
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  const worker = town.people[grocer.employees[0]];
  grocer.employees.forEach((id) => {
    town.people[id].attended = true;
    town.people[id].knowledgeProfile.retail = 1;
    town.people[id].knowledgeProfile.inventory = 1;
  });
  const moneyBefore = town.totalMoney();

  assert.deepEqual(town.applyWorkplaceLearning(worker, grocer), []);
  assert.equal(town.accrueKnowledgeCapacity(grocer), 0);
  assert.equal(town.transactionCapacity(grocer), grocer.employees.length * grocer.transactionsPerWorker);
  assert.equal(town.totalMoney(), moneyBefore);
});

test("knowledge updates remain bounded and reproduce from the same state", () => {
  const learn = () => {
    const town = new TownSimulation({ seed: 404 });
    const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
    const worker = town.people[grocer.employees[0]];
    worker.attended = true;
    for (let day = 1; day <= 2_000; day += 1) {
      town.day = day;
      town.applyWorkplaceLearning(worker, grocer);
    }
    return { profile: worker.knowledgeProfile, history: worker.learningHistory };
  };

  const first = learn();
  const second = learn();
  assert.deepEqual(first, second);
  assert.ok(first.profile.retail <= 1 && first.profile.inventory <= 1);
  assert.ok(first.profile.retail > first.profile.inventory);
});
