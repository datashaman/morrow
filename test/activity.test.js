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
  knowledgeEffectHistory: [
    { day: 4, phaseIndex: 1, sequence: 1, effectType: "direct-yield", grossContribution: 0.2 },
  ],
};

test("activity defaults to all transactions, life events, and knowledge effects in sequence order", () => {
  assert.deepEqual(
    activityItems(person).map(({ type, text }) => [type, text]),
    [
      ["knowledge-effect", undefined],
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
  assert.deepEqual(activityItems(person, "knowledge-effects").map(({ grossContribution }) => grossContribution), [0.2]);
});

test("activity returns the complete matching history", () => {
  const longHistory = {
    ledger: Array.from({ length: 15 }, (_, index) => ({ day: index + 1, sequence: index + 1, text: `transaction ${index + 1}` })),
    events: Array.from({ length: 11 }, (_, index) => ({ day: index + 1, sequence: index + 16, text: `event ${index + 1}` })),
    knowledgeEffectHistory: Array.from({ length: 4 }, (_, index) => ({ day: index + 1, sequence: index + 27 })),
  };

  assert.equal(activityItems(longHistory).length, 30);
  assert.equal(activityItems(longHistory, "transactions").length, 15);
  assert.equal(activityItems(longHistory, "events").length, 11);
  assert.equal(activityItems(longHistory, "knowledge-effects").length, 4);
});
