import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarForDay,
  CIVIL_TIME_BLOCKS,
  compareTemporalNewest,
  formatTemporalRecord,
  PHASE_BLOCKS,
  PROCESSING_PHASES,
  temporalMetadata,
} from "../src/civil-time.js";
import { TownSimulation } from "../src/simulation.js";

test("civil calendar projects fixed weekdays and weeks without wall-clock time", () => {
  assert.deepEqual(calendarForDay(1), { day: 1, week: 1, weekdayIndex: 0, weekday: "Monday", weekdayShort: "Mon", weekend: false });
  assert.deepEqual(calendarForDay(7), { day: 7, week: 1, weekdayIndex: 6, weekday: "Sunday", weekdayShort: "Sun", weekend: true });
  assert.deepEqual(calendarForDay(8), { day: 8, week: 2, weekdayIndex: 0, weekday: "Monday", weekdayShort: "Mon", weekend: false });
  assert.throws(() => calendarForDay(0), /positive integer/);
});

test("eight processing phases map exactly onto four civil-time blocks", () => {
  assert.deepEqual(PROCESSING_PHASES, ["Planning", "Production", "Procurement", "Payroll", "Food", "Housing", "Personal time", "Settlement"]);
  assert.deepEqual(CIVIL_TIME_BLOCKS, ["Morning", "Workday", "Evening", "Overnight"]);
  assert.deepEqual(PROCESSING_PHASES.map((phase) => PHASE_BLOCKS[phase]), [
    "Morning", "Workday", "Workday", "Workday", "Evening", "Evening", "Evening", "Overnight",
  ]);
  assert.deepEqual(temporalMetadata(9, "Food shopping"), {
    block: "Evening",
    processingPhase: "Food",
    phaseIndex: 4,
  });
});

test("temporal records format and sort by day, phase, then local sequence", () => {
  const records = [
    { day: 9, processingPhase: "Food", sequence: 2 },
    { day: 9, processingPhase: "Payroll", sequence: 8 },
    { day: 9, processingPhase: "Food", sequence: 3 },
    { day: 8, processingPhase: "Settlement", sequence: 99 },
  ];

  assert.equal(formatTemporalRecord(records[0]), "W2 Tue · Evening · Food");
  assert.deepEqual([...records].sort(compareTemporalNewest), [records[2], records[0], records[1], records[3]]);
});

test("first-day Planning advances deterministically without a clock-only random draw", () => {
  const planned = new TownSimulation({ seed: 42 });
  const control = new TownSimulation({ seed: 42 });
  const money = planned.totalMoney();
  const eventCount = planned.people.reduce((total, person) => total + person.events.length, 0);

  planned.step();

  assert.equal(planned.day, 1);
  assert.equal(planned.phase, 1);
  assert.equal(planned.snapshot().phaseName, "Production");
  assert.equal(planned.totalMoney(), money);
  assert.equal(planned.people.reduce((total, person) => total + person.events.length, 0), eventCount);
  assert.equal(planned.random(), control.random());
});

test("events, transactions, decisions, and learning records carry temporal identity", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  assert.deepEqual(
    (({ day, block, processingPhase, phaseIndex }) => ({ day, block, processingPhase, phaseIndex }))(person.events[0]),
    { day: 1, block: "Morning", processingPhase: "Planning", phaseIndex: 0 },
  );

  town.phase = 3;
  town.note(person, "temporal event");
  town.ledger(person, { direction: "in", amount: 0, text: "temporal transaction", before: person.cash });
  town.recordDecision(person, { kind: "test" }, ["wait"], { action: "wait", policy: "test" }, "Food shopping");
  town.applyKnowledgeLearning(person, {
    source: "test",
    sourceId: 0,
    sourceName: "Test",
    domain: "retail",
    rate: 0.1,
    rule: "test-temporal-v1",
    phase: "Production",
  });

  assert.deepEqual([person.events[0], person.ledger[0]].map(({ block, processingPhase, phaseIndex }) => ({ block, processingPhase, phaseIndex })), [
    { block: "Workday", processingPhase: "Payroll", phaseIndex: 3 },
    { block: "Workday", processingPhase: "Payroll", phaseIndex: 3 },
  ]);
  assert.deepEqual(
    (({ block, processingPhase, phaseIndex }) => ({ block, processingPhase, phaseIndex }))(person.decisions[0]),
    { block: "Evening", processingPhase: "Food", phaseIndex: 4 },
  );
  assert.deepEqual(
    (({ block, processingPhase, phaseIndex, sequence }) => ({ block, processingPhase, phaseIndex, sequence }))(person.learningHistory[0]),
    { block: "Workday", processingPhase: "Production", phaseIndex: 1, sequence: 1 },
  );
});

test("firm opportunity, staffing, and investment histories use settlement time and local sequences", () => {
  const town = new TownSimulation({ seed: 42 });
  const firm = town.firms.find((candidate) => candidate.archetypeId === "toolmaker");
  const supportedSales = firm.wage * 1.08 * firm.employees.length;

  town.phase = 7;
  town.observeFirmOpportunities();
  for (let day = 1; day <= 2; day += 1) {
    town.day = day;
    firm.sales = supportedSales;
    town.recordStaffingDemand(firm, "consumer", 10, "staffed transaction capacity");
    town.prepareFirmSettlement(firm);
    town.finishFirmSettlement(firm);
  }

  const settlementIdentity = { block: "Overnight", processingPhase: "Settlement", phaseIndex: 7 };
  assert.deepEqual(
    (({ block, processingPhase, phaseIndex }) => ({ block, processingPhase, phaseIndex }))(town.opportunityHistory[0]),
    settlementIdentity,
  );
  assert.deepEqual(firm.staffingDemandHistory.map(({ sequence }) => sequence), [1, 2]);
  assert.ok(firm.staffingDemandHistory.every(({ block, processingPhase, phaseIndex }) => (
    block === settlementIdentity.block && processingPhase === settlementIdentity.processingPhase && phaseIndex === settlementIdentity.phaseIndex
  )));
  assert.deepEqual(
    (({ block, processingPhase, phaseIndex, sequence }) => ({ block, processingPhase, phaseIndex, sequence }))(firm.investmentSlots[0].attempts[0]),
    { ...settlementIdentity, sequence: 1 },
  );
});
