import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_WORKS_STARTUP_CAPITAL,
  PUBLIC_WORKS_TREASURY_RESERVE,
} from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

test("the public-realm contractor is absent when its tracer is disabled", () => {
  const town = new TownSimulation({ seed: 42 });

  assert.equal(town.firms.some((firm) => firm.archetypeId === "public-works"), false);
  assert.equal(town.resolvePublicWorksFormation(), false);
});

test("finite treasury capital forms two traced public-realm jobs without creating money", () => {
  const town = new TownSimulation({ seed: 42, publicWorksEnabled: true, policy: { shockRisk: 0 } });
  const treasuryBefore = town.government.cash;
  const totalBefore = town.totalMoney();

  assert.equal(town.resolvePublicWorksFormation(), true);

  const firm = town.firms.find((candidate) => candidate.archetypeId === "public-works");
  assert.ok(firm);
  assert.equal(firm.name, "Morrow Civic Works");
  assert.equal(firm.cash, PUBLIC_WORKS_STARTUP_CAPITAL);
  assert.equal(firm.employees.length, 2);
  assert.equal(firm.owner, firm.employees[0]);
  assert.equal(town.government.cash, treasuryBefore - PUBLIC_WORKS_STARTUP_CAPITAL);
  assert.ok(town.government.cash >= PUBLIC_WORKS_TREASURY_RESERVE);
  assert.equal(town.totalMoney(), totalBefore);
  assert.match(firm.ledger[0].text, /public-realm startup from treasury/);
  assert.match(town.government.ledger[0].text, /public-realm startup to Morrow Civic Works/);
  assert.ok(town.contracts.some((contract) => contract.active && contract.buyerId === firm.id && contract.use === "operations"));
  town.assertInvariants();
});

test("public-realm formation waits for retained treasury cash and available workers", () => {
  const unfunded = new TownSimulation({ seed: 42, publicWorksEnabled: true });
  unfunded.government.cash = PUBLIC_WORKS_STARTUP_CAPITAL + PUBLIC_WORKS_TREASURY_RESERVE - 0.01;
  unfunded.initialMoney = unfunded.totalMoney();
  assert.equal(unfunded.resolvePublicWorksFormation(), false);

  const unstaffed = new TownSimulation({ seed: 42, publicWorksEnabled: true });
  unstaffed.replacementWorkers = () => [];
  assert.equal(unstaffed.resolvePublicWorksFormation(), false);
});

test("the treasury exact-pays only attended whole public-realm service", () => {
  const town = new TownSimulation({ seed: 42, publicWorksEnabled: true, policy: { shockRisk: 0 } });
  town.resolvePublicWorksFormation();
  const firm = town.firms.find((candidate) => candidate.archetypeId === "public-works");
  firm.employees.forEach((id) => { town.people[id].attended = true; });
  firm.operationalReadiness = 1;
  town.government.cash = 100;
  town.initialMoney = town.totalMoney();
  const treasuryBefore = town.government.cash;
  const firmBefore = firm.cash;
  const totalBefore = town.totalMoney();

  const record = town.settlePublicWorksContract();

  assert.equal(record.requestedUnits, 2);
  assert.equal(record.deliveredUnits, 2);
  assert.equal(record.paid, firm.price * 2);
  assert.equal(town.government.cash, treasuryBefore - record.paid);
  assert.equal(firm.cash, firmBefore + record.paid);
  assert.equal(firm.sales, record.paid);
  assert.equal(firm.unitsSold, 2);
  assert.equal(town.government.ledger[0].transactionId, firm.ledger[0].transactionId);
  assert.equal(town.totalMoney(), totalBefore);
  town.assertInvariants();
});

test("absence, closure, and insufficient treasury cash prevent unbacked public service", () => {
  const town = new TownSimulation({ seed: 42, publicWorksEnabled: true });
  town.resolvePublicWorksFormation();
  const firm = town.firms.find((candidate) => candidate.archetypeId === "public-works");
  firm.employees.forEach((id) => { town.people[id].attended = true; });
  firm.operationalReadiness = 1;
  town.government.cash = firm.price * 2 - 0.01;
  town.initialMoney = town.totalMoney();
  const before = { treasury: town.government.cash, firm: firm.cash };

  const unfunded = town.settlePublicWorksContract();

  assert.equal(unfunded.deliveredUnits, 0);
  assert.equal(unfunded.failureReason, "insufficient treasury cash for the complete service batch");
  assert.deepEqual({ treasury: town.government.cash, firm: firm.cash }, before);

  firm.employees.forEach((id) => { town.people[id].attended = false; });
  assert.equal(town.settlePublicWorksContract().failureReason, "no attended public-realm capacity");

  town.closeFirm(firm);
  assert.equal(town.settlePublicWorksContract(), null);
});
