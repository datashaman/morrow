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

test("a born citizen crosses every calendar stage and matures without creating money", () => {
  const town = new TownSimulation({ seed: 81, lifecycleEnabled: true });
  const citizen = town.createNewborn([0, 1]);
  citizen.restrictedInheritance = 7.35;
  town.initialMoney = town.totalMoney();
  const moneyBefore = town.totalMoney();

  town.day = 29;
  assert.deepEqual(town.resolveLifecycleStages(), [{ citizenId: citizen.id, previousStage: "infant", stage: "child", ageDays: 28 }]);
  assert.equal(citizen.isDependent, true);

  town.day = 85;
  assert.deepEqual(town.resolveLifecycleStages(), [{ citizenId: citizen.id, previousStage: "child", stage: "student", ageDays: 84 }]);

  town.day = 169;
  assert.deepEqual(town.resolveLifecycleStages(), [{ citizenId: citizen.id, previousStage: "student", stage: "adult", ageDays: 168 }]);
  assert.equal(citizen.isDependent, false);
  assert.deepEqual(citizen.guardianIds, []);
  assert.deepEqual(citizen.formerGuardianIds, [0, 1]);
  assert.equal(citizen.restrictedInheritance, 0);
  assert.equal(citizen.cash, 7.35);
  assert.equal(citizen.transitionHostId, citizen.formerGuardianIds[0]);
  assert.equal(citizen.transitionResidenceEndDay, 197);
  assert.equal(citizen.housed, true);
  assert.equal(town.totalMoney(), moneyBefore);
  assert.equal(citizen.lifecycleHistory[0].type, "maturation");
  assert.equal(citizen.ledger[0].text, "restricted inheritance released at adulthood");
  town.assertInvariants();
});

test("transition residence consumes no dwelling and ends after 28 days or host housing loss", () => {
  const town = new TownSimulation({ seed: 82, lifecycleEnabled: true, housingCapacityEnabled: true });
  const citizen = town.createNewborn([0, 1]);
  const occupancyBefore = town.housingOccupancy();
  town.day = 169;
  town.resolveLifecycleStages();
  assert.equal(town.housingOccupancy(), occupancyBefore);

  town.day = 197;
  assert.equal(town.reconcileTransitionResidence(citizen), false);
  assert.equal(citizen.housed, false);
  assert.equal(citizen.transitionHostId, null);
  assert.equal(citizen.transitionResidenceEndDay, null);
  assert.equal(citizen.lifecycleHistory[0].type, "transition-residence-ended");

  const hostLoss = new TownSimulation({ seed: 83, lifecycleEnabled: true });
  const secondCitizen = hostLoss.createNewborn([0, 1]);
  hostLoss.day = 169;
  hostLoss.resolveLifecycleStages();
  hostLoss.people[secondCitizen.transitionHostId].housed = false;
  assert.equal(hostLoss.reconcileTransitionResidence(secondCitizen), false);
  assert.equal(secondCitizen.housed, false);
  assert.match(secondCitizen.events[0].text, /transition host lost housing/);
});

test("an exact independent tenancy ends transition residence early", () => {
  const policy = {
    id: "independent-housing-test",
    decide: ({ observation, legalActions }) => ({
      action: observation.kind === "housing"
        ? legalActions.find((action) => action.startsWith("secure-housing:")) ?? legalActions[0]
        : legalActions[0],
      reasons: ["housing fixture"],
    }),
  };
  const town = new TownSimulation({ seed: 85, lifecycleEnabled: true, housingCapacityEnabled: true, citizenPolicy: policy });
  const citizen = town.createNewborn([0, 1]);
  const housing = town.firms.find((firm) => firm.sector === "housing");
  housing.dwellingCapacity = town.housingOccupancy() + 1;
  citizen.cash = housing.price * 3;
  town.initialMoney = town.totalMoney();
  town.day = 169;
  town.resolveLifecycleStages();
  const occupancyBefore = town.housingOccupancy();

  assert.equal(town.considerHousing(citizen, housing), true);

  assert.equal(citizen.transitionHostId, null);
  assert.equal(citizen.transitionResidenceEndDay, null);
  assert.equal(citizen.housed, true);
  assert.equal(town.housingOccupancy(), occupancyBefore + 1);
  assert.equal(citizen.lifecycleHistory[0].type, "transition-residence-ended");
  assert.match(citizen.ledger[0].text, /deposit and rent/);
  town.assertInvariants();
});

test("a citizen reaching adulthood can enter the same Monday job market", () => {
  const policy = {
    id: "maturation-job-test",
    decide: ({ observation, legalActions }) => {
      if (observation.kind === "job-search") return { action: legalActions.find((action) => action.startsWith("apply-job:")) ?? legalActions[0], reasons: ["apply fixture"] };
      if (observation.kind === "job-offer") return { action: "accept-job-offer", reasons: ["accept fixture"] };
      return { action: legalActions[0], reasons: ["fixture default"] };
    },
  };
  const town = new TownSimulation({ seed: 84, lifecycleEnabled: true, schedulesEnabled: true, citizenPolicy: policy });
  const citizen = town.createNewborn([0, 1]);
  citizen.skill = 0.99;
  citizen.reliability = 0.99;
  const firm = town.firms[0];
  firm.targetStaff = firm.employees.length + 1;
  firm.vacancyAge = 2;
  town.firms.slice(1).forEach((other) => { other.targetStaff = other.employees.length; });
  town.day = 169;

  town.planningPhase();

  assert.equal(citizen.lifecycleStage, "adult");
  assert.equal(citizen.employer, firm.id);
  assert.equal(citizen.decisions.some((decision) => decision.kind === "job-search"), true);
  assert.equal(citizen.decisions.some((decision) => decision.kind === "job-offer"), true);
});
