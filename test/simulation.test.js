import assert from "node:assert/strict";
import test from "node:test";
import { PHASES, PRODUCTS } from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

test("money remains inside the closed economy", () => {
  const town = new TownSimulation({ seed: 42 });
  const initial = town.initialMoney;
  for (let step = 0; step < 600; step += 1) town.step();
  assert.ok(Math.abs(town.totalMoney() - initial) <= 0.1);
});

test("a citizen retains their complete in-memory activity history", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  person.events = [];
  person.ledger = [];

  for (let index = 0; index < 20; index += 1) {
    town.note(person, `event ${index}`);
    town.ledger(person, { direction: "in", amount: 1, text: `transaction ${index}`, before: person.cash });
  }

  assert.equal(person.events.length, 20);
  assert.equal(person.ledger.length, 20);
});

test("every firm begins with its configured owner and staff count", () => {
  const town = new TownSimulation({ seed: 42 });

  town.firms.forEach((firm) => {
    assert.equal(town.people[firm.owner].employer, firm.id);
    assert.equal(firm.employees.length, firm.initialStaff);
  });
});

test("every firm has a valid explicit product pipeline", () => {
  const town = new TownSimulation({ seed: 42 });

  town.firms.forEach((firm) => {
    assert.ok(PRODUCTS[firm.sells]);
    if (firm.input) {
      assert.ok(PRODUCTS[firm.input]);
      assert.equal(town.firms.find((supplier) => supplier.name === firm.source)?.sells, firm.input);
    }
  });
  assert.equal(town.firms.find((firm) => firm.sector === "agriculture").name, "Morrow Fields");
});

test("farm workers produce inputs that immediate-settlement contracts move to retailers", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  const harvest = town.firms.find((firm) => firm.name === "Harvest Foods");
  const farmInventory = farm.inventory;
  const harvestInventory = harvest.inventory;
  const farmCash = farm.cash;
  const harvestCash = harvest.cash;
  farm.employees.forEach((id) => { town.people[id].attended = true; });

  town.productionPhase();
  const produced = farm.inventory - farmInventory;
  town.procurementPhase();
  const contract = town.contracts.find((candidate) => candidate.buyer === "Harvest Foods");

  assert.ok(produced > 0);
  assert.equal(contract.deliveredToday, 22);
  assert.equal(harvest.inventory, harvestInventory + 22);
  assert.equal(harvest.cash, harvestCash - 24.2);
  assert.equal(farm.cash > farmCash, true);
  assert.equal(harvest.inputCosts, 24.2);
  assert.match(harvest.ledger[0].text, /22 crates from Morrow Fields/);
});

test("a supply contract cannot put its buyer into debt", () => {
  const town = new TownSimulation({ seed: 42 });
  const harvest = town.firms.find((firm) => firm.name === "Harvest Foods");
  const contract = town.contracts.find((candidate) => candidate.buyer === "Harvest Foods");
  harvest.cash = 1;

  town.procurementPhase();

  assert.equal(contract.deliveredToday, 0);
  assert.equal(contract.shortfallToday, contract.requestedToday);
  assert.equal(harvest.cash, 1);
});

test("a vital firm receives at most one finite treasury rescue", () => {
  const town = new TownSimulation({ seed: 42 });
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  const initialMoney = town.totalMoney();
  town.transfer(farm, town.government, farm.cash, { exact: true });
  farm.distressDays = 2;
  const treasuryBefore = town.government.cash;

  town.assessFirmSolvency(farm);

  assert.equal(farm.status, "rescued");
  assert.equal(farm.rescueCount, 1);
  assert.equal(farm.lastRescueDay, town.day);
  assert.ok(farm.cash > 0 && firmCashIsBounded(farm.cash));
  assert.equal(town.government.cash, treasuryBefore - farm.cash);
  assert.equal(town.totalMoney(), initialMoney);
  assert.match(farm.ledger[0].text, /one-time vital-business rescue/);
});

test("a previously rescued vital firm can become insolvent without a second rescue", () => {
  const town = new TownSimulation({ seed: 42 });
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  town.transfer(farm, town.government, farm.cash, { exact: true });
  farm.rescueCount = 1;
  farm.status = "distressed";
  farm.distressDays = 5;

  town.assessFirmSolvency(farm);

  assert.equal(farm.active, false);
  assert.equal(farm.status, "insolvent");
  assert.equal(farm.rescueCount, 1);
  assert.equal(farm.employees.length, 0);
  assert.ok(town.contracts.filter((contract) => contract.supplierId === farm.id).every((contract) => !contract.active));
});

test("a persistently unfunded non-vital firm becomes insolvent", () => {
  const town = new TownSimulation({ seed: 42 });
  const makers = town.firms.find((firm) => firm.name === "Makers Guild");
  town.transfer(makers, town.government, makers.cash, { exact: true });
  makers.distressDays = 5;
  makers.status = "distressed";

  town.assessFirmSolvency(makers);

  assert.equal(makers.active, false);
  assert.equal(makers.status, "insolvent");
  assert.match(makers.events[0].text, /sustained insolvency/);
});

function firmCashIsBounded(cash) {
  return cash <= 90;
}

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

test("housing income does not decay between weekly billing days", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const housing = town.firms.find((firm) => firm.sector === "housing");
  const revenue = housing.revenueEMA;
  town.day = 2;

  town.settleFirm(housing);

  assert.equal(housing.revenueEMA, revenue);
});

test("housing receipts are normalized to daily income", () => {
  const town = new TownSimulation({ seed: 42 });
  const housing = town.firms.find((firm) => firm.sector === "housing");
  const previousRevenue = housing.revenueEMA;
  housing.sales = 70;

  town.settleFirm(housing);

  assert.ok(Math.abs(housing.revenueEMA - (previousRevenue * 0.72 + 10 * 0.28)) < 1e-9);
});

test("a typical low-wage worker can cover daily-equivalent essentials", () => {
  const town = new TownSimulation({ seed: 42 });
  const lowestWage = Math.min(...town.firms.map((firm) => Math.max(town.policy.minimumWage, firm.wage)));
  const typicalNetWage = lowestWage * (0.75 + 0.8 * 0.25) * (1 - town.policy.taxRate / 100);

  assert.ok(typicalNetWage >= town.essentialCost() * 1.8);
});

test("sustainable food production prevents a solvent later shopper from starving", () => {
  const town = new TownSimulation();
  const person = town.people.find((candidate) => candidate.name === "Sizwe");

  for (let day = 0; day < 30; day += 1) {
    for (let phase = 0; phase < PHASES.length; phase += 1) town.step();
  }

  assert.equal(person.alive, true);
  assert.equal(person.hungryDays, 0);
  assert.ok(person.health > 0.5);
  assert.ok(person.cash > town.essentialCost());
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

test("discretionary demand controls otherwise eligible optional purchases", () => {
  const runPersonalTime = (discretionaryDemand) => {
    const town = new TownSimulation({ seed: 42 });
    const person = town.people[0];
    town.people.filter((other) => other !== person).forEach((other) => { other.alive = false; });
    town.setPolicy("discretionaryDemand", discretionaryDemand);
    person.cash = 20;
    person.stress = 0.8;
    person.scarcityError = true;
    person.ledger = [];
    town.personalPhase();
    return person;
  };

  const suppressed = runPersonalTime(0);
  const encouraged = runPersonalTime(100);

  assert.equal(suppressed.cash, 20);
  assert.equal(suppressed.ledger.length, 0);
  assert.ok(encouraged.cash < 20);
  assert.match(encouraged.ledger[0].text, /short-term comfort to Common Café/);
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
  person.relationships = {};
  const precarious = town.stressPressure(person);

  person.employer = 0;
  town.firms[0].trouble = 0;
  person.cash = town.essentialCost() * 12;
  person.housed = true;
  person.hungryDays = 0;
  const friend = town.people[1];
  person.relationships = {};
  friend.relationships = {};
  town.formFriendship(person, friend, 1, town.day);
  person.lastSocialDay = town.day;
  const secure = town.stressPressure(person);

  assert.ok(secure < precarious);
  assert.equal(secure, 0);
});

test("social contact strengthens a friendship symmetrically", () => {
  const town = new TownSimulation({ seed: 42 });
  const a = town.people[0];
  const b = town.people[1];
  a.relationships = {};
  b.relationships = {};
  town.formFriendship(a, b, 0.6, 0);
  town.day = 4;

  town.recordSocialContact(a, b);

  assert.equal(a.relationships[b.id].strength, 0.78);
  assert.deepEqual(a.relationships[b.id], b.relationships[a.id]);
  assert.equal(a.relationships[b.id].lastContactDay, 4);
});

test("an unmaintained friendship decays and ends symmetrically", () => {
  const town = new TownSimulation({ seed: 42 });
  const a = town.people[0];
  const b = town.people[1];
  a.relationships = {};
  b.relationships = {};
  a.events = [];
  b.events = [];
  town.formFriendship(a, b, 0.21, 0);
  town.day = 6;

  town.decayRelationships();

  assert.equal(a.relationships[b.id], undefined);
  assert.equal(b.relationships[a.id], undefined);
  assert.match(a.events[0].text, /friendship with Jonah faded/);
  assert.match(b.events[0].text, /friendship with Amina faded/);
});

test("stronger friendships provide more belonging and less social pressure", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  const friend = town.people[1];
  person.relationships = {};
  friend.relationships = {};
  person.lastSocialDay = town.day;
  town.formFriendship(person, friend, 0.3, town.day);
  const weakerBelonging = town.assessNeeds(person).belonging;
  const weakerPressure = town.stressPressure(person);

  person.relationships[friend.id].strength = 0.9;
  friend.relationships[person.id].strength = 0.9;

  assert.ok(town.assessNeeds(person).belonging > weakerBelonging);
  assert.ok(town.stressPressure(person) < weakerPressure);
});

test("person state excludes inactive placeholders and retains an explicit esteem baseline", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  person.employer = -1;
  const originalBaseline = person.esteemBaseline;
  const originalEsteem = town.assessNeeds(person).esteem;

  person.esteemBaseline += 0.1;
  const raisedEsteem = town.assessNeeds(person).esteem;

  assert.equal("risk" in person, false);
  assert.equal("masteryDays" in person, false);
  assert.equal("esteemBoost" in person, false);
  assert.ok(originalBaseline >= 0.05 && originalBaseline <= 0.17);
  assert.ok(Math.abs(raisedEsteem - originalEsteem - 0.1) < 1e-9);
});

test("critical health causes a traceable death and updates population counts", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const person = town.people.find((candidate) => candidate.id >= 5 && candidate.employer >= 0);
  const firm = town.firms[person.employer];
  const initialMoney = town.totalMoney();
  const estate = person.cash;
  const treasuryBefore = town.government.cash;
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
  assert.equal(person.cash, 0);
  assert.equal(person.estateTransferred, estate);
  assert.equal(town.government.cash, Math.round((treasuryBefore + estate) * 100) / 100);
  assert.deepEqual(
    (({ direction, amount, text, before, after }) => ({ direction, amount, text, before, after }))(person.ledger[0]),
    { direction: "out", amount: estate, text: "intestate estate transferred to treasury", before: estate, after: 0 },
  );
  assert.equal(town.totalMoney(), initialMoney);
  assert.deepEqual(
    (({ alive, dead, totalCitizens }) => ({ alive, dead, totalCitizens }))(town.snapshot()),
    { alive: 39, dead: 1, totalCitizens: 40 },
  );
});

test("a dead person takes no further economic or social actions", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people.find((candidate) => candidate.id >= 5 && candidate.employer < 0);
  person.hungryDays = 2;
  person.housed = false;
  const stress = person.stress;
  town.die(person, "died in a regression scenario");
  const eventsAtDeath = structuredClone(person.events);
  const ledgerAtDeath = structuredClone(person.ledger);

  for (let step = 0; step < PHASES.length; step += 1) town.step();

  assert.equal(person.cash, 0);
  assert.equal(person.hungryDays, 2);
  assert.equal(person.housed, false);
  assert.equal(person.stress, stress);
  assert.equal(person.employer, -1);
  assert.deepEqual(person.ledger, ledgerAtDeath);
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

test("bulk units contribute their full realized income through one transaction", () => {
  const town = new TownSimulation({ seed: 42 });
  const firm = town.firms.find((candidate) => candidate.name === "Harvest Foods");
  const person = town.people.at(-1);
  person.cash = 20;
  firm.revenueEMA = 0;

  town.buy(person, firm, 3, "food");
  assert.equal(firm.attemptedTransactions, 1);
  assert.equal(firm.unitsSold, 3);
  assert.equal(firm.sales, 5.4);
  town.settleFirm(firm);

  assert.ok(Math.abs(firm.revenueEMA - 5.4 * 0.28) < 1e-9);
});

test("sufficient realized income creates an economically supported position", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const firm = town.firms[0];
  const wage = Math.max(town.policy.minimumWage, firm.wage);
  firm.revenueEMA = wage * 1.08 * (firm.employees.length + 1);
  firm.sales = firm.revenueEMA;

  town.settleFirm(firm);

  assert.equal(town.snapshot().positionsAvailable, 1);
  assert.equal(firm.targetStaff, firm.employees.length + 1);
  assert.equal(firm.vacancyAge, 1);
});

test("sustained income eventually expands staffing", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const firm = town.firms[0];
  const startingStaff = firm.employees.length;
  const wage = Math.max(town.policy.minimumWage, firm.wage);

  for (let day = 0; day < 10 && firm.employees.length === startingStaff; day += 1) {
    firm.sales = wage * 1.08 * (startingStaff + 2);
    town.settleFirm(firm);
  }

  assert.equal(firm.employees.length, startingStaff + 1);
});

test("income does not create a position without payroll reserves", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const firm = town.firms[0];
  const wage = Math.max(town.policy.minimumWage, firm.wage);
  firm.cash = wage * 5;
  firm.revenueEMA = wage * 1.08 * (firm.employees.length + 1);
  firm.sales = firm.revenueEMA;

  town.settleFirm(firm);

  assert.equal(firm.targetStaff, firm.employees.length);
  assert.equal(town.snapshot().positionsAvailable, 0);
});

test("a weak-income layoff does not create an available position", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const firm = town.firms[0];
  firm.revenueEMA = 0;
  firm.sales = 0;
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
