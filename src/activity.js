import { compareTemporalNewest } from "./civil-time.js";

export function activityItems(person, filter = "all") {
  const transactions = person.ledger.map((entry) => ({ ...entry, type: "transaction" }));
  const events = person.events.map((entry) => ({ ...entry, type: "event" }));
  const knowledgeEffects = (person.knowledgeEffectHistory ?? []).map((entry) => ({ ...entry, type: "knowledge-effect" }));
  const mutualAid = (person.mutualAidHistory ?? []).map((entry) => ({ ...entry, type: "mutual-aid" }));
  const welfare = (person.welfareHistory ?? []).map((entry) => ({ ...entry, type: "welfare" }));
  const entries = filter === "transactions"
    ? transactions
    : filter === "events"
      ? events
      : filter === "knowledge-effects"
        ? knowledgeEffects
        : filter === "mutual-aid"
          ? mutualAid
          : filter === "welfare"
            ? welfare
            : [...transactions, ...events, ...knowledgeEffects, ...mutualAid, ...welfare];

  return entries.sort(compareTemporalNewest);
}

export function mutualAidDescription(entry) {
  const counterparty = entry.direction === "out" ? entry.recipientName : entry.giverName;
  const action = entry.direction === "out" ? `Gave a meal to ${counterparty}` : `Received a meal from ${counterparty}`;
  return `${action} · originally from ${entry.sellerName} · ${Math.round(entry.quality * 100)}% quality, ${entry.age}d old · pantry ${entry.pantryBefore} → ${entry.pantryAfter}`;
}
