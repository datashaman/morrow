export function describeFirmOpportunity(opportunity) {
  const suppliers = opportunity.suppliers.map((supplier) => `${supplier.name} ${supplier.available ? "available" : "missing"}`).join(" · ");
  const evidence = `${opportunity.observedDays}/${opportunity.requiredObservationDays} days observed · ${opportunity.latestPotentialCustomers} ${opportunity.demandUnit} today · ${opportunity.expectedDailyRevenue.toFixed(1)} expected daily revenue · ${opportunity.expectedDailyCost.toFixed(1)} expected daily cost`;
  const resources = `${opportunity.availableWorkerIds.length}/${opportunity.requiredWorkers} workers available · founder ${opportunity.founderName ?? "not available"} · ${suppliers || "no suppliers required"}`;
  const explanation = opportunity.ready
    ? "Formation conditions are met; the founder can open during settlement."
    : opportunity.reasons.join(" · ");
  return { evidence, resources, explanation };
}

export function firmInstanceLabel(firm, firms) {
  const instances = firms.filter((candidate) => candidate.archetypeId === firm.archetypeId);
  return instances.length > 1 ? `${firm.name} · instance ${firm.instanceNumber}` : firm.name;
}
