import assert from "node:assert/strict";
import test from "node:test";
import { BIRTH_SPACING_DAYS, CONCEPTION_CHANCE, GESTATION_DAYS } from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

const birthPolicy = ({ tryIds = new Set([0, 1]) } = {}) => ({
  id: "birth-test",
  decide: ({ observation, legalActions }) => {
    let action = legalActions[0];
    if (observation.kind === "partnership") {
      if (observation.domain === "separation") action = "continue-partnership";
      else action = observation.domain === "proposal" ? "remain-single" : "decline-partnership";
    }
    if (observation.kind === "birth-attempt") action = tryIds.has(observation.citizenId) ? "try-for-child" : "wait-for-child";
    return { action, reasons: ["deterministic birth fixture"] };
  },
});

const partneredTown = ({ seed = 2, tryIds } = {}) => {
  const town = new TownSimulation({ seed, lifecycleEnabled: true, birthsEnabled: true, citizenPolicy: birthPolicy({ tryIds }) });
  town.people.forEach((person) => { person.relationships = {}; });
  town.formFriendship(town.people[0], town.people[1], 0.9, 1);
  assert.equal(town.formPartnership(town.people[0], town.people[1]), true);
  return town;
};

test("a birth attempt requires both partners and uses an isolated deterministic conception draw", () => {
  const refusal = partneredTown({ tryIds: new Set([0]) });
  const randomControl = partneredTown({ tryIds: new Set([0]) });
  assert.deepEqual(refusal.runBirthAttempts(), []);
  assert.equal(refusal.gestations.length, 0);
  assert.equal(refusal.random(), randomControl.random());

  const town = partneredTown({ seed: 2 });
  const control = partneredTown({ seed: 2 });
  const results = town.runBirthAttempts();
  assert.equal(results.length, 1);
  assert.equal(results[0].draw, 0.19940132601186633);
  assert.equal(results[0].chance, CONCEPTION_CHANCE);
  assert.equal(results[0].conceived, true);
  assert.deepEqual(town.birthAttemptHistory, results);
  assert.equal(town.random(), control.random());
  assert.deepEqual(town.gestations[0], { id: 1, parentIds: [0, 1], attemptSequence: 1, conceivedDay: 1, dueDay: 1 + GESTATION_DAYS, status: "active", newbornId: null });
  assert.equal(town.people[0].lifecycleHistory[0].type, "conception");
});

test("failed conception permits a later deterministic attempt while active gestation blocks another", () => {
  const failed = partneredTown({ seed: 1 });
  const first = failed.runBirthAttempts()[0];
  assert.equal(first.conceived, false);
  assert.equal(failed.gestations.length, 0);
  failed.day = 8;
  const second = failed.runBirthAttempts()[0];
  assert.equal(second.attemptSequence, 2);

  const conceived = partneredTown({ seed: 2 });
  conceived.runBirthAttempts();
  conceived.day = 8;
  assert.deepEqual(conceived.runBirthAttempts(), []);
  assert.equal(conceived.birthAttemptCounts["0:1"], 1);
});

test("a completed gestation appends a reproducible zero-cash dependent without creating resources", () => {
  const town = partneredTown({ seed: 2 });
  const replay = partneredTown({ seed: 2 });
  const moneyBefore = town.totalMoney();
  const firmCashBefore = town.firms.map((firm) => firm.cash);
  const inventoryBefore = town.firms.map((firm) => firm.inventory);
  const dwellingCapacityBefore = town.firms.find((firm) => firm.sector === "housing").dwellingCapacity;
  town.runBirthAttempts();
  replay.runBirthAttempts();
  town.day = replay.day = 29;

  town.resolveGestations();
  replay.resolveGestations();
  town.assertInvariants();
  replay.assertInvariants();

  const newborn = town.people[40];
  assert.equal(town.people.length, 41);
  assert.equal(town.nextCitizenId, 41);
  assert.equal(newborn.id, 40);
  assert.equal(newborn.name, replay.people[40].name);
  assert.equal(newborn.lifecycleStage, "infant");
  assert.equal(newborn.birthDay, 29);
  assert.equal(newborn.ageDays, 0);
  assert.equal(newborn.isDependent, true);
  assert.deepEqual(newborn.parentIds, [0, 1]);
  assert.deepEqual(newborn.guardianIds, [0, 1]);
  assert.equal(newborn.cash, 0);
  assert.equal(newborn.health, 0.75);
  assert.equal(newborn.skill, 0.05);
  assert.equal(newborn.reliability, 0.75);
  assert.equal(newborn.employer, -1);
  assert.equal(newborn.jobApplicationFirm, -1);
  assert.equal(newborn.partnerId, null);
  assert.deepEqual(newborn.relationships, {});
  assert.deepEqual(newborn.foodStock, []);
  assert.equal(newborn.events[0].text, "born to Amina and Jonah");
  assert.equal(newborn.lifecycleHistory[0].type, "birth");
  assert.equal(town.totalMoney(), moneyBefore);
  assert.deepEqual(town.firms.map((firm) => firm.cash), firmCashBefore);
  assert.deepEqual(town.firms.map((firm) => firm.inventory), inventoryBefore);
  assert.equal(town.firms.find((firm) => firm.sector === "housing").dwellingCapacity, dwellingCapacityBefore);
  assert.equal(town.housingOccupancy(), 40);
  assert.deepEqual(town.people, replay.people);
});

test("separation does not cancel gestation, one parent may remain guardian, and two deaths end it", () => {
  const survivorTown = partneredTown({ seed: 2 });
  survivorTown.runBirthAttempts();
  survivorTown.endPartnership(survivorTown.people[0], "test separation");
  assert.equal(survivorTown.gestations[0].status, "active");
  assert.equal(survivorTown.legalPartnershipPair(survivorTown.people[0], survivorTown.people[2]), false);
  survivorTown.die(survivorTown.people[1], "test parent death");
  survivorTown.day = 29;
  survivorTown.resolveGestations();
  assert.deepEqual(survivorTown.people[40].parentIds, [0, 1]);
  assert.deepEqual(survivorTown.people[40].guardianIds, [0]);

  const endedTown = partneredTown({ seed: 2 });
  endedTown.runBirthAttempts();
  endedTown.die(endedTown.people[0], "test first death");
  endedTown.die(endedTown.people[1], "test second death");
  endedTown.day = 29;
  endedTown.resolveGestations();
  assert.equal(endedTown.people.length, 40);
  assert.equal(endedTown.gestations[0].status, "ended");
  assert.equal(endedTown.gestations[0].outcome, "both prospective guardians died");
});

test("the shared birth spacing rule suppresses another opportunity for 84 days", () => {
  const town = partneredTown({ seed: 2 });
  town.lastBirthDays["0:1"] = 1;
  town.day = BIRTH_SPACING_DAYS;
  assert.deepEqual(town.runBirthAttempts(), []);
  town.day = BIRTH_SPACING_DAYS + 1;
  assert.equal(town.runBirthAttempts().length, 1);
});

test("dependent-only towns continue but newborns cannot perform adult actions", () => {
  const town = partneredTown({ seed: 2 });
  town.runBirthAttempts();
  town.day = 29;
  town.resolveGestations();
  const newborn = town.people[40];
  town.people.slice(0, 40).forEach((person) => town.die(person, "test adult extinction"));
  assert.equal(town.isExtinct(), false);
  assert.equal(town.hire(town.firms[0], newborn), false);
  assert.equal(town.considerJobSearch(newborn), null);
  assert.equal(town.considerFood(newborn, []), false);
  assert.equal(town.considerHousing(newborn, town.firms.find((firm) => firm.sector === "housing")), false);
  assert.equal(town.considerPersonalTime(newborn, null, null), false);
  assert.equal(town.snapshot().workforceAdults, 0);
  assert.equal(town.snapshot().dependencyRatio, Infinity);
});
