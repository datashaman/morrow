import assert from "node:assert/strict";
import test from "node:test";
import { TownSimulation } from "../src/simulation.js";

function replacePerishableStock(town, firm, quantity, batchDay) {
  firm.inventory = 0;
  firm.inventoryBatches = [];
  firm.inventoryBatchSequence = 0;
  town.addFirmInventory(firm, quantity, { batchDay });
}

test("three-day produce is usable at ages zero through two and expires in morning Planning at age three", () => {
  const town = new TownSimulation({ seed: 42 });
  const farm = town.firms.find((firm) => firm.archetypeId === "farm");
  replacePerishableStock(town, farm, 4, 1);

  town.day = 3;
  town.planningPhase();
  assert.equal(farm.inventory, 4);
  assert.deepEqual(farm.wasteHistory, []);

  town.day = 4;
  town.planningPhase();
  assert.equal(farm.inventory, 0);
  assert.deepEqual(farm.wasteHistory.map(({ product, quantity, batchDay, age, reason }) => ({ product, quantity, batchDay, age, reason })), [{
    product: "produce",
    quantity: 4,
    batchDay: 1,
    age: 3,
    reason: "expired at shelf-life boundary",
  }]);
});

test("perishable firm inventory is removed oldest viable batch first", () => {
  const town = new TownSimulation({ seed: 42 });
  const farm = town.firms.find((firm) => firm.archetypeId === "farm");
  replacePerishableStock(town, farm, 2, 1);
  town.addFirmInventory(farm, 3, { batchDay: 2 });

  const taken = town.takeFirmInventory(farm, 4);

  assert.deepEqual(taken.map(({ quantity, batchDay }) => ({ quantity, batchDay })), [
    { quantity: 2, batchDay: 1 },
    { quantity: 2, batchDay: 2 },
  ]);
  assert.equal(farm.inventory, 1);
  assert.deepEqual(farm.inventoryBatches.map(({ quantity, batchDay }) => ({ quantity, batchDay })), [{ quantity: 1, batchDay: 2 }]);
});

test("purchased food preserves its processing day, effective quality, and expiry boundary", () => {
  const town = new TownSimulation({ seed: 42 });
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  const person = town.people.find((candidate) => candidate.employer < 0);
  replacePerishableStock(town, grocer, 2, 1);
  town.day = 2;
  person.cash = 100;
  grocer.employees.forEach((id) => { town.people[id].attended = true; });

  assert.ok(town.buy(person, grocer, 2, "food") > 0);
  assert.equal(person.foodStock.length, 2);
  assert.ok(person.foodStock.every((meal) => meal.processedDay === 1 && meal.purchasedDay === 2 && meal.shelfLife === 3));
  assert.ok(person.foodStock.every((meal) => meal.qualityAtPurchase === town.effectiveFoodQuality(meal)));

  town.day = 4;
  town.planningPhase();
  assert.equal(person.foodStock.length, 0);
  assert.equal(person.wasteHistory[0].reason, "expired in citizen pantry");
});

test("citizens consume the oldest viable stored meal first", () => {
  const citizenPolicy = {
    id: "fifo-food-test",
    decide({ legalActions }) {
      return { action: legalActions.find((action) => action.startsWith("eat-stored-food:")) ?? legalActions[0], reasons: [], scores: {} };
    },
  };
  const town = new TownSimulation({ seed: 42, citizenPolicy });
  const person = town.people[0];
  person.foodStock = [
    { product: "budgetFood", processedDay: 2, purchasedDay: 2, quality: 0.55, shelfLife: 3, seller: 0 },
    { product: "budgetFood", processedDay: 1, purchasedDay: 2, quality: 0.55, shelfLife: 3, seller: 0 },
  ];
  town.day = 2;

  town.considerFood(person, []);

  assert.equal(person.lastFoodAge, 1);
  assert.deepEqual(person.foodStock.map((meal) => meal.processedDay), [2]);
  assert.equal(person.foodConsumedToday, 1);
  assert.equal(person.foodConsumedTotal, 1);
});

test("food purchase options expose FIFO effective quality and remaining shelf life", () => {
  let observation;
  const citizenPolicy = {
    id: "inspect-food-test",
    decide(context) {
      observation = context.observation;
      return { action: "skip-food", reasons: [], scores: {} };
    },
  };
  const town = new TownSimulation({ seed: 42, citizenPolicy });
  const person = town.people[0];
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  replacePerishableStock(town, grocer, 2, 1);
  town.day = 2;
  person.foodStock = [];
  person.cash = 100;

  town.considerFood(person, [grocer]);

  assert.equal(observation.options[0].age, 1);
  assert.equal(observation.options[0].remainingShelfLife, 2);
  assert.ok(Math.abs(observation.options[0].effectiveQuality - 0.43) < 1e-9);
});

test("café service stock expires at the next morning Planning phase", () => {
  const town = new TownSimulation({ seed: 42, latentFirmNames: [] });
  const archetype = town.firmArchetype("cafe");
  const café = town.createFirmInstance(archetype, town.firms.length, { inventory: 2, foundingDay: 1 });
  town.firms.push(café);

  town.day = 2;
  town.planningPhase();

  assert.equal(café.inventory, 0);
  assert.equal(café.wasteHistory[0].age, 1);
});
