import assert from "node:assert/strict";
import test from "node:test";
import {
  firmSelectorOptions,
  resolveSelectedFirmId,
  staffingEvidence,
} from "../src/firm-detail-presentation.js";

const firms = [
  { id: 4, name: "Morrow Fields", archetypeId: "farm", instanceNumber: 1, status: "operating", active: true },
  { id: 9, name: "Green Basket", archetypeId: "premium-grocer", instanceNumber: 1, status: "insolvent", active: false },
];

test("firm selection persists for historical firms and otherwise falls back in founding order", () => {
  assert.equal(resolveSelectedFirmId(firms, 9), 9);
  assert.equal(resolveSelectedFirmId(firms, 999), 4);
  assert.equal(resolveSelectedFirmId([{ ...firms[1], id: 1 }, firms[0]], null), 4);
  assert.equal(resolveSelectedFirmId([], 4), null);
});

test("selector options retain stable identity and lifecycle state", () => {
  assert.deepEqual(firmSelectorOptions(firms), [
    { value: "4", label: "Morrow Fields · operating", disabled: false },
    { value: "9", label: "Green Basket · insolvent", disabled: false },
  ]);
});

test("staffing evidence explains targets, demand, funding, and the active slot", () => {
  const firm = {
    incomeSupportedTarget: 2,
    employees: [1, 2],
    targetStaff: 3,
    latestStaffingReason: "approved investment slot farm:1:investment:1",
    staffingDemandHistory: [
      { day: 7, totalUnits: 3, expectedContribution: 8.5 },
      { day: 8, totalUnits: 0, expectedContribution: 0 },
      { day: 9, totalUnits: 4, expectedContribution: 9 },
    ],
    investmentSlots: [{
      id: "farm:1:investment:1",
      status: "recruiting",
      fundingRequired: 40,
      recruitmentDeadline: 12,
      evaluationDeadline: null,
    }],
  };

  assert.deepEqual(staffingEvidence(firm), {
    headcount: "2 employed · 3 approved · 2 income-supported",
    demand: "2/3 recent days · 7 unserved units · 8.75 mean expected contribution",
    slot: "farm:1:investment:1 · recruiting · 40.00 retained · recruitment deadline D12",
    reason: "approved investment slot farm:1:investment:1",
  });
});
