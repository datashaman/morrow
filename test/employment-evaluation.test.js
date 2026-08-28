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
  assert.ok(first.runs.every((run) => [run.control, run.treatment].every((arm) => arm.trajectory.length > 0 && arm.trajectory.length <= 60)));
  assert.ok(first.runs.every((run) => run.control.trajectory.every((day) => day.employed + day.unemployed === day.workforceAdults)));
});

test("the disabled control locks the reproducible wage and completed-day mortality baselines", () => {
  const report = evaluateEmploymentIntervention({ seeds: DEFAULT_EMPLOYMENT_EVALUATION_SEEDS, days: 60 });

  assert.deepEqual(report.runs.map((run) => run.control.firstWagesByDay30), [1, 1, 1, 1, 1, 0]);
  assert.deepEqual(report.runs.map((run) => run.control.deathsByDay60), [40, 40, 22, 25, 22, 22]);
  assert.equal(report.controlBaseline.firstWages.matches, true);
  assert.equal(report.controlBaseline.deaths.matches, true);
  assert.deepEqual(report.gates.fundedOpportunitiesByDay7.observed, [5, 3, 2, 4, 1, 2]);
  assert.equal(report.gates.fundedOpportunitiesByDay7.passed, true);
  assert.equal(report.gates.firstWagesByDay30.passed, false);
  assert.equal(report.gates.mortality.passed, false);
  assert.equal(report.status, "failed");
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
    "controlBaseline", "fundedOpportunitiesByDay7", "firstWagesByDay30", "mortality",
  ]);
  assert.match(formatEmploymentEvaluation(report), /Morrow employment intervention/);
  assert.match(formatEmploymentEvaluation(report), /seed 20260823/);
});

test("employment evaluation rejects invalid configurations", () => {
  assert.throws(() => evaluateEmploymentIntervention({ seeds: [], days: 60 }), /integer seed/);
  assert.throws(() => evaluateEmploymentIntervention({ seeds: [1], days: 0 }), /positive integer/);
  assert.throws(() => evaluateEmploymentIntervention({ seeds: [1], days: 30 }), /at least 60/);
});
