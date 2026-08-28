import assert from "node:assert/strict";
import test from "node:test";
import { evaluateWelfare, formatWelfareEvaluation, WELFARE_EVALUATION_MODES } from "../src/welfare-evaluation.ts";

const config = { seeds: [61], days: 7 };

test("welfare evaluation replays four isolated modes deterministically", () => {
  const report = evaluateWelfare(config);

  assert.doesNotThrow(() => JSON.parse(JSON.stringify(report)));
  assert.equal(report.status, "passed");
  assert.deepEqual(report.metadata.modes, [...WELFARE_EVALUATION_MODES]);
  assert.equal(report.runs[0].deterministicReplay, true);
  assert.deepEqual(report.runs[0].modes.map((mode) => mode.mode), ["none", "legacy-cash", "direct-only", "combined"]);
  assert.ok(report.runs[0].modes.every((mode) => Object.values(mode.hardChecks).every(Boolean)));
});

test("welfare report includes programme, treasury, provider, outcome, exclusion, and invariant evidence", () => {
  const report = evaluateWelfare(config);
  report.runs[0].modes.forEach((mode) => {
    assert.deepEqual(Object.keys(mode), ["mode", "completedDays", "trajectory", "programmes", "treasury", "providers", "outcomes", "hardChecks"]);
    assert.ok("takeUpRate" in mode.programmes.food);
    assert.ok("separateFundBalance" in mode.treasury);
    assert.ok("welfareRevenueByProvider" in mode.providers);
    assert.ok("nonRecipientHardship" in mode.outcomes);
  });
  assert.match(formatWelfareEvaluation(report), /4 modes × 7 days · PASSED/);
  assert.match(report.metadata.interpretation, /observations—not pass criteria/);
});

test("welfare evaluation rejects invalid configurations", () => {
  assert.throws(() => evaluateWelfare({ seeds: [], days: 7 }), /integer seed/);
  assert.throws(() => evaluateWelfare({ seeds: [61], days: 0 }), /positive integer/);
});
