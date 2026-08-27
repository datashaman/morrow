import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSchedules, formatScheduleEvaluation, SCHEDULE_MODES } from "../src/schedule-evaluation.ts";

const config = { seeds: [42], days: 14 };

test("schedule evaluation replays three modes deterministically and conserves cash", () => {
  const first = evaluateSchedules(config);
  const replay = evaluateSchedules(config);

  assert.deepEqual(first, replay);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(first)));
  assert.equal(first.status, "passed");
  assert.deepEqual(first.metadata.modes, SCHEDULE_MODES.map((mode) => mode.id));
  assert.ok(first.runs[0].modes.every((mode) => mode.cash.conserved && mode.trajectory.length === 14));
});

test("schedule report includes access, work, activity, sleep, food, population, and business evidence", () => {
  const report = evaluateSchedules(config);
  const run = report.runs[0];
  run.modes.forEach((mode) => assert.deepEqual(Object.keys(mode), [
    "mode", "completedDays", "trajectory", "access", "work", "activity", "sleep", "food", "population", "business", "cash",
  ]));
  assert.equal(run.modes[0].sleep.nights, 0);
  assert.ok(run.modes[2].sleep.nights > 0);
  assert.match(formatScheduleEvaluation(report), /3 modes × 14 days · PASSED/);
  assert.ok("sleepVsSchedules" in run.deltas);
});

test("schedule evaluation rejects invalid configurations", () => {
  assert.throws(() => evaluateSchedules({ seeds: [], days: 14 }), /integer seed/);
  assert.throws(() => evaluateSchedules({ seeds: [42], days: 0 }), /positive integer/);
});
