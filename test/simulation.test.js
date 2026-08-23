import assert from "node:assert/strict";
import test from "node:test";
import { TownSimulation } from "../src/simulation.js";

test("money remains inside the closed economy", () => {
  const town = new TownSimulation({ seed: 42 });
  const initial = town.initialMoney;
  for (let step = 0; step < 600; step += 1) town.step();
  assert.ok(Math.abs(town.totalMoney() - initial) <= 0.1);
});

test("an exact transfer cannot overdraw its sender", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  const firm = town.firms[0];
  person.cash = 0.5;
  const firmCash = firm.cash;

  const paid = town.transfer(person, firm, 14.4, { exact: true });

  assert.equal(paid, 0);
  assert.equal(person.cash, 0.5);
  assert.equal(firm.cash, firmCash);
});

test("an unhoused person with 0.5 cash cannot pay the full deposit and rent", () => {
  const town = new TownSimulation({ seed: 42 });
  const sizwe = town.people.find((person) => person.name === "Sizwe");
  const homeWorks = town.firms.find((firm) => firm.name === "HomeWorks");
  const rehousingCost = homeWorks.price * 3;
  sizwe.cash = 0.5;
  sizwe.housed = false;
  sizwe.rentArrears = 3;
  sizwe.ledger = [];
  const providerCash = homeWorks.cash;

  town.housingPhase();

  assert.ok(rehousingCost > sizwe.cash);
  assert.equal(sizwe.cash, 0.5);
  assert.equal(sizwe.housed, false);
  assert.equal(homeWorks.cash, providerCash + town.people.filter((person) => person !== sizwe && person.housed).length * homeWorks.price);
  assert.equal(sizwe.ledger.length, 0);
});

test("a funded rent payment records auditable before and after balances", () => {
  const town = new TownSimulation({ seed: 42 });
  const sizwe = town.people.find((person) => person.name === "Sizwe");
  const homeWorks = town.firms.find((firm) => firm.name === "HomeWorks");
  const rehousingCost = homeWorks.price * 3;
  sizwe.cash = rehousingCost + 0.5;
  sizwe.housed = false;
  sizwe.ledger = [];

  town.housingPhase();

  assert.equal(sizwe.housed, true);
  assert.equal(sizwe.cash, 0.5);
  assert.deepEqual(sizwe.ledger[0], {
    day: 1,
    sequence: 2,
    direction: "out",
    amount: rehousingCost,
    text: "deposit and rent to HomeWorks",
    before: rehousingCost + 0.5,
    after: 0.5,
  });
});

test("housed citizens pay rent weekly rather than daily", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  const housing = town.firms.find((firm) => firm.sector === "housing");
  person.cash = 100;
  person.ledger = [];
  town.day = 2;

  town.housingPhase();

  assert.equal(person.cash, 100);
  assert.equal(person.rentArrears, 0);
  town.day = 8;
  town.housingPhase();
  assert.equal(person.cash, 100 - housing.price);
  assert.equal(person.ledger[0].text, "rent to HomeWorks");
});

test("housing demand does not decay between weekly billing days", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const housing = town.firms.find((firm) => firm.sector === "housing");
  const demand = housing.demandEMA;
  town.day = 2;

  town.settleFirm(housing);

  assert.equal(housing.demandEMA, demand);
});

test("a typical low-wage worker can cover daily-equivalent essentials", () => {
  const town = new TownSimulation({ seed: 42 });
  const lowestWage = Math.min(...town.firms.map((firm) => Math.max(town.policy.minimumWage, firm.wage)));
  const typicalNetWage = lowestWage * (0.75 + 0.8 * 0.25) * (1 - town.policy.taxRate / 100);

  assert.ok(typicalNetWage >= town.essentialCost() * 1.8);
});

test("higher-quality food replenishes more health", () => {
  const eatFrom = (sellerName) => {
    const town = new TownSimulation({ seed: 42 });
    const person = town.people[0];
    town.people.slice(1).forEach((other) => { other.alive = false; });
    town.firms.filter((firm) => firm.sector === "food" && firm.name !== sellerName).forEach((firm) => { firm.active = false; });
    person.cash = 20;
    person.health = 0.5;
    town.foodPhase();
    return { health: person.health, quality: person.lastFoodQuality };
  };

  const cheaper = eatFrom("Harvest Foods");
  const dearer = eatFrom("Green Basket");

  assert.equal(cheaper.quality, 0.55);
  assert.equal(dearer.quality, 0.85);
  assert.ok(dearer.health > cheaper.health);
});

test("a citizen buys food ahead and consumes the reserve as its quality declines", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[2];
  const harvest = town.firms.find((firm) => firm.name === "Harvest Foods");
  town.people.filter((other) => other !== person).forEach((other) => { other.alive = false; });
  town.firms.filter((firm) => firm.sector === "food" && firm !== harvest).forEach((firm) => { firm.active = false; });
  person.cash = 20;
  person.health = 0.5;
  person.ledger = [];
  const startingInventory = harvest.inventory;

  town.foodPhase();
  const healthAfterFreshMeal = person.health;

  assert.equal(person.foodReserveTarget, 3);
  assert.equal(person.foodStock.length, 2);
  assert.equal(harvest.inventory, startingInventory - 3);
  assert.equal(person.ledger.length, 1);
  assert.equal(person.ledger[0].text, "3 food portions from Harvest Foods");
  assert.equal(person.lastFoodAge, 0);

  town.day = 2;
  town.foodPhase();

  assert.equal(person.foodStock.length, 1);
  assert.equal(person.ledger.length, 1);
  assert.equal(harvest.inventory, startingInventory - 3);
  assert.equal(person.lastFoodAge, 1);
  assert.ok(Math.abs(person.lastFoodQuality - 0.43) < 1e-9);
  assert.ok(person.health - healthAfterFreshMeal < healthAfterFreshMeal - 0.5);
});

test("eviction is recorded once and leaves no rent arrears while unhoused", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  person.cash = 0;
  person.housed = true;
  person.rentArrears = 2;
  person.events = [];

  town.housingPhase();
  town.housingPhase();

  assert.equal(person.housed, false);
  assert.equal(person.rentArrears, 0);
  assert.equal(person.events.filter((event) => event.text === "three missed rents caused eviction").length, 1);
});

test("secure essentials and recent social contact lower underlying stress pressure", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  person.employer = -1;
  person.cash = 0.5;
  person.housed = false;
  person.hungryDays = 2;
  person.friends = [];
  const precarious = town.stressPressure(person);

  person.employer = 0;
  town.firms[0].trouble = 0;
  person.cash = town.essentialCost() * 12;
  person.housed = true;
  person.hungryDays = 0;
  person.friends = [1];
  person.lastSocialDay = town.day;
  const secure = town.stressPressure(person);

  assert.ok(secure < precarious);
  assert.equal(secure, 0);
});

test("critical health causes a traceable death and updates population counts", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const person = town.people.find((candidate) => candidate.id >= 5 && candidate.employer >= 0);
  const firm = town.firms[person.employer];
  const initialMoney = town.totalMoney();
  person.health = 0.08;
  person.stress = 1;
  person.criticalHealthDays = 2;
  person.events = [];

  town.settlementPhase();

  assert.equal(person.alive, false);
  assert.equal(person.deathDay, 1);
  assert.equal(person.employer, -1);
  assert.equal(firm.employees.includes(person.id), false);
  assert.equal(person.events[0].text, "died after health reached a critical level");
  assert.equal(town.totalMoney(), initialMoney);
  assert.deepEqual(
    (({ alive, dead, totalCitizens }) => ({ alive, dead, totalCitizens }))(town.snapshot()),
    { alive: 39, dead: 1, totalCitizens: 40 },
  );
});

test("a dead person takes no further economic or social actions", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people.find((candidate) => candidate.id >= 5 && candidate.employer < 0);
  town.transfer(person, town.government, person.cash, { exact: true });
  person.hungryDays = 2;
  person.housed = false;
  const stress = person.stress;
  town.die(person, "died in a regression scenario");
  const eventsAtDeath = structuredClone(person.events);

  for (let step = 0; step < 6; step += 1) town.step();

  assert.equal(person.cash, 0);
  assert.equal(person.hungryDays, 2);
  assert.equal(person.housed, false);
  assert.equal(person.stress, stress);
  assert.equal(person.employer, -1);
  assert.equal(person.ledger.length, 0);
  assert.deepEqual(person.events, eventsAtDeath);
});

test("attending staff cap the number of daily transactions", () => {
  const town = new TownSimulation({ seed: 42 });
  const firm = town.firms[0];
  firm.transactionsPerWorker = 2;
  firm.employees.forEach((id, index) => {
    town.people[id].attended = index === 0;
  });
  const buyers = town.people.slice(-3);
  buyers.forEach((person) => {
    person.cash = 20;
  });

  assert.ok(town.buy(buyers[0], firm, 1, "food") > 0);
  assert.ok(town.buy(buyers[1], firm, 1, "food") > 0);
  assert.equal(town.buy(buyers[2], firm, 1, "food"), 0);
  assert.equal(firm.transactionsToday, 2);
  assert.equal(firm.attemptedTransactions, 3);
  assert.equal(firm.turnedAwayTransactions, 1);
  assert.match(buyers[2].events[0].text, /could not serve/);
});

test("payable excess demand creates an economically supported position", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const firm = town.firms[0];
  firm.demandEMA = firm.employees.length * firm.transactionsPerWorker;
  firm.attemptedTransactions = firm.demandEMA + 14;

  town.settleFirm(firm);

  assert.equal(town.snapshot().positionsAvailable, 1);
  assert.equal(firm.targetStaff, firm.employees.length + 1);
  assert.equal(firm.vacancyAge, 1);
});

test("sustained excess demand eventually expands staffing", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const firm = town.firms[0];
  const startingStaff = firm.employees.length;
  firm.demandEMA = startingStaff * firm.transactionsPerWorker;

  for (let day = 0; day < 3; day += 1) {
    firm.attemptedTransactions = firm.employees.length * firm.transactionsPerWorker + 10;
    town.settleFirm(firm);
  }

  assert.equal(firm.employees.length, startingStaff + 1);
});

test("excess demand does not create a position without payroll reserves", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const firm = town.firms[0];
  const wage = Math.max(town.policy.minimumWage, firm.wage);
  firm.cash = wage * 5;
  firm.demandEMA = firm.employees.length * firm.transactionsPerWorker;
  firm.attemptedTransactions = firm.demandEMA + 10;

  town.settleFirm(firm);

  assert.equal(firm.targetStaff, firm.employees.length);
  assert.equal(town.snapshot().positionsAvailable, 0);
});

test("a weak-demand layoff does not create an available position", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const firm = town.firms[0];
  firm.demandEMA = 0;
  firm.unitsSold = 0;
  firm.overstaffedDays = 2;
  const before = town.snapshot();

  town.settleFirm(firm);

  const after = town.snapshot();
  assert.equal(after.employed, before.employed - 1);
  assert.equal(after.positionsAvailable, before.positionsAvailable);
});

test("the snapshot reports positions approved by active firms", () => {
  const town = new TownSimulation({ seed: 42 });
  town.firms.forEach((firm) => {
    firm.targetStaff = firm.employees.length;
  });
  town.firms[0].targetStaff += 2;
  town.firms[1].targetStaff += 1;
  town.firms[1].active = false;

  assert.equal(town.snapshot().positionsAvailable, 2);
});

test("the same seed produces the same town", () => {
  const first = new TownSimulation({ seed: 2026 });
  const second = new TownSimulation({ seed: 2026 });
  for (let step = 0; step < 60; step += 1) {
    first.step();
    second.step();
  }
  assert.deepEqual(first.snapshot(), second.snapshot());
  assert.deepEqual(first.people, second.people);
});
