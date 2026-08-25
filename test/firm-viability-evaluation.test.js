import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOptionalFirmViability, formatFirmViabilitySummary } from "../src/firm-viability-evaluation.ts";
import { PHASES } from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

test("optional-firm diagnostics are deterministic, serializable, and cash-conserving", () => {
  const config = { seeds: [11, 22], days: 5 };
  const first = evaluateOptionalFirmViability(config);
  const replay = evaluateOptionalFirmViability(config);

  assert.deepEqual(first, replay);
  assert.equal(first.status, "passed");
  assert.deepEqual(first.metadata.firms, ["Green Basket", "Common Café"]);
  assert.ok(first.runs.every((run) => run.cash.conserved));
  assert.equal(first.runs[0].householdPurchasingPower.length, 5);
  assert.ok(first.runs[0].householdPurchasingPower.every((day) => day.discretionaryCash >= 0));
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(first)));

  const control = new TownSimulation({ seed: 11 });
  for (let step = 0; step < 5 * PHASES.length; step += 1) control.step();
  assert.deepEqual(first.runs[0].final, control.snapshot());
});

test("the baseline separates unsupported café demand from Green Basket constraints", () => {
  const report = evaluateOptionalFirmViability({ seeds: [101], days: 40 });
  const { firms } = report.runs[0];
  const café = firms["Common Café"];
  const premium = firms["Green Basket"];

  assert.equal(café.closureDay, 32);
  assert.equal(café.primaryFinding, "unsupported-demand");
  assert.ok(café.operatingMargin < 0);
  assert.equal(café.demand.completedCustomers, café.demand.legalPotentialCustomers);
  assert.equal(café.constraints.capacityFailures, 0);
  assert.equal(café.constraints.supplyFulfillment, 1);
  assert.equal(premium.closureDay, null);
  assert.equal(premium.primaryFinding, "operating");
  assert.ok(premium.constraints.capacityFailures > 0);
  assert.match(formatFirmViabilitySummary(report), /Common Café: unsupported-demand/);
  assert.match(formatFirmViabilitySummary(report), /Green Basket: operating/);
});

test("optional-firm diagnostics reject invalid configuration and unknown firms", () => {
  assert.throws(() => evaluateOptionalFirmViability({ seeds: [], days: 1 }), /At least one/);
  assert.throws(() => evaluateOptionalFirmViability({ seeds: [1], days: 0 }), /positive integer/);
  assert.throws(() => evaluateOptionalFirmViability({ seeds: [1], days: 1, firms: ["Missing"] }), /Unknown firm/);
});
