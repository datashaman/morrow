import assert from "node:assert/strict";
import test from "node:test";
import {
  HOUSING_PROJECT_CAPACITY_GAIN,
  HOUSING_REPAIR_GRACE_DAYS,
  HOUSING_REPAIR_INTERVAL_DAYS,
  INITIAL_DWELLING_CAPACITY,
  OPPORTUNITY_OBSERVATION_DAYS,
} from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

function resultFor(observed, archetypeId) {
  return Array.isArray(observed) ? observed.find((entry) => entry.archetypeId === archetypeId) : observed;
}

function foundBuilder(seed = 42) {
  const town = new TownSimulation({ seed, policy: { shockRisk: 0 }, housingCapacityEnabled: true });
  town.people.forEach((person) => { person.cash = 100; });
  town.initialMoney = town.totalMoney();
  let builder;
  for (let offset = 0; offset < OPPORTUNITY_OBSERVATION_DAYS; offset += 1) {
    town.day = offset + 1;
    builder = resultFor(town.observeFirmOpportunities(), "builder");
  }
  return {
    town,
    builder,
    materials: town.firms.find((firm) => firm.archetypeId === "materials-yard"),
    housing: town.firms.find((firm) => firm.sector === "housing"),
  };
}

test("housing starts with a finite number of occupied dwellings", () => {
  const town = new TownSimulation({ seed: 42, housingCapacityEnabled: true });
  const housing = town.firms.find((firm) => firm.sector === "housing");

  assert.equal(housing.dwellingCapacity, INITIAL_DWELLING_CAPACITY);
  assert.equal(town.housingOccupancy(), INITIAL_DWELLING_CAPACITY);
  assert.equal(town.housingProjectDemand(housing), "expansion");
});

test("an unhoused citizen cannot rent a nonexistent dwelling", () => {
  const town = new TownSimulation({ seed: 42, housingCapacityEnabled: true });
  const housing = town.firms.find((firm) => firm.sector === "housing");
  const applicant = town.people[0];
  applicant.housed = false;
  applicant.cash = 100;
  housing.dwellingCapacity = town.housingOccupancy();

  assert.equal(town.considerHousing(applicant, housing), false);
  assert.deepEqual(applicant.decisions[0].legalActions, ["remain-unhoused"]);
  assert.equal(applicant.decisions[0].observation.dwellingCapacity, housing.dwellingCapacity);
  assert.equal(applicant.decisions[0].observation.housingOccupancy, housing.dwellingCapacity);
});

test("builders require an operating local materials supplier", () => {
  const town = new TownSimulation({
    seed: 42,
    formationArchetypeIds: ["builder"],
    housingCapacityEnabled: true,
  });
  town.people.forEach((person) => { person.cash = 100; });
  let opportunity;
  for (let day = 1; day <= OPPORTUNITY_OBSERVATION_DAYS; day += 1) {
    town.day = day;
    opportunity = town.observeFirmOpportunities();
  }

  assert.equal(opportunity.ready, false);
  assert.match(opportunity.reasons.join(" "), /missing active supplier: Morrow Materials/);
});

test("persistent housing pressure can found materials and builder jobs", () => {
  const { town, builder, materials } = foundBuilder();

  assert.equal(materials.active, true);
  assert.equal(builder.instanceId, "builder:1");
  assert.equal(builder.employees.length, 1);
  assert.equal(town.people[builder.owner].employer, builder.id);
  assert.deepEqual(
    town.contracts.filter((contract) => contract.buyerId === builder.id).map((contract) => contract.supplier).sort(),
    ["Makers Guild", "Morrow Materials"],
  );
  town.assertInvariants();
});

test("an exact builder project consumes materials, moves cash, and expands housing", () => {
  const { town, builder, materials, housing } = foundBuilder();
  const makers = town.firms.find((firm) => firm.name === "Makers Guild");
  materials.inventory = 10;
  makers.inventory = 20;
  builder.cash = 100;
  housing.cash = 100;
  town.initialMoney = town.totalMoney();
  const builderBefore = builder.cash;
  const housingBefore = housing.cash;
  const capacityBefore = housing.dwellingCapacity;
  const totalBefore = town.totalMoney();

  town.procurementPhase();

  assert.equal(builder.cash, builderBefore - 16 - 5 + 28);
  assert.equal(housing.cash, housingBefore - 28);
  assert.equal(housing.dwellingCapacity, capacityBefore + HOUSING_PROJECT_CAPACITY_GAIN);
  assert.equal(builder.inventory, 0);
  assert.match(housing.events[0].text, /expanded dwelling capacity/);
  assert.equal(town.totalMoney(), totalBefore);
  town.assertInvariants();
});

test("periodic repair projects preserve rather than expand spare capacity", () => {
  const { town, builder, housing } = foundBuilder();
  const projectContract = town.contracts.find((contract) => contract.supplierId === builder.id && contract.use === "construction-project");
  town.contracts.filter((contract) => contract !== projectContract).forEach((contract) => { contract.active = false; });
  housing.dwellingCapacity = INITIAL_DWELLING_CAPACITY + 10;
  housing.lastHousingProjectDay = 1;
  town.day = 1 + HOUSING_REPAIR_INTERVAL_DAYS;
  builder.inventory = 1;
  housing.cash = 100;
  const capacityBefore = housing.dwellingCapacity;

  town.procurementPhase();

  assert.equal(housing.dwellingCapacity, capacityBefore);
  assert.equal(housing.lastHousingProjectDay, town.day);
  assert.match(housing.events[0].text, /completed a housing repair project/);
});

test("deferred repairs remove dwellings and displace the least-resourced tenants", () => {
  const town = new TownSimulation({ seed: 42, housingCapacityEnabled: true });
  const housing = town.firms.find((firm) => firm.sector === "housing");
  const poorest = town.people.reduce((candidate, person) => person.cash < candidate.cash ? person : candidate);
  town.day = housing.lastHousingProjectDay + HOUSING_REPAIR_INTERVAL_DAYS + HOUSING_REPAIR_GRACE_DAYS + 1;

  assert.equal(town.resolveHousingCapacity(), true);
  assert.equal(housing.dwellingCapacity, INITIAL_DWELLING_CAPACITY - 1);
  assert.equal(poorest.housed, false);
  assert.match(poorest.events[0].text, /repairs removed their dwelling/);
  assert.equal(town.resolveHousingCapacity(), false);
});

test("builder insolvency ends its jobs and construction contracts", () => {
  const { town, builder } = foundBuilder();
  const worker = town.people[builder.owner];

  town.closeFirm(builder, "construction income could not sustain operations");

  assert.equal(worker.employer, -1);
  assert.equal(builder.employees.length, 0);
  assert.equal(town.contracts.filter((contract) => (contract.buyerId === builder.id || contract.supplierId === builder.id) && contract.active).length, 0);
});
