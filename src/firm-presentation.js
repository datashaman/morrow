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
