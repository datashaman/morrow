import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LATENT_FIRM_NAMES, PHASES } from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

function minimalTown(options = {}) {
  return new TownSimulation({ ...options, latentFirmNames: DEFAULT_LATENT_FIRM_NAMES });
}

function runDays(town, days) {
  for (let day = 0; day < days && !town.isExtinct(); day += 1) {
    for (let phase = 0; phase < PHASES.length; phase += 1) town.step();
  }
  return town;
}

test("Morrow starts with an essential four-firm foundation and two visible opportunities", () => {
  const town = minimalTown({ seed: 42 });

  assert.deepEqual(town.firms.map((firm) => firm.name), ["Harvest Foods", "HomeWorks", "Makers Guild", "Morrow Fields"]);
  assert.deepEqual(town.firmOpportunities().map((opportunity) => opportunity.name), ["Common Café", "Green Basket"]);
  assert.ok(town.firmOpportunities().every((opportunity) => opportunity.observedDays === 0 && !opportunity.ready));
  assert.deepEqual(town.contracts.map((contract) => `${contract.supplier} → ${contract.buyer}`), [
    "Morrow Fields → Harvest Foods",
    "Makers Guild → Harvest Foods",
    "Makers Guild → HomeWorks",
    "Makers Guild → Morrow Fields",
  ]);
  town.firms.forEach((firm) => {
    assert.equal(town.people[firm.owner].employer, firm.id);
    assert.equal(firm.employees.length, firm.initialStaff);
  });
  town.validateProductGraph();
  town.assertInvariants();
});

test("the foundational graph supports food transactions on its first day", () => {
  const town = minimalTown({ seed: 42, policy: { shockRisk: 0 } });
  const initialMoney = town.totalMoney();

  for (let phase = 0; phase < PHASES.length; phase += 1) town.step();

  assert.ok(town.people.some((person) => person.ledger.some((entry) => /bought .* food portion.* from Harvest Foods/.test(entry.text))));
  assert.equal(town.totalMoney(), initialMoney);
  town.assertInvariants();
});

test("minimal starts permit optional formation without eliminating hardship", () => {
  const formation = runDays(minimalTown({ seed: 42, policy: { discretionaryDemand: 100, shockRisk: 0 } }), 30);
  const hardship = runDays(minimalTown({ seed: 404, policy: { supportRate: 0, shockRisk: 40 } }), 30);

  const premium = formation.firms.find((firm) => firm.archetypeId === "premium-grocer");
  assert.ok(premium);
  assert.equal(premium.foundingDay, 7);
  assert.ok(formation.opportunityHistory.some((entry) => entry.foundedInstanceId === premium.instanceId));
  assert.ok(hardship.snapshot().dead > 0 || hardship.snapshot().unhoused > 0 || hardship.firms.some((firm) => !firm.active));
  formation.assertInvariants();
  hardship.assertInvariants();
});
