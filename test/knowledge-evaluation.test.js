import assert from "node:assert/strict";
import test from "node:test";
import { FIRMS } from "../src/config.js";
import {
  evaluateKnowledgeTracer,
  formatKnowledgeEvaluation,
  KNOWLEDGE_SECTOR_FIXTURE_DAYS,
  KNOWLEDGE_WHOLE_TOWN_DAYS,
  KNOWLEDGE_WHOLE_TOWN_SEEDS,
} from "../src/knowledge-evaluation.ts";

const config = { seeds: [42], days: 10 };
const report = evaluateKnowledgeTracer(config);

test("cross-trade knowledge evaluation is deterministic, serializable, and invariant-safe", () => {
  const replay = evaluateKnowledgeTracer(config);

  assert.deepEqual(report, replay);
  assert.doesNotThrow(() => JSON.stringify(report));
  assert.equal(report.status, "passed");
  assert.ok(Object.values(report.checks).every(Boolean));
  assert.equal(report.metadata.schemaVersion, 2);
  assert.equal(KNOWLEDGE_SECTOR_FIXTURE_DAYS, 30);
  assert.equal(KNOWLEDGE_WHOLE_TOWN_DAYS, 60);
  assert.deepEqual(KNOWLEDGE_WHOLE_TOWN_SEEDS, [20260823, 101, 202, 303, 404, 505]);
});

test("zero-start sector fixtures naturally learn and use every configured effect", () => {
  assert.equal(report.sectorFixtures.length, FIRMS.length);
  report.sectorFixtures.forEach((fixture) => {
    assert.equal(fixture.scalar.initialVocationalKnowledge, 0, fixture.archetypeId);
    assert.equal(fixture.knowledge.initialVocationalKnowledge, 0, fixture.archetypeId);
    assert.equal(fixture.scalar.learningRecords, 0, fixture.archetypeId);
    assert.equal(fixture.scalar.effects.gross, 0, fixture.archetypeId);
    assert.ok(fixture.knowledge.learningRecords > 0, fixture.archetypeId);
    assert.ok(fixture.knowledge.effects.gross > 0, fixture.archetypeId);
    assert.ok(fixture.knowledge.effects.used > 0, fixture.archetypeId);
    assert.equal(fixture.knowledge.fundedDemand, true, fixture.archetypeId);
    assert.equal(fixture.knowledge.inputAvailable, true, fixture.archetypeId);
    if (fixture.effectType === "direct-yield") assert.ok(fixture.deltas.directAdditionalOutput > 0, fixture.archetypeId);
    else assert.ok(fixture.knowledge.effects.released > 0, fixture.archetypeId);
  });
});

test("whole-town pairs report formation, domain learning, effects, sales, welfare, replay, and conservation deltas", () => {
  const pair = report.pairs[0];

  assert.equal(pair.scalar.learning.records, 0);
  assert.ok(pair.knowledge.learning.records > 0);
  assert.ok(Object.keys(pair.knowledge.learning.domains).length > 0);
  assert.ok(Object.keys(pair.knowledge.effects).length === FIRMS.length);
  assert.ok(Object.keys(pair.knowledge.sales.byArchetype).length === FIRMS.length);
  assert.ok(Array.isArray(pair.knowledge.formationCoverage.formedArchetypes));
  assert.equal(pair.replay.scalar, true);
  assert.equal(pair.replay.knowledge, true);
  ["sales", "employed", "hungry", "unhoused", "alive", "dead", "insolventFirms", "cash"].forEach((field) => {
    assert.equal(Number.isFinite(pair.deltas[field]), true, field);
  });
  assert.match(formatKnowledgeEvaluation(report), /Sector fixtures: 12\/12 archetypes/);
  assert.match(report.metadata.interpretation, /not directional targets or empirical claims/);
});

test("knowledge evaluation rejects invalid configurations", () => {
  assert.throws(() => evaluateKnowledgeTracer({ seeds: [], days: 10 }), /integer seed/);
  assert.throws(() => evaluateKnowledgeTracer({ seeds: [1.2], days: 10 }), /integer seed/);
  assert.throws(() => evaluateKnowledgeTracer({ seeds: [42], days: 0 }), /positive integer/);
});
