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
