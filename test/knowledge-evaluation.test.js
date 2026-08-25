import assert from "node:assert/strict";
import test from "node:test";
import { evaluateKnowledgeTracer, formatKnowledgeEvaluation } from "../src/knowledge-evaluation.ts";

const config = { seeds: [42], days: 30 };
const report = evaluateKnowledgeTracer(config);

test("knowledge evaluation is deterministic, serializable, and invariant-safe", () => {
  const replay = evaluateKnowledgeTracer(config);

  assert.deepEqual(report, replay);
  assert.doesNotThrow(() => JSON.stringify(report));
  assert.equal(report.status, "passed");
  assert.deepEqual(report.checks, {
    cashConserved: true,
    scalarBaselineHasNoLearning: true,
    learningObserved: true,
    capacityEffectObserved: true,
  });
});

test("knowledge evaluation reports learning, capacity, and paired town outcomes", () => {
  const pair = report.pairs[0];

  assert.equal(pair.scalar.learning.records, 0);
  assert.ok(pair.knowledge.learning.records > 0);
  assert.ok(pair.knowledge.learning.sourceCounts.workplace > 0);
  assert.ok(pair.knowledge.grocery.grossKnowledgeBonusCapacityPointDays >= 1);
  assert.equal(typeof pair.deltas.groceryTransactions, "number");
  assert.equal(typeof pair.deltas.alive, "number");
  assert.equal(typeof pair.deltas.employed, "number");
  assert.equal(typeof pair.deltas.hungry, "number");
  assert.equal(typeof pair.deltas.unhoused, "number");
  assert.equal(Number.isFinite(pair.deltas.insolventFirms), true);
  assert.match(formatKnowledgeEvaluation(report), /gross capacity-point-days/);
  assert.match(report.metadata.interpretation, /not empirical evidence/);
});

test("knowledge evaluation rejects invalid configurations", () => {
  assert.throws(() => evaluateKnowledgeTracer({ seeds: [], days: 10 }), /integer seed/);
  assert.throws(() => evaluateKnowledgeTracer({ seeds: [1.2], days: 10 }), /integer seed/);
  assert.throws(() => evaluateKnowledgeTracer({ seeds: [42], days: 0 }), /positive integer/);
});
