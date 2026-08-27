import assert from "node:assert/strict";
import test from "node:test";
import {
  GROCERY_KNOWLEDGE_CAPACITY_BONUS,
  INVENTORY_WORK_LEARNING_RATE,
  KNOWLEDGE_SCHEMA_VERSION,
  KNOWLEDGE_VOCATIONAL_DOMAINS,
  RETAIL_WORK_LEARNING_RATE,
} from "../src/config.js";
import { createKnowledgeProfile, migrateKnowledgeProfile, validateFirmKnowledgeConfig } from "../src/knowledge.js";
import { TownSimulation } from "../src/simulation.js";

test("citizens begin with versioned general knowledge and no vocational knowledge", () => {
  const town = new TownSimulation({ seed: 42 });

  town.people.forEach((person) => {
    assert.deepEqual(person.knowledgeProfile, createKnowledgeProfile(person.skill));
    assert.equal(person.knowledgeProfile.version, KNOWLEDGE_SCHEMA_VERSION);
    assert.ok(KNOWLEDGE_VOCATIONAL_DOMAINS.every((domain) => person.knowledgeProfile[domain] === 0));
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
  assert.equal(worker.knowledgeProfile.retailOperations, RETAIL_WORK_LEARNING_RATE);
  assert.equal(worker.knowledgeProfile.inventoryHandling, INVENTORY_WORK_LEARNING_RATE);
  assert.deepEqual(worker.learningHistory.map(({ source, sourceId, sourceName, domain, before, rule }) => ({ source, sourceId, sourceName, domain, before, rule })), [
    { source: "workplace", sourceId: grocer.id, sourceName: grocer.name, domain: "inventoryHandling", before: 0, rule: "attended-grocery-shift-inventory-v1" },
    { source: "workplace", sourceId: grocer.id, sourceName: grocer.name, domain: "retailOperations", before: 0, rule: "attended-grocery-shift-retail-v1" },
  ]);
  assert.ok(worker.learningHistory.every((record) => record.day === town.day && record.phase === "Production" && record.after > record.before));
});

test("absence and a worker from an unrelated workplace create no vocational learning", () => {
  const town = new TownSimulation({ seed: 42 });
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  const housing = town.firms.find((firm) => firm.archetypeId === "housing-provider");
  const grocerWorker = town.people[grocer.employees[0]];
  const housingWorker = town.people[housing.employees[0]];
  grocerWorker.attended = false;
  housingWorker.attended = true;

  assert.deepEqual(town.applyWorkplaceLearning(grocerWorker, grocer), []);
  assert.deepEqual(town.applyWorkplaceLearning(housingWorker, grocer), []);
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
    town.people[id].knowledgeProfile.retailOperations = 1;
    town.people[id].knowledgeProfile.inventoryHandling = 1;
  });
  housing.employees.forEach((id) => {
    town.people[id].knowledgeProfile.retailOperations = 1;
    town.people[id].knowledgeProfile.inventoryHandling = 1;
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
    town.people[id].knowledgeProfile.retailOperations = 0.2;
    town.people[id].knowledgeProfile.inventoryHandling = 0.2;
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
    town.people[id].knowledgeProfile.retailOperations = 0.2;
    town.people[id].knowledgeProfile.inventoryHandling = 0.2;
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
    town.people[id].knowledgeProfile.retailOperations = 1;
    town.people[id].knowledgeProfile.inventoryHandling = 1;
  });
  housing.employees.forEach((id) => {
    town.people[id].attended = true;
    town.people[id].knowledgeProfile.retailOperations = 1;
    town.people[id].knowledgeProfile.inventoryHandling = 1;
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
    disabled.people[id].knowledgeProfile.retailOperations = 1;
    disabled.people[id].knowledgeProfile.inventoryHandling = 1;
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
    town.people[id].knowledgeProfile.retailOperations = 1;
    town.people[id].knowledgeProfile.inventoryHandling = 1;
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
  assert.ok(first.profile.retailOperations <= 1 && first.profile.inventoryHandling <= 1);
  assert.ok(first.profile.retailOperations > first.profile.inventoryHandling);
});

test("knowledge-v1 profiles migrate deterministically and knowledge-v2 migration is idempotent", () => {
  const legacy = { version: "knowledge-v1", general: 0.6, retail: 0.4, inventory: 0.2 };
  const migrated = migrateKnowledgeProfile(legacy);

  assert.equal(migrated.version, KNOWLEDGE_SCHEMA_VERSION);
  assert.equal(migrated.general, 0.6);
  assert.equal(migrated.retailOperations, 0.4);
  assert.equal(migrated.inventoryHandling, 0.2);
  assert.ok(KNOWLEDGE_VOCATIONAL_DOMAINS.slice(2).every((domain) => migrated[domain] === 0));
  assert.deepEqual(migrateKnowledgeProfile(migrated), migrated);
  assert.throws(() => migrateKnowledgeProfile({ ...migrated, version: "knowledge-v3" }), /Unsupported knowledge profile version/);
});

test("every firm archetype has a complete compatible knowledge declaration", () => {
  const town = new TownSimulation({ seed: 42 });
  assert.ok(town.firms.every((firm) => validateFirmKnowledgeConfig(firm)));
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  assert.deepEqual(grocer.knowledge.domains.map(({ id, weight }) => ({ id, weight })), [
    { id: "retailOperations", weight: 0.5 },
    { id: "inventoryHandling", weight: 0.5 },
  ]);
});

test("knowledge declarations reject missing, unknown, unbalanced, out-of-bounds, and incompatible fields", () => {
  const town = new TownSimulation({ seed: 42 });
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  const copy = () => structuredClone(grocer);
  assert.throws(() => validateFirmKnowledgeConfig({ ...copy(), knowledge: null }), /Missing knowledge configuration/);
  assert.throws(() => validateFirmKnowledgeConfig({ ...copy(), knowledge: { ...copy().knowledge, domains: [{ ...copy().knowledge.domains[0], id: "unknown" }] } }), /Unknown knowledge domain/);
  assert.throws(() => validateFirmKnowledgeConfig({ ...copy(), knowledge: { ...copy().knowledge, domains: copy().knowledge.domains.map((domain) => ({ ...domain, weight: 0.4 })) } }), /sum to one/);
  assert.throws(() => validateFirmKnowledgeConfig({ ...copy(), knowledge: { ...copy().knowledge, maxBonus: 1.1 } }), /maximum bonus/);
  assert.throws(() => validateFirmKnowledgeConfig({ ...copy(), knowledge: { ...copy().knowledge, effectType: "direct-yield" } }), /incompatible/);
});

test("every configured workplace teaches its declared domains before same-day effects", () => {
  const town = new TownSimulation({ seed: 42 });
  town.firms.forEach((firm) => {
    const worker = town.people[firm.employees[0]];
    worker.attended = true;
    const records = town.applyWorkplaceLearning(worker, firm);
    assert.deepEqual(records.map((record) => record.domain), firm.knowledge.domains.map((domain) => domain.id));
    firm.knowledge.domains.forEach((domain) => assert.equal(worker.knowledgeProfile[domain.id], domain.workplaceLearningRate));
  });
});
