import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePolicies, formatEvaluationSummary } from "../src/policy-evaluation.ts";

test("multi-seed policy evaluation is deterministic and compares against the rule baseline", () => {
  const config = { seeds: [11, 22], days: 5, policies: ["motivation"], baseline: "rule" };
  const first = evaluatePolicies(config);
  const replay = evaluatePolicies(config);

  assert.deepEqual(first, replay);
  assert.equal(first.status, "passed");
  assert.deepEqual(first.metadata.seeds, [11, 22]);
  assert.deepEqual(first.metadata.policies, ["rule", "motivation"]);
  assert.equal(first.aggregates.rule.runs, 2);
  assert.equal(first.aggregates.motivation.runs, 2);
  assert.equal(first.comparisons.motivation.baseline, "rule");
  assert.ok("survivalRate" in first.comparisons.motivation.deltas);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(first)));
});

test("evaluation reports required outcomes, conserved cash, and action distributions", () => {
  const report = evaluatePolicies({ seeds: [42], days: 4, policies: ["motivation"] });
  const run = report.runs.find(({ name }) => name === "motivation").result;

  assert.deepEqual(Object.keys(run.final), ["alive", "dead", "totalCitizens", "hungry", "unhoused", "employed", "insolventFirms", "totalFirms"]);
  assert.equal(run.cash.conserved, true);
  assert.equal(run.cash.difference, 0);
  assert.equal(run.invalidActions, 0);
  assert.ok(Object.values(run.actionCounts).reduce((total, count) => total + count, 0) > 0);
  assert.ok(run.shadow.decisions > 0);
  assert.ok(run.shadow.divergenceRate >= 0 && run.shadow.divergenceRate <= 1);
  assert.ok(run.shadow.invalidPreferenceRate >= 0 && run.shadow.invalidPreferenceRate <= 1);
  assert.ok("missedShiftDelta" in run.shadow.outcomeProjections);
  assert.match(formatEvaluationSummary(report), /Morrow policy evaluation/);
  assert.match(formatEvaluationSummary(report), /motivation − rule/);
});

test("invalid policy actions are hard evaluation failures", () => {
  const report = evaluatePolicies({
    seeds: [42],
    days: 2,
    baseline: "invalid",
    policies: [],
    policyFactories: {
      invalid: () => ({ id: "invalid-test", decide: () => ({ action: "break-the-world", reasons: [] }) }),
    },
  });
  const run = report.runs[0].result;

  assert.equal(report.status, "failed");
  assert.equal(run.status, "failed");
  assert.equal(run.invalidActions, 1);
  assert.match(run.failure, /illegal .* action/i);
});

test("evaluation rejects missing seeds, invalid days, and unknown policies", () => {
  assert.throws(() => evaluatePolicies({ seeds: [], days: 1 }), /At least one/);
  assert.throws(() => evaluatePolicies({ seeds: [1], days: 0 }), /positive integer/);
  assert.throws(() => evaluatePolicies({ seeds: [1], days: 1, policies: ["missing"] }), /Unknown policy/);
});
