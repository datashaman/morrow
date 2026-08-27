import { compareTemporalNewest } from "./civil-time.js";

export function activityItems(person, filter = "all") {
  const transactions = person.ledger.map((entry) => ({ ...entry, type: "transaction" }));
  const events = person.events.map((entry) => ({ ...entry, type: "event" }));
  const knowledgeEffects = (person.knowledgeEffectHistory ?? []).map((entry) => ({ ...entry, type: "knowledge-effect" }));
  const entries = filter === "transactions"
    ? transactions
    : filter === "events"
      ? events
      : filter === "knowledge-effects"
        ? knowledgeEffects
        : [...transactions, ...events, ...knowledgeEffects];

  return entries.sort(compareTemporalNewest);
}
