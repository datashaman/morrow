import assert from "node:assert/strict";
import test from "node:test";
import { TownSimulation } from "../src/simulation.js";

const selectingPolicy = (select) => ({
  id: "activity-budget-fixture",
  decide({ observation, legalActions }) {
    const selected = select(observation, legalActions);
    return { action: legalActions.includes(selected) ? selected : legalActions[0], reasons: ["fixture"], scores: {} };
  },
});

const addFirm = (town, archetypeId, { inventory = 1, cash = 1_000 } = {}) => {
  const archetype = town.firmArchetype(archetypeId);
  const firm = town.createFirmInstance(archetype, town.firms.length, { owner: town.people.length - 1, inventory, cash });
  town.firms.push(firm);
  return firm;
};

test("a planned clinic visit consumes the same Workday primary as a scheduled shift", () => {
  const town = new TownSimulation({
    seed: 42,
    schedulesEnabled: true,
    policy: { taxRate: 0, shockRisk: 0 },
    citizenPolicy: selectingPolicy((observation, legalActions) => observation.kind === "workday-plan"
      ? legalActions.find((action) => action.startsWith("attend-clinic:")) ?? legalActions[0]
      : legalActions[0]),
  });
  const worker = town.people.find((person) => person.employer >= 0 && town.scheduledForShift(person, town.firms[person.employer], 1));
  const employer = town.firms[worker.employer];
  const clinic = addFirm(town, "clinic");
  const clinician = town.people.find((person) => person.employer < 0);
  town.hire(clinic, clinician, true);
  clinician.rota = Object.freeze({ ...clinician.rota, weekdayIndices: Object.freeze([0, 1, 2, 3, 4]) });
  worker.health = 0.2;
  worker.cash = 100;
  employer.cash = 10_000;

  town.planningPhase();
  assert.equal(worker.dailyPlan.workday.action, `attend-clinic:${clinic.id}`);
  town.productionPhase();
  town.payrollPhase();

  assert.equal(worker.attended, false);
  assert.equal(worker.missedWork, 1);
  assert.equal(worker.dailyPlan.workday.status, "completed");
  assert.equal(worker.ledger.some((entry) => entry.text.includes(`wage from ${employer.name}`)), false);
  assert.ok(worker.events.some((event) => /chose clinic instead of a scheduled shift/.test(event.text)));
});

test("an unscheduled daytime activity is not an absence", () => {
  const town = new TownSimulation({ seed: 42, schedulesEnabled: true, citizenPolicy: selectingPolicy(() => "daytime-rest") });
  const worker = town.people.find((person) => person.employer >= 0);
  const employer = town.firms[worker.employer];
  const unscheduledDay = [1, 2, 3, 4, 5, 6, 7].find((day) => !town.scheduledForShift(worker, employer, day));
  town.day = unscheduledDay;
  const before = worker.missedWork;

  town.planningPhase();
  town.productionPhase();

  assert.equal(worker.dailyPlan.workday.activity, "rest");
  assert.equal(worker.dailyPlan.workday.status, "completed");
  assert.equal(worker.missedWork, before);
});

test("a failed planned service consumes Workday and records the exact constraint", () => {
  const town = new TownSimulation({
    seed: 42,
    schedulesEnabled: true,
    citizenPolicy: selectingPolicy((observation, legalActions) => observation.kind === "workday-plan"
      ? legalActions.find((action) => action.startsWith("attend-clinic:")) ?? legalActions[0]
      : legalActions[0]),
  });
  const person = town.people.find((candidate) => candidate.employer < 0);
  const clinic = addFirm(town, "clinic", { inventory: 0 });
  person.health = 0.2;
  person.cash = 100;

  town.planningPhase();
  town.productionPhase();

  assert.equal(person.dailyPlan.workday.action, `attend-clinic:${clinic.id}`);
  assert.equal(person.dailyPlan.workday.status, "failed");
  assert.equal(person.dailyPlan.workday.failureReason, "provider has no service stock");
  assert.match(person.events[0].text, /planned clinic failed because provider has no service stock/);
});

test("food planning can top up a nonempty pantry before a closure day", () => {
  let observedFood = null;
  const town = new TownSimulation({
    seed: 42,
    schedulesEnabled: true,
    citizenPolicy: selectingPolicy((observation, legalActions) => {
      if (observation.kind !== "food") return legalActions[0];
      observedFood = observation;
      return legalActions.find((action) => action.startsWith("buy-food:")) ?? legalActions[0];
    }),
  });
  town.day = 6;
  const person = town.people[0];
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  person.foodReserveTarget = 1;
  person.foodStock = [{ product: grocer.sells, processedDay: 5, purchasedDay: 5, quality: grocer.quality, shelfLife: 3, seller: grocer.id }];
  person.cash = 100;
  grocer.inventory = 0;
  grocer.inventoryBatches = [];
  grocer.inventoryBatchSequence = 0;
  town.addFirmInventory(grocer, 3, { batchDay: town.day });
  grocer.employees.forEach((id) => { town.people[id].attended = true; });

  town.considerFood(person, [grocer]);

  assert.equal(observedFood.reserveTarget, 2);
  assert.ok(observedFood.options.some((option) => option.source === "stored"));
  assert.ok(observedFood.options.some((option) => option.source === "seller" && option.units === 1));
});

test("a full food-sector closure creates one concise event per citizen", () => {
  const town = new TownSimulation({ seed: 42, schedulesEnabled: true });
  town.day = 7;
  const person = town.people[0];
  person.events = [];

  town.foodPhase();

  const closureEvents = person.events.filter((event) => event.text.includes("all food sellers were closed"));
  assert.equal(closureEvents.length, 1);
  assert.match(closureEvents[0].text, /next opening D8/);
});
