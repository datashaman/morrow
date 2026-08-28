import assert from "node:assert/strict";
import test from "node:test";
import { welfareDescription, welfareInspectorEvidence } from "../src/welfare-presentation.js";

const people = [{
  id: 1,
  name: "Amina",
  welfareHistory: [
    { day: 4, phaseIndex: 7, sequence: 4, programme: "emergency-cash-relief", programmeName: "Emergency Cash Relief", eligibilityResult: "eligible", offered: true, outcome: "refused", reason: "citizen refused immediate assistance" },
    { day: 4, phaseIndex: 4, sequence: 3, programme: "food-assistance", programmeName: "Food Assistance", outcome: "delivered", providerName: "Harvest Foods", privateContribution: 1, treasuryContribution: 1.15, reason: "exact essential purchase completed" },
    { day: 4, phaseIndex: 4, sequence: 2, programme: "food-assistance", programmeName: "Food Assistance", eligibilityResult: "eligible", offered: true, outcome: "accepted", reason: "citizen accepted immediate assistance" },
    { day: 3, phaseIndex: 5, sequence: 1, programme: "rent-assistance", programmeName: "Rent Assistance", eligibilityResult: "eligible", offered: true, outcome: "failed", reason: "exhausted daily envelope" },
  ],
}];

test("welfare inspector reports today's envelope and nonduplicated person outcomes", () => {
  const evidence = welfareInspectorEvidence({ day: 4, welfareState: { day: 4, envelope: 10, spent: 2.15 }, people, selectedCitizenId: 1 });

  assert.deepEqual(evidence.counts, { eligible: 2, offered: 2, accepted: 1, delivered: 1, refused: 1, failed: 0 });
  assert.equal(evidence.envelope, 10);
  assert.equal(evidence.spent, 2.15);
  assert.equal(evidence.remaining, 7.85);
  assert.equal(evidence.utilization, 0.215);
  assert.equal(evidence.latest.programme, "emergency-cash-relief");
});

test("programme filtering and historical failure reasons remain inspectable", () => {
  const evidence = welfareInspectorEvidence({ day: 3, welfareState: { day: 4, envelope: 10, spent: 2 }, people, programme: "rent-assistance", selectedCitizenId: 1 });

  assert.deepEqual(evidence.counts, { eligible: 1, offered: 1, accepted: 0, delivered: 0, refused: 0, failed: 1 });
  assert.deepEqual(evidence.failures, { "exhausted daily envelope": 1 });
  assert.equal(evidence.envelope, 0);
});

test("welfare activity copy identifies programme, provider, contributions, and outcome", () => {
  assert.equal(
    welfareDescription(people[0].welfareHistory[1]),
    "Food Assistance · delivered · provider Harvest Foods · private 1.00 · treasury 1.15 · exact essential purchase completed",
  );
});
