import assert from "node:assert/strict";
import test from "node:test";
import { OPPORTUNITY_OBSERVATION_DAYS, OPPORTUNITY_STARTUP_CAPITAL, STAFFING_REVENUE_BUFFER } from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

function observeMaterialsWindow(town) {
  let result;
  for (let offset = 0; offset < OPPORTUNITY_OBSERVATION_DAYS; offset += 1) {
    town.day = offset + 1;
    const observed = town.observeFirmOpportunities();
    result = Array.isArray(observed) ? observed.find((entry) => entry.archetypeId === "materials-yard") : observed;
  }
  return result;
}

function foundMaterialsYard(seed = 42) {
  const town = new TownSimulation({ seed, policy: { shockRisk: 0 } });
  town.people.forEach((person) => { person.cash = 100; });
  town.initialMoney = town.totalMoney();
  return { town, yard: observeMaterialsWindow(town) };
}

test("Morrow Materials exposes the explicit guild-to-yard-to-builder pipeline", () => {
  const town = new TownSimulation({ seed: 42 });
  const archetype = town.firmArchetype("materials-yard");
  const templates = town.contractTemplatesFor(archetype);

  assert.equal(archetype.input, "learningGoods");
  assert.equal(archetype.source, "Makers Guild");
  assert.equal(archetype.sells, "constructionMaterials");
  assert.ok(templates.some((contract) => contract.supplier === "Makers Guild" && contract.buyer === "Morrow Materials" && contract.use !== "operations"));
  assert.ok(templates.some((contract) => contract.supplier === "Morrow Materials" && contract.buyer === "Morrow Builders"));
});

test("active housing demand can found a one-worker materials yard", () => {
  const town = new TownSimulation({ seed: 42 });
  town.people.forEach((person) => { person.cash = 100; });
  town.initialMoney = town.totalMoney();
  const totalBefore = town.totalMoney();
  const yard = observeMaterialsWindow(town);
  const founder = town.people[yard.owner];

  assert.equal(yard.instanceId, "materials-yard:1");
  assert.equal(founder.employer, yard.id);
  assert.equal(yard.cash, OPPORTUNITY_STARTUP_CAPITAL);
  assert.equal(yard.inventory, 0);
  assert.deepEqual(yard.employees, [founder.id]);
  assert.equal(town.contracts.filter((contract) => contract.buyerId === yard.id).length, 2);
  assert.equal(town.contracts.filter((contract) => contract.supplierId === yard.id).length, 0);
  assert.equal(town.totalMoney(), totalBefore);
  town.assertInvariants();
});

test("missing Makers Guild supply blocks materials-yard formation", () => {
  const town = new TownSimulation({ seed: 42 });
  town.people.forEach((person) => { person.cash = 100; });
  const makers = town.firms.find((firm) => firm.name === "Makers Guild");
  makers.active = false;
  makers.status = "insolvent";
  town.initialMoney = town.totalMoney();

  const opportunity = observeMaterialsWindow(town);

  assert.equal(opportunity.ready, false);
  assert.match(opportunity.reasons.join(" "), /missing active suppliers?: Makers Guild/);
  assert.equal(town.firms.some((firm) => firm.archetypeId === "materials-yard"), false);
});

test("procurement converts exact guild inputs into stocked construction materials", () => {
  const { town, yard } = foundMaterialsYard();
  const makers = town.firms.find((firm) => firm.name === "Makers Guild");
  makers.inventory = 20;
  yard.cash = 100;
  town.initialMoney = town.totalMoney();
  const totalBefore = town.totalMoney();

  town.procurementPhase();

  assert.equal(yard.inventory, 1);
  assert.equal(yard.operatingSupplies, 1);
  assert.ok(yard.ledger.some((entry) => /kit from Makers Guild/.test(entry.text)));
  assert.equal(town.totalMoney(), totalBefore);
  town.assertInvariants();
});

test("a delivered fabrication kit remains input stock when no yard worker attends", () => {
  const { town, yard } = foundMaterialsYard();
  const makers = town.firms.find((firm) => firm.name === "Makers Guild");
  const fabricationContract = town.contracts.find((contract) => contract.buyerId === yard.id && contract.use !== "operations");
  const worker = town.people[yard.owner];
  town.contracts.filter((contract) => contract !== fabricationContract).forEach((contract) => { contract.active = false; });
  makers.inventory = 20;
  yard.inventory = 0;
  yard.cash = 100;
  worker.attended = false;
  town.initialMoney = town.totalMoney();

  town.procurementPhase();

  assert.equal(fabricationContract.deliveredToday, 1);
  assert.equal(yard.inputInventory, 1);
  assert.equal(yard.inventory, 0);
  assert.equal(yard.processingCapacityToday, 0);
  assert.equal(yard.processedToday, 0);
  assert.equal(yard.processingShortfallToday, 1);
  assert.equal(town.totalMoney(), town.initialMoney);
  town.assertInvariants();
});

test("maintenance readiness floors yard processing to whole units", () => {
  const { town, yard } = foundMaterialsYard();
  const secondWorker = town.people.find((person) => person.employer < 0 && person.id !== yard.owner);
  town.contracts.forEach((contract) => { contract.active = false; });
  secondWorker.employer = yard.id;
  yard.employees.push(secondWorker.id);
  yard.employees.forEach((id) => { town.people[id].attended = true; });
  yard.operationalReadiness = 0.65;
  yard.inputInventory = 3;
  yard.inventory = 0;

  town.procurementPhase();

  assert.equal(yard.processingCapacityToday, 1);
  assert.equal(yard.processedToday, 1);
  assert.equal(yard.inputInventory, 2);
  assert.equal(yard.inventory, 1);
  assert.equal(yard.processingShortfallToday, 2);
  assert.match(yard.events[0].text, /labor capacity left 2 kits unprocessed/);
  town.assertInvariants();
});

test("realized income can approve another materials job while raw transaction counts cannot", () => {
  const { town, yard } = foundMaterialsYard();
  yard.cash = yard.wage * 10;
  yard.revenueEMA = yard.wage * STAFFING_REVENUE_BUFFER * 3.1;
  yard.transactionsToday = 0;

  town.prepareFirmSettlement(yard);
  assert.equal(yard.targetStaff, 2);

  yard.revenueEMA = 0;
  yard.transactionsToday = 999;
  town.prepareFirmSettlement(yard);
  assert.equal(yard.targetStaff, 1);
});

test("materials-yard insolvency ends jobs and both sides of its pipeline", () => {
  const { town, yard } = foundMaterialsYard();
  const worker = town.people[yard.owner];

  town.closeFirm(yard, "construction income could not sustain the yard");

  assert.equal(worker.employer, -1);
  assert.equal(yard.employees.length, 0);
  assert.equal(town.contracts.filter((contract) => (contract.supplierId === yard.id || contract.buyerId === yard.id) && contract.active).length, 0);
});

test("materials-yard formation reproduces from the same seed", () => {
  const first = foundMaterialsYard(404);
  const second = foundMaterialsYard(404);
  assert.deepEqual(
    { owner: first.yard.owner, day: first.yard.foundingDay, staff: first.yard.employees },
    { owner: second.yard.owner, day: second.yard.foundingDay, staff: second.yard.employees },
  );
});
