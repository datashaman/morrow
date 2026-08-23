import assert from "node:assert/strict";
import test from "node:test";
import { activityItems } from "../src/activity.js";

const person = {
  ledger: [
    { day: 3, sequence: 4, direction: "in", text: "wage" },
    { day: 2, sequence: 2, direction: "out", text: "food" },
  ],
  events: [
    { day: 3, sequence: 5, kind: "good", text: "found work" },
    { day: 2, sequence: 3, kind: "bad", text: "missed rent" },
    { day: 1, sequence: 1, kind: "neutral", text: "entered town" },
  ],
};

test("activity defaults to all transactions and life events in sequence order", () => {
  assert.deepEqual(
    activityItems(person).map(({ type, text }) => [type, text]),
    [
      ["event", "found work"],
      ["transaction", "wage"],
      ["event", "missed rent"],
      ["transaction", "food"],
      ["event", "entered town"],
    ],
  );
});

test("activity can be filtered by record type", () => {
  assert.deepEqual(activityItems(person, "transactions").map(({ text }) => text), ["wage", "food"]);
  assert.deepEqual(activityItems(person, "events").map(({ text }) => text), ["found work", "missed rent", "entered town"]);
});

test("activity returns the complete matching history", () => {
  const longHistory = {
    ledger: Array.from({ length: 15 }, (_, index) => ({ day: index + 1, sequence: index + 1, text: `transaction ${index + 1}` })),
    events: Array.from({ length: 11 }, (_, index) => ({ day: index + 1, sequence: index + 16, text: `event ${index + 1}` })),
  };

  assert.equal(activityItems(longHistory).length, 26);
  assert.equal(activityItems(longHistory, "transactions").length, 15);
  assert.equal(activityItems(longHistory, "events").length, 11);
});
