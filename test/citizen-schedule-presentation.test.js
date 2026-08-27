import assert from "node:assert/strict";
import test from "node:test";
import { citizenScheduleEvidence } from "../src/citizen-schedule-presentation.js";

test("citizen schedule evidence exposes current activity, rota, obligations, and sleep", () => {
  const evidence = citizenScheduleEvidence({
    person: {
      alive: true,
      sleepDebt: 0.34,
      lastSleepQuality: 0.72,
      currentPrimaryActivity: { day: 8, block: "Workday", action: "clinic" },
      dailyPlan: { day: 8, workday: { activity: "clinic", status: "completed" } },
    },
    employer: { name: "Makers Guild" },
    day: 8,
    block: "Workday",
    scheduledToday: true,
    nextShiftDay: 8,
    daysUntilRent: 0,
  });

  assert.deepEqual(evidence, {
    currentActivity: "attending the clinic",
    workStatus: "scheduled at Makers Guild; clinic completed",
    nextShift: "next shift today",
    nextRent: "rent due today",
    sleep: "sleep debt 34% · last sleep quality 72%",
  });
});

test("empty schedule and sleep states render explicitly", () => {
  const evidence = citizenScheduleEvidence({
    person: { alive: true, sleepDebt: 0, lastSleepQuality: null, currentPrimaryActivity: null, dailyPlan: null },
    employer: null,
    day: 1,
    block: "Morning",
    scheduledToday: false,
    nextShiftDay: null,
    daysUntilRent: 3,
  });
  assert.equal(evidence.currentActivity, "reviewing today's plan");
  assert.equal(evidence.workStatus, "not employed");
  assert.equal(evidence.nextShift, "no next shift");
  assert.equal(evidence.sleep, "sleep debt 0% · no completed sleep yet");
});
