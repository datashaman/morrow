import assert from "node:assert/strict";
import test from "node:test";
import { LIFECYCLE_STAGE_START_DAYS, LIFECYCLE_STAGES } from "../src/config.js";
import { lifecycleStageForAge, TownSimulation } from "../src/simulation.js";

test("calendar ages map to the documented bounded lifecycle stages", () => {
  assert.deepEqual(LIFECYCLE_STAGES, ["infant", "child", "student", "adult"]);
  assert.deepEqual(LIFECYCLE_STAGE_START_DAYS, { infant: 0, child: 28, student: 84, adult: 168 });
  assert.equal(lifecycleStageForAge(0), "infant");
  assert.equal(lifecycleStageForAge(27), "infant");
  assert.equal(lifecycleStageForAge(28), "child");
  assert.equal(lifecycleStageForAge(83), "child");
  assert.equal(lifecycleStageForAge(84), "student");
  assert.equal(lifecycleStageForAge(167), "student");
  assert.equal(lifecycleStageForAge(168), "adult");
  assert.equal(lifecycleStageForAge(10_000), "adult");
  assert.throws(() => lifecycleStageForAge(-1), /non-negative whole number/);
  assert.throws(() => lifecycleStageForAge(1.5), /non-negative whole number/);
});

test("existing citizens begin as non-ageing adults with empty family state", () => {
  const town = new TownSimulation({ seed: 42 });

  assert.equal(town.nextCitizenId, 40);
  town.people.forEach((person, id) => {
    assert.equal(person.id, id);
    assert.equal(person.lifecycleStage, "adult");
    assert.equal(person.birthDay, null);
    assert.equal(person.ageDays, null);
    assert.equal(person.isDependent, false);
    assert.deepEqual(person.parentIds, []);
    assert.deepEqual(person.guardianIds, []);
    assert.deepEqual(person.formerGuardianIds, []);
    assert.equal(person.residentialGuardianId, null);
    assert.equal(person.restrictedInheritance, 0);
    assert.equal(person.lifecycleSequence, 0);
    assert.deepEqual(person.lifecycleHistory, []);
    assert.equal(person.partnerId, null);
    assert.equal(person.partnershipStartDay, null);
    assert.equal(person.lastPartnershipEndDay, null);
  });
  assert.deepEqual(town.snapshot().lifecycleCounts, { infant: 0, child: 0, student: 0, adult: 40 });
});

test("the disabled lifecycle gate preserves existing adult behaviour and replay", () => {
  const control = new TownSimulation({ seed: 2026, lifecycleEnabled: false });
  const replay = new TownSimulation({ seed: 2026, lifecycleEnabled: false });

  for (let step = 0; step < 80; step += 1) {
    control.step();
    replay.step();
  }

  assert.equal(control.snapshot().lifecycleEnabled, false);
  assert.deepEqual(replay.snapshot(), control.snapshot());
  assert.deepEqual(replay.people, control.people);
  assert.ok(replay.people.every((person) => person.lifecycleHistory.length === 0));
});
