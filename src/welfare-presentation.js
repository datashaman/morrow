import { compareTemporalNewest } from "./civil-time.js";

export const WELFARE_PROGRAMME_OPTIONS = Object.freeze([
  Object.freeze({ value: "all", label: "All programmes" }),
  Object.freeze({ value: "food-assistance", label: "Food Assistance" }),
  Object.freeze({ value: "rent-assistance", label: "Rent Assistance" }),
  Object.freeze({ value: "emergency-cash-relief", label: "Emergency Cash Relief" }),
]);

export function welfareDescription(entry) {
  const programme = entry.programmeName ?? entry.programme ?? "Welfare";
  const provider = entry.providerName ? ` · provider ${entry.providerName}` : "";
  const contributions = entry.outcome === "delivered"
    ? ` · private ${(entry.privateContribution ?? 0).toFixed(2)} · treasury ${(entry.treasuryContribution ?? 0).toFixed(2)}`
    : "";
  return `${programme} · ${entry.outcome}${provider}${contributions} · ${entry.reason}`;
}

export function welfareInspectorEvidence({ day, welfareState, people, programme = "all", selectedCitizenId = null }) {
  const matchesProgramme = (entry) => programme === "all" || entry.programme === programme;
  const today = people.flatMap((person) => (person.welfareHistory ?? []).filter((entry) => entry.day === day && matchesProgramme(entry)));
  const count = (predicate) => today.filter(predicate).length;
  const failures = today.filter((entry) => entry.outcome === "failed").reduce((totals, entry) => {
    totals[entry.reason] = (totals[entry.reason] ?? 0) + 1;
    return totals;
  }, {});
  const selectedCitizen = people.find((person) => person.id === selectedCitizenId) ?? null;
  const latest = selectedCitizen
    ? [...(selectedCitizen.welfareHistory ?? [])].filter(matchesProgramme).sort(compareTemporalNewest)[0] ?? null
    : null;
  const currentEnvelope = welfareState.day === day;
  const envelope = currentEnvelope ? welfareState.envelope : 0;
  const spent = currentEnvelope ? welfareState.spent : 0;
  return Object.freeze({
    programme,
    envelope,
    spent,
    remaining: Math.max(0, Math.round((envelope - spent) * 100) / 100),
    utilization: envelope > 0 ? Math.min(1, spent / envelope) : 0,
    counts: Object.freeze({
      eligible: count((entry) => entry.eligibilityResult === "eligible"),
      offered: count((entry) => entry.offered === true && entry.eligibilityResult === "eligible"),
      accepted: count((entry) => entry.outcome === "accepted"),
      delivered: count((entry) => entry.outcome === "delivered"),
      refused: count((entry) => entry.outcome === "refused"),
      failed: count((entry) => entry.outcome === "failed"),
    }),
    failures: Object.freeze(failures),
    selectedCitizenName: selectedCitizen?.name ?? null,
    latest,
  });
}
