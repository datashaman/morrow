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

test("grocery knowledge gives only the configured capped transaction-capacity bonus", () => {
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

  assert.equal(town.transactionCapacity(grocer), Math.floor(baseGroceryCapacity * (1 + GROCERY_KNOWLEDGE_CAPACITY_BONUS)));
  assert.equal(town.transactionCapacity(housing), baseHousingCapacity);
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
