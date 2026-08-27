export function resolveSelectedFirmId(firms, selectedFirmId) {
  if (!firms.length) return null;
  if (selectedFirmId === null || selectedFirmId === undefined) return (firms.find((firm) => firm.active) ?? firms[0]).id;
  return firms.some((firm) => firm.id === selectedFirmId) ? selectedFirmId : firms[0].id;
}

export function firmSelectorOptions(firms) {
  return firms.map((firm) => ({
    value: String(firm.id),
    label: `${firm.name}${firm.instanceNumber > 1 ? ` · instance ${firm.instanceNumber}` : ""} · ${firm.status}`,
    disabled: false,
  }));
}

export function staffingEvidence(firm) {
  const recent = firm.staffingDemandHistory.slice(-3);
  const qualifying = recent.filter((record) => record.totalUnits > 0);
  const unserved = qualifying.reduce((total, record) => total + record.totalUnits, 0);
  const contribution = qualifying.length
    ? qualifying.reduce((total, record) => total + record.expectedContribution, 0) / qualifying.length
    : 0;
  const activeSlot = firm.investmentSlots.find((slot) => ["recruiting", "evaluating"].includes(slot.status));
  const deadline = activeSlot?.status === "recruiting"
    ? `recruitment deadline D${activeSlot.recruitmentDeadline}`
    : activeSlot?.evaluationDeadline ? `evaluation deadline D${activeSlot.evaluationDeadline}` : "no deadline";
  return {
    headcount: `${firm.employees.length} employed · ${firm.targetStaff} approved · ${firm.incomeSupportedTarget} income-supported`,
    demand: `${qualifying.length}/3 recent days · ${unserved} unserved units · ${contribution.toFixed(2)} mean expected contribution`,
    slot: activeSlot
      ? `${activeSlot.id} · ${activeSlot.status} · ${activeSlot.fundingRequired.toFixed(2)} retained · ${deadline}`
      : "No active investment-funded slot",
    reason: firm.latestStaffingReason,
  };
}
