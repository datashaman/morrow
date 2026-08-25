import { PHASES } from "./config.js";
import { TownSimulation } from "./simulation.js";

export const FIRM_VIABILITY_SCHEMA_VERSION = 1;
export const DEFAULT_OPTIONAL_FIRMS = ["Green Basket", "Common Café"] as const;

type ViabilityConfig = Readonly<{
  seeds: readonly number[];
  days: number;
  firms?: readonly string[];
}>;

const round = (value: number) => Math.round(value * 100) / 100;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function decisionForDay(person: any, day: number, kind: string) {
  return person.decisions.find((decision: any) => decision.day === day && decision.kind === kind);
}

function marketEvidence(town: any, firm: any, day: number) {
  const essentialCost = town.essentialCost();
  if (firm.name === "Green Basket") {
    const decisions = town.people.map((person: any) => decisionForDay(person, day, "food")).filter(Boolean);
    const activeShoppers = decisions.filter((decision: any) => !decision.observation.options.some((option: any) => option.source === "stored"));
    const eligible = activeShoppers.filter((decision: any) => decision.observation.runwayDays * essentialCost + 1e-9 >= firm.price);
    return {
      eligiblePotentialCustomers: eligible.length,
      legalPotentialCustomers: decisions.filter((decision: any) => decision.observation.options.some((option: any) => option.sellerId === firm.id)).length,
      affordabilityFailures: firm.active && firm.inventory >= 1 ? activeShoppers.length - eligible.length : 0,
      inventoryFailures: firm.active && firm.inventory < 1 ? activeShoppers.length : 0,
    };
  }

  const decisions = town.people.map((person: any) => decisionForDay(person, day, "personal-time")).filter(Boolean);
  let eligiblePotentialCustomers = 0;
  let affordabilityFailures = 0;
  decisions.forEach((decision: any) => {
    const observation = decision.observation;
    const cash = observation.runwayDays * essentialCost;
    const comfort = observation.stress > 0.65 && town.people[observation.citizenId].scarcityError;
    const belonging = observation.focus === "belonging";
    if (comfort || belonging) eligiblePotentialCustomers += 1;
    const comfortBlocked = comfort && cash + 1e-9 < firm.price;
    const belongingBlocked = belonging && cash <= firm.price + 7;
    if (firm.active && firm.inventory >= 1 && (comfortBlocked || belongingBlocked)) affordabilityFailures += 1;
  });
  return {
    eligiblePotentialCustomers,
    legalPotentialCustomers: decisions.filter((decision: any) => decision.legalActions.some((action: string) => ["buy-comfort", "social-visit"].includes(action))).length,
    affordabilityFailures,
    inventoryFailures: firm.active && firm.inventory < 1 ? eligiblePotentialCustomers : 0,
  };
}

function summarizeFirm(name: string, days: any[]) {
  const operatingDays = days.filter((day) => day.activeAtStart).length;
  const revenue = round(sum(days.map((day) => day.revenue)));
  const produceInputs = round(sum(days.map((day) => day.produceInputCost)));
  const maintenance = round(sum(days.map((day) => day.maintenanceCost)));
  const payroll = round(sum(days.map((day) => day.payrollAndTax)));
  const operatingCosts = round(produceInputs + maintenance + payroll);
  const operatingMargin = round(revenue - operatingCosts);
  const requestedInputs = sum(days.map((day) => day.requestedInputs));
  const deliveredInputs = sum(days.map((day) => day.deliveredInputs));
  const supplyFulfillment = requestedInputs ? deliveredInputs / requestedInputs : 1;
  const legalPotentialCustomers = sum(days.map((day) => day.legalPotentialCustomers));
  const completedCustomers = sum(days.map((day) => day.completedCustomers));
  const affordabilityFailures = sum(days.map((day) => day.affordabilityFailures));
  const inventoryFailures = sum(days.map((day) => day.inventoryFailures));
  const capacityFailures = sum(days.map((day) => day.capacityFailures));
  const closure = days.find((day) => day.closedToday);
  const constraints = [
    ...(supplyFulfillment < 0.95 ? ["upstream-supply"] : []),
    ...(inventoryFailures ? ["inventory"] : []),
    ...(capacityFailures ? ["transaction-capacity"] : []),
    ...(affordabilityFailures ? ["affordability"] : []),
  ];
  const primaryFinding = closure
    ? operatingMargin < 0 && supplyFulfillment >= 0.8 && capacityFailures === 0
      ? "unsupported-demand"
      : constraints.length ? "operational-constraint" : "non-operating-cash-flow"
    : "operating";
  return {
    name,
    operatingDays,
    closureDay: closure?.day ?? null,
    closureReason: closure?.closureReason ?? null,
    revenue,
    costs: { produceInputs, maintenance, payrollAndTax: payroll, total: operatingCosts },
    operatingMargin,
    demand: {
      eligiblePotentialCustomers: sum(days.map((day) => day.eligiblePotentialCustomers)),
      legalPotentialCustomers,
      completedCustomers,
      completionRate: legalPotentialCustomers ? completedCustomers / legalPotentialCustomers : 0,
    },
    constraints: {
      affordabilityFailures,
      inventoryFailures,
      capacityFailures,
      requestedInputs,
      deliveredInputs,
      supplyFulfillment,
      observed: constraints,
    },
    primaryFinding,
    days,
  };
}

export function evaluateOptionalFirmRun({ seed, days, firms = DEFAULT_OPTIONAL_FIRMS }: { seed: number; days: number; firms?: readonly string[] }) {
  const town: any = new TownSimulation({ seed });
  const targets = firms.map((name) => {
    const firm = town.firms.find((candidate: any) => candidate.name === name);
    if (!firm) throw new Error(`Unknown firm: ${name}`);
    return firm;
  });
  const daily = Object.fromEntries(targets.map((firm: any) => [firm.name, []])) as Record<string, any[]>;
  const householdPurchasingPower: any[] = [];

  for (let index = 0; index < days && !town.isExtinct(); index += 1) {
    const day = town.day;
    const start = Object.fromEntries(targets.map((firm: any) => [firm.name, { cash: firm.cash, active: firm.active, status: firm.status }]));
    town.step();
    town.step();
    const contracts = Object.fromEntries(targets.map((firm: any) => [firm.name, town.contracts.filter((contract: any) => contract.buyerId === firm.id).map((contract: any) => ({
      use: contract.use ?? "production",
      requested: contract.requestedToday,
      delivered: contract.deliveredToday,
      shortfall: contract.shortfallToday,
      cost: round(contract.deliveredToday * contract.unitPrice),
    }))]));
    const beforePayroll = Object.fromEntries(targets.map((firm: any) => [firm.name, firm.cash]));
    town.step();
    const payroll = Object.fromEntries(targets.map((firm: any) => [firm.name, round(Math.max(0, beforePayroll[firm.name] - firm.cash))]));
    town.step();
    town.step();
    const alive = town.people.filter((person: any) => person.alive);
    const protectedEssentials = town.essentialCost() * 4;
    householdPurchasingPower.push({
      day,
      alive: alive.length,
      totalCash: round(sum(alive.map((person: any) => person.cash))),
      protectedEssentialsPerCitizen: round(protectedEssentials),
      discretionaryCash: round(sum(alive.map((person: any) => Math.max(0, person.cash - protectedEssentials)))),
      citizensWithDiscretionaryCash: alive.filter((person: any) => person.cash > protectedEssentials).length,
    });
    town.step();

    const beforeSettlement = Object.fromEntries(targets.map((firm: any) => {
      const incoming = contracts[firm.name];
      return [firm.name, {
        day,
        activeAtStart: start[firm.name].active,
        statusAtStart: start[firm.name].status,
        startCash: start[firm.name].cash,
        revenue: round(firm.sales),
        produceInputCost: round(sum(incoming.filter((contract: any) => contract.use !== "operations").map((contract: any) => contract.cost))),
        maintenanceCost: round(sum(incoming.filter((contract: any) => contract.use === "operations").map((contract: any) => contract.cost))),
        payrollAndTax: payroll[firm.name],
        requestedInputs: sum(incoming.map((contract: any) => contract.requested)),
        deliveredInputs: sum(incoming.map((contract: any) => contract.delivered)),
        inputShortfall: sum(incoming.map((contract: any) => contract.shortfall)),
        completedCustomers: firm.transactionsToday,
        capacityFailures: firm.turnedAwayTransactions,
        unitsSold: firm.unitsSold,
        inventory: round(firm.inventory),
        operationalReadiness: firm.operationalReadiness,
        price: firm.price,
        staff: firm.employees.length,
        ...marketEvidence(town, firm, day),
      }];
    }));

    town.step();
    targets.forEach((firm: any) => {
      const closureEvent = !firm.active && start[firm.name].active
        ? firm.events.find((event: any) => event.day === day && /insolvency|receivership/.test(event.text))
        : null;
      daily[firm.name].push({
        ...beforeSettlement[firm.name],
        endCash: firm.cash,
        netCashFlow: round(firm.cash - start[firm.name].cash),
        endStatus: firm.status,
        closedToday: !firm.active && start[firm.name].active,
        closureReason: closureEvent?.text ?? null,
      });
    });
  }

  town.assertInvariants();
  return {
    seed,
    requestedDays: days,
    completedDays: town.day - 1,
    cash: { initial: town.initialMoney, final: town.totalMoney(), conserved: Math.abs(town.totalMoney() - town.initialMoney) <= 0.1 },
    final: town.snapshot(),
    householdPurchasingPower,
    firms: Object.fromEntries(targets.map((firm: any) => [firm.name, summarizeFirm(firm.name, daily[firm.name])])),
  };
}

export function evaluateOptionalFirmViability(config: ViabilityConfig) {
  if (!config.seeds.length) throw new Error("At least one diagnostic seed is required");
  if (!Number.isInteger(config.days) || config.days < 1) throw new Error("Diagnostic days must be a positive integer");
  const firms = config.firms ?? DEFAULT_OPTIONAL_FIRMS;
  const runs = config.seeds.map((seed) => evaluateOptionalFirmRun({ seed, days: config.days, firms }));
  return {
    metadata: {
      schemaVersion: FIRM_VIABILITY_SCHEMA_VERSION,
      simulation: "Morrow",
      seeds: [...config.seeds],
      days: config.days,
      phasesPerDay: PHASES.length,
      firms: [...firms],
      interpretation: "Deterministic gameplay diagnostics, not empirical calibration or prediction.",
    },
    status: runs.every((run) => run.cash.conserved) ? "passed" : "failed",
    runs,
  } as const;
}

export function formatFirmViabilitySummary(report: ReturnType<typeof evaluateOptionalFirmViability>) {
  const lines = [`Morrow optional-firm diagnostic · ${report.metadata.seeds.length} seeds × ${report.metadata.days} days · ${report.status.toUpperCase()}`];
  report.runs.forEach((run) => {
    lines.push(`Seed ${run.seed}:`);
    Object.values(run.firms).forEach((firm: any) => {
      lines.push(`  ${firm.name}: ${firm.primaryFinding} · ${firm.closureDay ? `closed D${firm.closureDay}` : "still operating"} · revenue ${firm.revenue.toFixed(2)} − costs ${firm.costs.total.toFixed(2)} = ${firm.operatingMargin.toFixed(2)} · potential ${firm.demand.legalPotentialCustomers} / completed ${firm.demand.completedCustomers} · supply ${(firm.constraints.supplyFulfillment * 100).toFixed(1)}% · capacity failures ${firm.constraints.capacityFailures} · affordability failures ${firm.constraints.affordabilityFailures}`);
    });
  });
  lines.push(report.metadata.interpretation);
  return lines.join("\n");
}
