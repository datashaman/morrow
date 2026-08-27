import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDevelopmentSensitivity, formatDevelopmentSensitivity } from "../src/development-sensitivity.ts";

const config = {
  seeds: [42],
  days: 12,
  scenarios: [
    { id: "baseline", policy: {} },
    { id: "high-wage", policy: { minimumWage: 10 } },
  ],
};

test("development sensitivity is deterministic, serializable, and behavior-neutral", () => {
  const first = evaluateDevelopmentSensitivity(config);
  const replay = evaluateDevelopmentSensitivity(config);

  assert.deepEqual(first, replay);
  assert.doesNotThrow(() => JSON.stringify(first));
  assert.equal(first.status, "passed");
  assert.ok(first.runs.every((run) => run.cash.conserved));
  assert.equal(first.metadata.interpretation, "Deterministic gameplay sensitivity only; not empirical calibration, validation, forecast, or policy evidence.");
});

test("report records formation, founders, stages, outcomes, failures, and degenerate flags", () => {
  const report = evaluateDevelopmentSensitivity(config);
  const baseline = report.runs.find((run) => run.scenario === "baseline");
  const highWage = report.runs.find((run) => run.scenario === "high-wage");

  assert.ok(Array.isArray(baseline.openings));
  assert.ok(baseline.openings.every((opening) => Number.isInteger(opening.founderId) && opening.founderName));
  assert.ok(Array.isArray(baseline.stageTransitions));
  assert.equal(typeof baseline.final.survivalRate, "number");
  assert.equal(typeof baseline.final.employmentRate, "number");
  assert.equal(typeof baseline.final.hardshipRate, "number");
  assert.ok(Array.isArray(baseline.final.firmFailures));
  assert.equal(baseline.flags.neverFormedOptionalFirm, false);
  assert.equal(highWage.flags.neverFormedOptionalFirm, true);
  assert.deepEqual(report.highlights.neverFormed, [{ seed: 42, scenario: "high-wage" }]);
  assert.match(formatDevelopmentSensitivity(report), /Never formed: high-wage\/42/);
});

test("development sensitivity rejects invalid configurations", () => {
  assert.throws(() => evaluateDevelopmentSensitivity({ seeds: [], days: 10 }), /integer seed/);
  assert.throws(() => evaluateDevelopmentSensitivity({ seeds: [42], days: 0 }), /positive integer/);
  assert.throws(() => evaluateDevelopmentSensitivity({ seeds: [42], days: 10, scenarios: [] }), /named scenario/);
  assert.throws(() => evaluateDevelopmentSensitivity({ seeds: [42], days: 10, scenarios: [{ id: "same", policy: {} }, { id: "same", policy: {} }] }), /unique/);
});
