import assert from "node:assert/strict";
import test from "node:test";
import { FIRM_OPEN_WEEKDAYS } from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

const attendPolicy = {
  id: "scheduled-attendance-test",
  decide({ observation, legalActions }) {
    const preferred = observation.kind === "attendance"
      ? "attend-shift"
      : observation.kind === "owner" && observation.domain === "wage"
        ? "draw-owner-wage"
        : legalActions[0];
    return { action: legalActions.includes(preferred) ? preferred : legalActions[0], reasons: ["fixture"], scores: {} };
  },
};

test("firm opening calendars match the configured weekly patterns", () => {
  const town = new TownSimulation({ seed: 42, schedulesEnabled: true });
  assert.deepEqual(FIRM_OPEN_WEEKDAYS["housing-provider"], [0, 1, 2, 3, 4]);
  assert.deepEqual(FIRM_OPEN_WEEKDAYS["everyday-grocer"], [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(FIRM_OPEN_WEEKDAYS.cafe, [2, 3, 4, 5, 6]);
  assert.deepEqual(FIRM_OPEN_WEEKDAYS.clinic, [0, 1, 2, 3, 4, 5, 6]);

  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  town.day = 6;
  assert.equal(town.firmOpenOnDay(grocer), true);
  town.day = 7;
  assert.equal(town.firmOpenOnDay(grocer), false);
  assert.equal(town.nextOpeningDay(grocer), 8);
});

test("every employment spell receives a stable five-shift rota that fills least-covered open days", () => {
  const town = new TownSimulation({ seed: 42, schedulesEnabled: true });
  const farm = town.firms.find((firm) => firm.archetypeId === "farm");

  assert.ok(farm.employees.every((id) => town.people[id].rota.weekdayIndices.length === 5));
  const originalRotas = farm.employees.map((id) => [...town.people[id].rota.weekdayIndices]);
  const coverage = Object.values(town.rotaCoverage(farm));
  assert.ok(Math.max(...coverage) - Math.min(...coverage) <= 1);
  assert.deepEqual(farm.employees.map((id) => town.people[id].rota.weekdayIndices), originalRotas);

  const worker = town.people[farm.employees.at(-1)];
  const firstSpell = worker.rota.sequence;
  town.fire(farm, worker, "fixture ended employment");
  town.hire(farm, worker);
  assert.equal(worker.rota.sequence, firstSpell + 1);
  assert.equal(worker.rota.weekdayIndices.length, 5);
});

test("five scheduled shifts preserve seven compatibility days of staffed capacity", () => {
  const scheduled = new TownSimulation({ seed: 42, schedulesEnabled: true, transportEnabled: true });
  const compatibility = new TownSimulation({ seed: 42 });
  assert.equal(scheduled.scheduledShiftCapacityMultiplier(), 7 / 5);
  assert.equal(compatibility.scheduledShiftCapacityMultiplier(), 1);
  assert.equal(5 * scheduled.scheduledShiftCapacityMultiplier(), 7);

  const carrier = scheduled.firms.find((firm) => firm.archetypeId === "haulage");
  assert.equal(carrier.targetStaff, 3);
  const coverage = Object.values(scheduled.rotaCoverage(carrier));
  assert.ok(Math.min(...coverage) >= 2);
});

test("an unscheduled day is not an absence and five attended shifts preserve seven daily-equivalent wages", () => {
  const town = new TownSimulation({ seed: 42, schedulesEnabled: true, citizenPolicy: attendPolicy, policy: { taxRate: 0, shockRisk: 0 } });
  const farm = town.firms.find((firm) => firm.archetypeId === "farm");
  const worker = town.people[farm.employees.find((id) => id !== farm.owner)];
  worker.reliability = 1;
  worker.health = 1;
  worker.stress = 0;
  worker.hungryDays = 0;
  worker.ledger = [];
  farm.cash = 10_000;

  for (let day = 1; day <= 7; day += 1) {
    town.day = day;
    town.planningPhase();
    town.productionPhase();
    town.payrollPhase();
  }

  const wages = worker.ledger.filter((entry) => entry.text.includes("wage from"));
  assert.equal(wages.length, 5);
  assert.equal(worker.missedWork, 0);
  assert.equal(worker.scheduledShiftsElapsed, 5);
  assert.equal(worker.scheduledShiftsWorked, 5);
  assert.equal(Math.round(wages.reduce((total, entry) => total + entry.amount, 0) * 100), Math.round(farm.wage * 7 * 100));
});

test("closed firms do not operate and contracts name closure separately from stock or staffing", () => {
  const town = new TownSimulation({ seed: 42, schedulesEnabled: true, citizenPolicy: attendPolicy, policy: { taxRate: 0, shockRisk: 0 } });
  const farm = town.firms.find((firm) => firm.archetypeId === "farm");
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  const contract = town.contracts.find((candidate) => candidate.supplierId === farm.id && candidate.buyerId === grocer.id);
  town.contracts.filter((candidate) => candidate !== contract).forEach((candidate) => { candidate.active = false; });
  town.day = 7;
  town.planningPhase();
  const before = { farmInventory: farm.inventory, farmCash: farm.cash, grocerInventory: grocer.inventory, grocerCash: grocer.cash };

  town.productionPhase();
  town.procurementPhase();
  town.payrollPhase();

  assert.deepEqual({ farmInventory: farm.inventory, farmCash: farm.cash, grocerInventory: grocer.inventory, grocerCash: grocer.cash }, before);
  assert.equal(contract.shortfallCauseToday, "Morrow Fields closed");
  assert.equal(contract.limitingFirmId, farm.id);
  assert.match(grocer.events[0].text, /closed.*next shared opening D8/);
  assert.ok(farm.employees.every((id) => town.people[id].attended === false));
});

test("the everyday grocer orders through its next opening before a closure day", () => {
  const town = new TownSimulation({ seed: 42, schedulesEnabled: true, transportEnabled: false, citizenPolicy: attendPolicy });
  const farm = town.firms.find((firm) => firm.archetypeId === "farm");
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  const foodContract = town.contracts.find((contract) => contract.supplierId === farm.id && contract.buyerId === grocer.id && contract.product === "produce");
  town.contracts.filter((contract) => contract !== foodContract).forEach((contract) => { contract.active = false; });
  town.day = 6;
  town.planningPhase();
  farm.inventory = 200;
  grocer.inventory = 0;
  grocer.perishableBatches = [];
  grocer.cash = 10_000;

  town.productionPhase();
  town.procurementPhase();

  assert.equal(foodContract.requestedToday, 80);
  assert.equal(foodContract.deliveredToday, 80);
});

test("open-day recurrence excludes closures while Monday rent and Sunday price review retain named weekly bases", () => {
  const town = new TownSimulation({ seed: 42, schedulesEnabled: true });
  const maker = town.firms.find((firm) => firm.archetypeId === "toolmaker");
  const farm = town.firms.find((firm) => firm.archetypeId === "farm");
  for (let day = 1; day <= 14; day += 1) {
    town.day = day;
    town.planningPhase();
  }
  assert.equal(maker.openDayCount, 10);
  assert.equal(farm.openDayCount, 12);

  town.day = 8;
  assert.equal(town.rentDueToday(), true);
  town.day = 7;
  assert.equal(town.firmOpenOnDay(maker), false);
  town.reviewOwnerPrice(maker);
  assert.equal(maker.ownerDecision.priceDay, 7);
});

test("a viable latent firm waits for its next open morning before formation begins", () => {
  const town = new TownSimulation({ seed: 42, schedulesEnabled: true });
  let openedOn = null;
  town.pendingFormations.cafe = { evidence: { ready: true }, historySequence: 1 };
  town.opportunityHistory.unshift({ sequence: 1, foundedInstanceId: null });
  town.foundFirm = () => {
    openedOn = town.day;
    return { instanceId: "cafe:test" };
  };

  town.day = 1;
  town.planningPhase();
  assert.equal(openedOn, null);
  assert.ok(town.pendingFormations.cafe);

  town.day = 3;
  town.planningPhase();
  assert.equal(openedOn, 3);
  assert.equal(town.pendingFormations.cafe, undefined);
  assert.equal(town.opportunityHistory[0].foundedInstanceId, "cafe:test");
});

test("maintenance wear and operating evidence advance on use and open days, not weekend closure", () => {
  const town = new TownSimulation({ seed: 42, schedulesEnabled: true, citizenPolicy: attendPolicy, policy: { shockRisk: 0 } });
  const housing = town.firms.find((firm) => firm.archetypeId === "housing-provider");
  housing.operatingSupplies = 0;
  housing.operationalReadiness = 1;
  housing.cash = 10_000;

  for (let day = 1; day <= 5; day += 1) {
    town.day = day;
    town.planningPhase();
    town.productionPhase();
  }
  assert.equal(housing.maintenanceUseDays, 5);
  assert.ok(housing.operationalReadiness < 1);

  const evidenceBeforeWeekend = housing.staffingDemandHistory.length;
  const distressBeforeWeekend = housing.distressDays;
  for (let day = 6; day <= 7; day += 1) {
    town.day = day;
    town.planningPhase();
    town.productionPhase();
    town.prepareFirmSettlement(housing);
    town.finishFirmSettlement(housing);
  }
  assert.equal(housing.maintenanceUseDays, 5);
  assert.equal(housing.staffingDemandHistory.length, evidenceBeforeWeekend);
  assert.equal(housing.distressDays, distressBeforeWeekend);
});

test("fourteen scheduled calendar days replay exactly and conserve cash", () => {
  const run = () => {
    const town = new TownSimulation({ seed: 42, schedulesEnabled: true, transportEnabled: true });
    for (let phase = 0; phase < 14 * 8; phase += 1) town.step();
    town.assertInvariants();
    return {
      initialMoney: town.initialMoney,
      day: town.day,
      phase: town.phase,
      money: town.totalMoney(),
      firms: town.firms.map((firm) => ({ cash: firm.cash, inventory: firm.inventory, status: firm.status, openDays: firm.openDayCount })),
      people: town.people.map((person) => ({ cash: person.cash, alive: person.alive, employer: person.employer, rota: person.rota })),
    };
  };

  const first = run();
  assert.deepEqual(first, run());
  assert.equal(first.day, 15);
  assert.equal(first.money, first.initialMoney);
});
