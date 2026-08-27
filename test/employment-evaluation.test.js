import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_EMPLOYMENT_EVALUATION_SEEDS,
  evaluateEmploymentIntervention,
  formatEmploymentEvaluation,
} from "../src/employment-evaluation.ts";

test("the paired employment evaluator is deterministic, serializable, and cash-conserving", () => {
  const config = { seeds: [20260823, 101], days: 60 };
  const first = evaluateEmploymentIntervention(config);
  const replay = evaluateEmploymentIntervention(config);

  assert.deepEqual(first, replay);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(first)));
  assert.ok(first.runs.every((run) => run.control.cash.conserved && run.treatment.cash.conserved));
  assert.ok(first.runs.every((run) => run.control.trajectory.length === 60 && run.treatment.trajectory.length === 60));
  assert.ok(first.runs.every((run) => run.control.trajectory.every((day) => day.employed + day.unemployed === day.alive)));
});

test("the disabled control locks the reproducible wage and completed-day mortality baselines", () => {
  const report = evaluateEmploymentIntervention({ seeds: DEFAULT_EMPLOYMENT_EVALUATION_SEEDS, days: 60 });

  assert.deepEqual(report.runs.map((run) => run.control.firstWagesByDay30), [1, 2, 1, 1, 1, 1]);
  assert.deepEqual(report.runs.map((run) => run.control.deathsByDay60), [22, 32, 20, 21, 22, 22]);
  assert.equal(report.controlBaseline.firstWages.matches, true);
  assert.equal(report.controlBaseline.deaths.matches, true);
});

test("the report exposes paired outcomes, causal event counts, and explicit acceptance gates", () => {
  const report = evaluateEmploymentIntervention({ seeds: [20260823], days: 60 });
  const run = report.runs[0];

  for (const arm of [run.control, run.treatment]) {
    assert.equal(typeof arm.firstWagesByDay30, "number");
    assert.equal(typeof arm.deathsByDay60, "number");
    assert.ok(Array.isArray(arm.firstWageCitizenIds));
    assert.ok(Array.isArray(arm.fundedSlots));
    assert.ok(Array.isArray(arm.formations));
    assert.ok(Array.isArray(arm.closures));
    assert.deepEqual(Object.keys(arm.totals), [
      "applications", "offers", "hires", "layoffs", "wages", "support",
      "hungerEvents", "housingEvents", "healthEvents", "deaths",
    ]);
  }
  assert.deepEqual(Object.keys(report.criteria), [
    "controlBaseline", "matureSlotsByDay7", "firstWagesByDay30", "mortality",
  ]);
  assert.match(formatEmploymentEvaluation(report), /Morrow employment intervention/);
  assert.match(formatEmploymentEvaluation(report), /seed 20260823/);
});

test("employment evaluation rejects invalid configurations", () => {
  assert.throws(() => evaluateEmploymentIntervention({ seeds: [], days: 60 }), /integer seed/);
  assert.throws(() => evaluateEmploymentIntervention({ seeds: [1], days: 0 }), /positive integer/);
  assert.throws(() => evaluateEmploymentIntervention({ seeds: [1], days: 30 }), /at least 60/);
});
