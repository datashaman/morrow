import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LIFECYCLE_EVALUATION_DAYS, DEFAULT_LIFECYCLE_EVALUATION_SEEDS, evaluateLifecycle, formatLifecycleEvaluation, LIFECYCLE_EVALUATION_MODES } from "../src/lifecycle-evaluation.ts";

const config = { seeds: [61], days: 7 };

test("lifecycle evaluation replays paired modes deterministically and conserves cash", () => {
  const report = evaluateLifecycle(config);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(report)));
  assert.equal(report.status, "failed");
  assert.equal(report.runs[0].deterministicReplay, true);
  assert.deepEqual(report.runs[0].modes.map((mode) => mode.mode), LIFECYCLE_EVALUATION_MODES.map((mode) => mode.id));
  assert.ok(report.runs[0].modes.every((mode) => mode.cash.conserved));
  assert.equal(report.gates.technicalIntegrity.passed, true);
  assert.equal(report.gates.lifecycleReach.passed, false);
});

test("lifecycle report includes the required population, care, education, economy, and extinction evidence", () => {
  const report = evaluateLifecycle(config);
  const mode = report.runs[0].modes[0];
  assert.deepEqual(Object.keys(mode), ["mode", "requestedDays", "completedDays", "stoppedOnExtinction", "extinctionDay", "trajectory", "reproduction", "population", "care", "housing", "school", "workforce", "treasury", "firms", "cash"]);
  assert.ok("eligiblePartnershipOpportunities" in mode.reproduction);
  assert.ok("peakDependencyRatio" in mode.population);
  assert.ok("foodDemand" in mode.care && "healthFailed" in mode.care);
  assert.ok("missedLessons" in mode.school);
  assert.ok("estateDutyFlow" in mode.treasury);
  assert.match(formatLifecycleEvaluation(report), /2 modes × 7 requested days · FAILED/);
  assert.match(formatLifecycleEvaluation(report), /integrity PASS · lifecycle reach FAIL · dependent essentials PASS/);
  assert.match(report.metadata.interpretation, /not empirical or demographic validation/);
});

test("activation readiness fails when full lifecycle runs never reach maturation or deliver attempted dependent health care", () => {
  const report = evaluateLifecycle({ seeds: [101], days: 504, replay: false });

  assert.equal(report.gates.lifecycleReach.minimumCompletedDays, 168);
  assert.equal(report.gates.lifecycleReach.runsReachingMinimum, 0);
  assert.equal(report.gates.lifecycleReach.maturations, 0);
  assert.equal(report.gates.dependentEssentials.healthAttempts, 54);
  assert.equal(report.gates.dependentEssentials.healthFunded, 0);
  assert.equal(report.gates.dependentEssentials.passed, false);
  assert.equal(report.status, "failed");
});

test("lifecycle evaluation defaults match the accepted five-seed 504-day protocol", () => {
  assert.deepEqual([...DEFAULT_LIFECYCLE_EVALUATION_SEEDS], [101, 202, 303, 404, 505]);
  assert.equal(DEFAULT_LIFECYCLE_EVALUATION_DAYS, 504);
});

test("lifecycle evaluation rejects invalid configurations", () => {
  assert.throws(() => evaluateLifecycle({ seeds: [], days: 7 }), /integer seed/);
  assert.throws(() => evaluateLifecycle({ seeds: [61], days: 0 }), /positive integer/);
});
