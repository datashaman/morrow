import { compareTemporalNewest } from "./civil-time.js";

export function activityItems(person, filter = "all") {
  const transactions = person.ledger.map((entry) => ({ ...entry, type: "transaction" }));
  const events = person.events.map((entry) => ({ ...entry, type: "event" }));
  const entries = filter === "transactions"
    ? transactions
    : filter === "events"
      ? events
      : [...transactions, ...events];

  return entries.sort(compareTemporalNewest);
}
