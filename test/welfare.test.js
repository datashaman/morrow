import assert from "node:assert/strict";
import test from "node:test";
import { TownSimulation } from "../src/simulation.js";

test("welfare mode is explicit, validated, retained by reset, and exposed by snapshot", () => {
  const town = new TownSimulation({ seed: 61, welfareMode: "combined" });
  assert.equal(town.snapshot().welfareMode, "combined");
  assert.throws(() => new TownSimulation({ welfareMode: "unknown" }), /Unknown welfare mode/);

  town.reset();

  assert.equal(town.welfareMode, "combined");
  assert.equal(town.people.every((person) => person.welfareHistory.length === 0 && person.welfareSequence === 0), true);
  assert.deepEqual(town.government.welfareHistory, []);
});

test("the daily welfare envelope snapshots treasury cash once after payroll", () => {
  const town = new TownSimulation({ seed: 61, welfareMode: "combined", policy: { supportRate: 35 } });
  town.government.cash = 200;

  const state = town.beginWelfareEnvelope();
  assert.deepEqual(state, { day: 1, envelopeSnapshotCash: 200, envelope: 12.6, spent: 0, directAidByCitizen: {} });

  town.government.cash = 250;
  assert.equal(town.beginWelfareEnvelope(), state);
  assert.equal(town.remainingWelfareEnvelope(), 12.6);

  town.day = 2;
  assert.deepEqual(town.beginWelfareEnvelope(), { day: 2, envelopeSnapshotCash: 250, envelope: 15.75, spent: 0, directAidByCitizen: {} });
});

test("zero welfare budget and no-welfare mode both create a zero envelope", () => {
  assert.equal(new TownSimulation({ welfareMode: "combined", policy: { supportRate: 0 } }).beginWelfareEnvelope().envelope, 0);
  assert.equal(new TownSimulation({ welfareMode: "none", policy: { supportRate: 100 } }).beginWelfareEnvelope().envelope, 0);
});

test("structured welfare evidence carries programme, actor, and civil time identity", () => {
  const town = new TownSimulation({ seed: 61, welfareMode: "combined" });
  town.phase = 4;
  const person = town.people[0];
  const record = town.recordWelfare(person, { programme: "food-assistance", outcome: "eligible", reason: "exact shortfall" }, "Food shopping");

  assert.deepEqual(record, {
    day: 1,
    block: "Evening",
    processingPhase: "Food",
    phaseIndex: 4,
    sequence: 1,
    actorKind: "person",
    actorId: person.id,
    actorName: person.name,
    programme: "food-assistance",
    outcome: "eligible",
    reason: "exact shortfall",
  });
  assert.equal(Object.isFrozen(record), true);
});
