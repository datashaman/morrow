export function describePipeline(firm, products) {
  const output = products[firm.sells];
  if (firm.production === "sourced") {
    return `Sells ${output.name}; uses ${products[firm.input].name} from ${firm.source}. ${firm.sourceDescription}.`;
  }
  if (firm.production === "direct") return `Makes ${output.name} directly. ${firm.sourceDescription}.`;
  return `Operates ${output.name}. ${firm.sourceDescription}.`;
}

export function describeContract(contract, products) {
  const requested = contract.requestedToday ?? 0;
  const delivered = contract.deliveredToday ?? 0;
  const state = contract.active ? "active" : "ended";
  const unit = products[contract.product].unit;
  const displayedUnit = Math.max(requested, delivered) === 1 ? unit : `${unit}s`;
  const freight = contract.transportLoadToday
    ? ` · supplier share ${(contract.supplierUnitPriceToday ?? contract.unitPrice).toFixed(2)} each + ${contract.transportLoadToday} haulage load for ${contract.transportFeeToday.toFixed(2)}`
    : "";
  return `${contract.supplier} → ${contract.buyer} contract ${state} · ${delivered}/${requested} ${displayedUnit} delivered today at ${contract.unitPrice.toFixed(2)} each${freight}`;
}

export function describeProcessing(firm, products) {
  if (!firm.processingPerWorker) return "";
  const inputUnit = products[firm.input].unit;
  const outputUnit = products[firm.sells].unit;
  const inputs = Math.floor(firm.inputInventory);
  const outputs = Math.floor(firm.inventory);
  const shortfall = firm.processingShortfallToday;
  return `Processing · ${inputs} ${inputUnit}${inputs === 1 ? "" : "s"} awaiting · ${outputs} ${outputUnit}${outputs === 1 ? "" : "s"} stocked · ${firm.processedToday}/${firm.processingCapacityToday} units processed today · ${shortfall} labor-limited input shortfall`;
}

export function describePerishableInventory(firm, products, day) {
  if (!firm.inventoryBatches?.length && !firm.wasteHistory?.length) return "";
  const batches = (firm.inventoryBatches ?? []).filter((batch) => batch.quantity > 0);
  const buckets = new Map();
  batches.forEach((batch) => {
    const age = Math.max(0, day - batch.batchDay);
    buckets.set(age, (buckets.get(age) ?? 0) + batch.quantity);
  });
  const ageBuckets = [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([age, quantity]) => `age ${age}: ${quantity.toFixed(1)}`)
    .join(", ");
  const nextExpiry = batches.length ? Math.min(...batches.map((batch) => batch.batchDay + batch.shelfLife)) : null;
  const wasted = (firm.wasteHistory ?? []).reduce((total, record) => total + record.quantity, 0);
  const unit = products[firm.sells].unit;
  return `Perishable stock · ${firm.inventory.toFixed(1)} ${unit}${firm.inventory === 1 ? "" : "s"}${ageBuckets ? ` (${ageBuckets})` : ""} · ${nextExpiry === null ? "no stock awaiting expiry" : `next expiry D${nextExpiry}`} · ${firm.perishableProcessedToday ?? 0} processed today · ${firm.perishableSalesToday ?? 0} sold today · ${wasted.toFixed(1)} wasted total`;
}
