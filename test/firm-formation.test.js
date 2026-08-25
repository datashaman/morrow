import assert from "node:assert/strict";
import test from "node:test";
import { OPPORTUNITY_OBSERVATION_DAYS, OPPORTUNITY_STARTUP_CAPITAL } from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

function latentCafeTown(seed = 42) {
  return new TownSimulation({ seed, latentFirmNames: ["Common Café"], policy: { discretionaryDemand: 100, shockRisk: 0 } });
}

function createViableCafeDemand(town) {
  town.people.forEach((person) => {
    person.cash = 100;
    person.focus = "belonging";
    person.scarcityError = false;
  });
  town.initialMoney = town.totalMoney();
}

function observeFullWindow(town) {
  let result;
  for (let offset = 0; offset < OPPORTUNITY_OBSERVATION_DAYS; offset += 1) {
    town.day = offset + 1;
    result = town.observeFirmOpportunities();
  }
  return result;
}

test("a latent café is an off-map archetype with explicit not-ready evidence", () => {
  const town = latentCafeTown();

  assert.equal(town.firms.some((firm) => firm.name === "Common Café"), false);
  assert.deepEqual(town.firms.map((firm) => firm.id), [0, 1, 2, 3, 4]);
  assert.deepEqual(town.firms.map((firm) => firm.instanceId), [
    "everyday-grocer:1",
    "premium-grocer:1",
    "housing-provider:1",
    "toolmaker:1",
    "farm:1",
  ]);
  const [opportunity] = town.firmOpportunities();
  assert.equal(opportunity.name, "Common Café");
  assert.equal(opportunity.ready, false);
  assert.equal(opportunity.observedDays, 0);
  assert.match(opportunity.reasons.join(" "), /observation days still required/);
});

test("unsupported subsistence conditions cannot found a café", () => {
  const town = latentCafeTown();
  town.policy.discretionaryDemand = 0;
  town.people.forEach((person) => { person.focus = "physiological"; });

  const result = observeFullWindow(town);

  assert.equal(result.ready, false);
  assert.equal(town.firms.some((firm) => firm.archetypeId === "cafe"), false);
  assert.equal(result.expectedDailyRevenue, 0);
  assert.match(result.reasons.join(" "), /demand does not cover/);
});

test("viable demand founds a zero-windfall café with exact capital, staff, contracts, and history", () => {
  const town = latentCafeTown();
  createViableCafeDemand(town);
  const totalBefore = town.totalMoney();
  const founder = town.founderCandidates()[0];
  const founderBefore = founder.cash;

  const firm = observeFullWindow(town);

  assert.equal(firm.name, "Common Café");
  assert.equal(firm.instanceId, "cafe:1");
  assert.equal(firm.foundingDay, OPPORTUNITY_OBSERVATION_DAYS);
  assert.equal(firm.owner, founder.id);
  assert.equal(firm.founderCapital, OPPORTUNITY_STARTUP_CAPITAL);
  assert.equal(founder.cash, founderBefore - OPPORTUNITY_STARTUP_CAPITAL);
  assert.equal(firm.cash, OPPORTUNITY_STARTUP_CAPITAL);
  assert.equal(firm.inventory, 0);
  assert.equal(firm.employees.length, 2);
  assert.ok(firm.employees.includes(founder.id));
  assert.equal(town.totalMoney(), totalBefore);
  assert.deepEqual(
    town.contracts.filter((contract) => contract.buyerId === firm.id).map((contract) => contract.supplier).sort(),
    ["Makers Guild", "Morrow Fields"],
  );
  assert.match(founder.ledger[0].text, /founder capital to Common Café/);
  assert.match(firm.ledger[0].text, /founder capital from/);
  assert.equal(founder.decisions[0].policy, "entrepreneur-v1");
  assert.equal(firm.decisions[0].chosenAction, "found-firm:cafe");
  assert.equal(town.opportunityHistory[0].foundedInstanceId, "cafe:1");
  town.assertInvariants();
});

test("missing produce supply blocks café formation despite viable demand", () => {
  const town = latentCafeTown();
  createViableCafeDemand(town);
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  farm.active = false;
  farm.status = "insolvent";

  const result = observeFullWindow(town);

  assert.equal(result.ready, false);
  assert.equal(town.firms.some((firm) => firm.archetypeId === "cafe"), false);
  assert.match(result.reasons.join(" "), /missing active supplier: Morrow Fields/);
});

test("founder and opening day reproduce for the same seed and state", () => {
  const first = latentCafeTown(404);
  const second = latentCafeTown(404);
  createViableCafeDemand(first);
  createViableCafeDemand(second);

  const firstFirm = observeFullWindow(first);
  const secondFirm = observeFullWindow(second);

  assert.deepEqual(
    { owner: firstFirm.owner, day: firstFirm.foundingDay, staff: firstFirm.employees },
    { owner: secondFirm.owner, day: secondFirm.foundingDay, staff: secondFirm.employees },
  );
});

test("a closed café instance remains historical and blocks private replacement", () => {
  const town = new TownSimulation({ seed: 42 });
  const cafe = town.firms.find((firm) => firm.name === "Common Café");
  town.closeFirm(cafe);

  const result = town.observeFirmOpportunities();

  assert.equal(town.firms.includes(cafe), true);
  assert.equal(cafe.active, false);
  assert.equal(town.firms.filter((firm) => firm.archetypeId === "cafe").length, 1);
  assert.equal(result.ready, false);
  assert.match(result.reasons.join(" "), /previous Common Café instance failed/);
});

test("premium food remains latent when households lack cash above near-term essentials", () => {
  const town = new TownSimulation({ seed: 42, latentFirmNames: ["Green Basket"] });
  town.people.forEach((person) => {
    person.cash = 10;
    person.foodStock = [];
  });
  town.initialMoney = town.totalMoney();

  const result = observeFullWindow(town);

  assert.equal(result.archetypeId, "premium-grocer");
  assert.equal(result.ready, false);
  assert.equal(result.expectedDailyDemand, 0);
  assert.match(result.reasons.join(" "), /demand does not cover/);
  assert.equal(town.firms.some((firm) => firm.archetypeId === "premium-grocer"), false);
});

test("household discretionary capacity can found a one-worker premium grocer", () => {
  const town = new TownSimulation({ seed: 42, latentFirmNames: ["Green Basket"] });
  town.people.forEach((person) => {
    person.cash = 100;
    person.foodStock = [];
  });
  town.initialMoney = town.totalMoney();
  const totalBefore = town.totalMoney();

  const firm = observeFullWindow(town);

  assert.equal(firm.archetypeId, "premium-grocer");
  assert.equal(firm.instanceId, "premium-grocer:1");
  assert.equal(firm.employees.length, 1);
  assert.equal(firm.employees[0], firm.owner);
  assert.equal(firm.inventory, 0);
  assert.equal(firm.cash, OPPORTUNITY_STARTUP_CAPITAL);
  assert.equal(town.totalMoney(), totalBefore);
  assert.deepEqual(
    town.contracts.filter((contract) => contract.buyerId === firm.id).map((contract) => contract.supplier).sort(),
    ["Makers Guild", "Morrow Fields"],
  );
  assert.equal(firm.decisions[0].policy, "entrepreneur-v1");
});

test("agriculture absence blocks otherwise viable premium-food formation", () => {
  const town = new TownSimulation({ seed: 42, latentFirmNames: ["Green Basket"] });
  town.people.forEach((person) => {
    person.cash = 100;
    person.foodStock = [];
  });
  town.initialMoney = town.totalMoney();
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  farm.active = false;
  farm.status = "insolvent";

  const result = observeFullWindow(town);

  assert.equal(result.ready, false);
  assert.match(result.reasons.join(" "), /missing active supplier: Morrow Fields/);
  assert.equal(town.firms.some((firm) => firm.archetypeId === "premium-grocer"), false);
});
