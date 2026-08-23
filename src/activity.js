export function activityItems(person, filter = "all", limit = 8) {
  const transactions = person.ledger.map((entry) => ({ ...entry, type: "transaction" }));
  const events = person.events.map((entry) => ({ ...entry, type: "event" }));
  const entries = filter === "transactions"
    ? transactions
    : filter === "events"
      ? events
      : [...transactions, ...events];

  return entries
    .sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0) || b.day - a.day)
    .slice(0, limit);
}
