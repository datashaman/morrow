import assert from "node:assert/strict";
import test from "node:test";
import { OPPORTUNITY_OBSERVATION_DAYS, OPPORTUNITY_STARTUP_CAPITAL, PRIVATE_REENTRY_COOLDOWN_DAYS } from "../src/config.js";
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

function resultForArchetype(result, archetypeId) {
  return Array.isArray(result) ? result.find((entry) => entry.archetypeId === archetypeId) : result;
}

function observeFullWindow(town, archetypeId = "cafe") {
  let result;
  for (let offset = 0; offset < OPPORTUNITY_OBSERVATION_DAYS; offset += 1) {
    town.day = offset + 1;
    result = resultForArchetype(town.observeFirmOpportunities(), archetypeId);
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
  assert.equal(town.opportunityHistory.find((entry) => entry.archetypeId === "cafe").foundedInstanceId, "cafe:1");
  town.assertInvariants();
});

test("the intervention accelerates viable formation while control preserves the legacy gate", () => {
  const treatment = latentCafeTown(42);
  const control = new TownSimulation({
    seed: 42,
    latentFirmNames: ["Common Café"],
    employmentInterventionEnabled: false,
    policy: { discretionaryDemand: 100, shockRisk: 0 },
  });
  createViableCafeDemand(treatment);
  createViableCafeDemand(control);
  let treatmentResult;
  let controlResult;
  for (let day = 1; day <= 3; day += 1) {
    treatment.day = day;
    control.day = day;
    treatmentResult = resultForArchetype(treatment.observeFirmOpportunities(), "cafe");
    controlResult = resultForArchetype(control.observeFirmOpportunities(), "cafe");
  }

  assert.equal(treatmentResult.instanceId, "cafe:1");
  assert.equal(treatmentResult.foundingDay, 3);
  assert.equal(treatmentResult.protectedRunwayDays, 6);
  assert.equal(control.firms.some((firm) => firm.archetypeId === "cafe"), false);
  assert.equal(controlResult.requiredObservationDays, 7);
  assert.equal(controlResult.protectedRunwayDays, 10);

  for (let day = 4; day <= 7; day += 1) {
    control.day = day;
    controlResult = resultForArchetype(control.observeFirmOpportunities(), "cafe");
  }
  assert.equal(controlResult.instanceId, "cafe:1");
  assert.equal(controlResult.foundingDay, 7);
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

test("a closed café instance remains historical and enters a confidence cooldown", () => {
  const town = new TownSimulation({ seed: 42 });
  const cafe = town.firms.find((firm) => firm.name === "Common Café");
  town.day = 10;
  town.closeFirm(cafe);

  const result = resultForArchetype(town.observeFirmOpportunities(), "cafe");

  assert.equal(town.firms.includes(cafe), true);
  assert.equal(cafe.active, false);
  assert.equal(town.firms.filter((firm) => firm.archetypeId === "cafe").length, 1);
  assert.equal(result.ready, false);
  assert.equal(result.cooldownRemaining, PRIVATE_REENTRY_COOLDOWN_DAYS);
  assert.match(result.reasons.join(" "), /post-failure confidence cooldown/);
});

test("material recovery after cooldown creates a separately funded replacement instance", () => {
  const town = new TownSimulation({ seed: 42, policy: { discretionaryDemand: 100, shockRisk: 0 } });
  town.people.forEach((person) => {
    person.cash = 100;
    person.focus = "belonging";
  });
  town.initialMoney = town.totalMoney();
  const first = town.firms.find((firm) => firm.archetypeId === "cafe");
  const firstOwner = first.owner;
  town.day = 10;
  town.closeFirm(first, "the first café failed its market");
  const firstHistory = structuredClone({ ledger: first.ledger, events: first.events, decisions: first.decisions });
  const totalBefore = town.totalMoney();

  town.observeFirmOpportunities();
  assert.equal(town.firms.filter((firm) => firm.archetypeId === "cafe").length, 1);
  for (let day = 25; day <= 30; day += 1) {
    town.day = day;
    const result = resultForArchetype(town.observeFirmOpportunities(), "cafe");
    assert.equal(result.ready, false);
  }
  town.day = 31;
  const replacement = resultForArchetype(town.observeFirmOpportunities(), "cafe");

  assert.equal(replacement.instanceId, "cafe:2");
  assert.notEqual(replacement.owner, firstOwner);
  assert.equal(replacement.foundingDay, 31);
  assert.equal(replacement.founderCapital, OPPORTUNITY_STARTUP_CAPITAL);
  assert.equal(replacement.cash, OPPORTUNITY_STARTUP_CAPITAL);
  assert.equal(replacement.inventory, 0);
  assert.equal(town.firms.filter((firm) => firm.archetypeId === "cafe").length, 2);
  assert.equal(town.firms[replacement.id], replacement);
  assert.deepEqual({ ledger: first.ledger, events: first.events, decisions: first.decisions }, firstHistory);
  assert.equal(town.contracts.filter((contract) => contract.buyerId === first.id && contract.active).length, 0);
  assert.equal(town.contracts.filter((contract) => contract.buyerId === replacement.id && contract.active).length, 2);
  assert.equal(town.totalMoney(), totalBefore);
  town.assertInvariants();
});

test("premium food remains latent when households lack cash above near-term essentials", () => {
  const town = new TownSimulation({ seed: 42, latentFirmNames: ["Green Basket"] });
  town.people.forEach((person) => {
    person.cash = 10;
    person.foodStock = [];
  });
  town.initialMoney = town.totalMoney();

  const result = observeFullWindow(town, "premium-grocer");

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

  const firm = observeFullWindow(town, "premium-grocer");

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

  const result = observeFullWindow(town, "premium-grocer");

  assert.equal(result.ready, false);
  assert.match(result.reasons.join(" "), /missing active supplier: Morrow Fields/);
  assert.equal(town.firms.some((firm) => firm.archetypeId === "premium-grocer"), false);
});
