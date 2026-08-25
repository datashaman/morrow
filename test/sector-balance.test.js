import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSectorBalance, formatSectorBalance, SECTOR_BALANCE_SCHEMA_VERSION } from "../src/sector-balance.ts";

const config = { seeds: [42], days: 8 };

test("sector balance is deterministic, serializable, and invariant-safe", () => {
  const first = evaluateSectorBalance(config);
  const replay = evaluateSectorBalance(config);

  assert.deepEqual(first, replay);
  assert.doesNotThrow(() => JSON.stringify(first));
  assert.equal(first.status, "passed");
  assert.equal(first.metadata.schemaVersion, SECTOR_BALANCE_SCHEMA_VERSION);
  assert.match(first.metadata.invariantChecks, /exact-transfer safety/);
  assert.ok(first.runs.every((run) => run.baseline.cash.conserved && run.expanded.cash.conserved));
});

test("sector balance reports work, firms, access, hardship, and explicit sector states", () => {
  const report = evaluateSectorBalance(config);
  const run = report.runs[0];

  assert.equal(run.seed, 42);
  assert.equal(run.baseline.access.dwellingCapacity, null);
  assert.equal(typeof run.expanded.access.dwellingCapacity, "number");
  assert.equal(typeof run.expanded.work.unemployed, "number");
  assert.equal(typeof run.expanded.work.vacancies, "number");
  assert.equal(typeof run.expanded.work.netWagesPaid, "number");
  assert.ok(Array.isArray(run.expanded.business.formations));
  assert.ok(Array.isArray(run.expanded.business.closures));
  assert.equal(typeof run.expanded.business.insolvencies, "number");
  assert.equal(typeof run.expanded.business.replacements, "number");
  assert.deepEqual(Object.keys(run.expanded.business.sectors), ["apothecary", "school", "materials-yard", "clinic", "builder", "haulage", "housing-provider"]);
  Object.values(run.expanded.business.sectors).forEach((sector) => assert.match(sector.state, /^(operating|constrained|failed|absent)$/));
  assert.equal(typeof run.expanded.access.clinicalTreatments, "number");
  assert.equal(typeof run.expanded.access.educationLessons, "number");
  assert.equal(typeof run.expanded.access.supportPaid, "number");
  assert.equal(typeof run.expanded.population.extinct, "boolean");
  assert.match(formatSectorBalance(report), /Unexpected regressions retained:/);
});

test("sector balance rejects invalid seed and horizon configurations", () => {
  assert.throws(() => evaluateSectorBalance({ seeds: [], days: 8 }), /integer seed/);
  assert.throws(() => evaluateSectorBalance({ seeds: [42.5], days: 8 }), /integer seed/);
  assert.throws(() => evaluateSectorBalance({ seeds: [42], days: 0 }), /positive integer/);
});
