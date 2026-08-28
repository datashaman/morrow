import assert from "node:assert/strict";
import test from "node:test";
import { inferTownStage } from "../src/town-stage.js";

const essentials = ["farm", "everyday-grocer", "housing-provider", "toolmaker"];

function evidenceTown({ alive = 10, employed = 7, reserved = 7, optional = 2, optionalAge = 35, essentialReadiness = 1, discretionaryDemand = 60 } = {}) {
  const people = Array.from({ length: 10 }, (_, id) => ({
    alive: id < alive,
    employer: id < employed ? 0 : -1,
    cash: id < reserved ? 50 : 2,
  }));
  const firms = essentials.map((archetypeId) => ({ archetypeId, active: true, operationalReadiness: essentialReadiness, foundingDay: 1 }));
  ["cafe", "premium-grocer"].slice(0, optional).forEach((archetypeId) => firms.push({ archetypeId, active: true, operationalReadiness: 1, foundingDay: 40 - optionalAge }));
  return { day: 40, people, firms, policy: { discretionaryDemand }, essentialCost: 3 };
}

test("town stage is a pure deterministic projection with inspectable evidence", () => {
  const input = evidenceTown();
  const before = structuredClone(input);

  const first = inferTownStage(input);
  const replay = inferTownStage(input);

  assert.deepEqual(first, replay);
  assert.deepEqual(input, before);
  assert.equal(first.id, "complexity");
  assert.deepEqual(Object.keys(first.evidence), [
    "livingCitizens", "adultCitizens", "essentialReliability", "essentialStates", "employmentRate", "reserveShare", "reserveRunwayDays",
    "discretionaryDemand", "activeOptionalSectors", "persistentOptionalSectors", "oldestOptionalAge", "activeArchetypes",
  ]);
});

test("stage descriptions move forward and backward with current conditions", () => {
  assert.equal(inferTownStage(evidenceTown({ optional: 0 })).id, "stability");
  assert.equal(inferTownStage(evidenceTown({ optional: 1, optionalAge: 8 })).id, "convenience");
  assert.equal(inferTownStage(evidenceTown({ optional: 2, optionalAge: 8 })).id, "affluence");
  assert.equal(inferTownStage(evidenceTown({ optional: 2, optionalAge: 35 })).id, "complexity");
  assert.equal(inferTownStage(evidenceTown({ optional: 2, optionalAge: 35, reserved: 1 })).id, "subsistence");
  assert.equal(inferTownStage(evidenceTown({ optional: 2, optionalAge: 35, essentialReadiness: 0.4 })).id, "collapsed");
});

test("an extinct town receives an explicit collapsed explanation", () => {
  const stage = inferTownStage(evidenceTown({ alive: 0, employed: 0, reserved: 0 }));

  assert.equal(stage.id, "collapsed");
  assert.match(stage.description, /No living citizens remain/);
});
