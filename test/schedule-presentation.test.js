import assert from "node:assert/strict";
import test from "node:test";
import { describeOpeningPattern, firmScheduleEvidence } from "../src/schedule-presentation.js";
import { TownSimulation } from "../src/simulation.js";

test("firm schedule presentation exposes openings, service window, current state, staffing, and pay", () => {
  const town = new TownSimulation({ seed: 42, schedulesEnabled: true });
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  town.day = 7;
  const evidence = firmScheduleEvidence({
    firm: grocer,
    people: town.people,
    day: town.day,
    open: town.firmOpenOnDay(grocer),
    nextOpeningDay: town.nextOpeningDay(grocer),
    shiftWage: town.scheduledShiftWage(grocer),
  });

  assert.equal(describeOpeningPattern(grocer), "Mon, Tue, Wed, Thu, Fri, Sat");
  assert.deepEqual(evidence, {
    openingPattern: "Mon, Tue, Wed, Thu, Fri, Sat",
    serviceWindow: "Evening",
    currentState: "Closed",
    nextOpening: 8,
    scheduledWorkers: 0,
    attendees: 0,
    shiftWage: 8.68,
    weeklyGross: 43.4,
  });
});
