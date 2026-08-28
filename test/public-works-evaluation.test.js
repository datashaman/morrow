import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PUBLIC_WORKS_EVALUATION_DAYS,
  DEFAULT_PUBLIC_WORKS_EVALUATION_SEEDS,
  evaluatePublicWorks,
  formatPublicWorksEvaluation,
} from "../src/public-works-evaluation.ts";

const report = evaluatePublicWorks({ seeds: [61], days: 14 });

test("public-works evaluation is paired, deterministic, serializable, and cash-conserving", () => {
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(report)));
  assert.equal(report.runs[0].deterministicReplay, true);
  assert.equal(report.runs[0].disabled.cash.conserved, true);
  assert.equal(report.runs[0].enabled.cash.conserved, true);
  assert.equal(report.gates.technicalIntegrity, true);
});

test("the paired report exposes jobs, spending, welfare, food, care, lifecycle, mortality, and extinction", () => {
  const run = report.runs[0];
  assert.equal(run.disabled.jobs.formed, false);
  assert.equal(run.disabled.publicService.startupSpending, 0);
  assert.equal(run.enabled.jobs.fundedJobs, 2);
  assert.ok(run.enabled.jobs.firstWageRecipients.length > 0);
  assert.ok(run.enabled.publicService.startupSpending > 0);
  assert.ok(run.enabled.publicService.serviceSpending > 0);
  ["welfareFlow", "foodDeliveryRate", "dependentFoodDelivered", "dependentHealthFunded", "maturations", "deaths", "extinctionDay"].forEach((field) => {
    assert.equal(Number.isFinite(run.delta[field]), true, field);
  });
  assert.match(formatPublicWorksEvaluation(report), /gates: integrity PASS/);
  assert.match(report.metadata.welfareDisplacementDefinition, /paired gameplay observation/);
});

test("public-works evaluator defaults and invalid configurations are explicit", () => {
  assert.deepEqual([...DEFAULT_PUBLIC_WORKS_EVALUATION_SEEDS], [101, 202, 303, 404, 505]);
  assert.equal(DEFAULT_PUBLIC_WORKS_EVALUATION_DAYS, 196);
  assert.throws(() => evaluatePublicWorks({ seeds: [], days: 14 }), /integer seed/);
  assert.throws(() => evaluatePublicWorks({ seeds: [1.2], days: 14 }), /integer seed/);
  assert.throws(() => evaluatePublicWorks({ seeds: [61], days: 0 }), /positive integer/);
  assert.equal(evaluatePublicWorks({ seeds: [61], days: 1, replay: false }).gates.technicalIntegrity, false);
});
