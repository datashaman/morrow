import { DEFAULT_LATENT_FIRM_NAMES, PHASES } from "./config.js";
import { TownSimulation } from "./simulation.js";

export const SECTOR_BALANCE_SCHEMA_VERSION = 1;
const EXPANDED_ARCHETYPES = Object.freeze(["apothecary", "school", "materials-yard", "clinic", "builder", "haulage", "housing-provider"]);
type BalanceConfig = Readonly<{ seeds: readonly number[]; days: number }>;

const round = (value: number) => Math.round(value * 1000) / 1000;
const sum = (values: number[]) => round(values.reduce((total, value) => total + value, 0));
const mean = (values: number[]) => values.length ? round(values.reduce((total, value) => total + value, 0) / values.length) : 0;

function entries(town: any, pattern: RegExp) {
  return town.people.flatMap((person: any) => person.ledger).filter((entry: any) => pattern.test(entry.text));
}

function sectorState(town: any, archetypeId: string) {
  const instances = town.firms.filter((firm: any) => firm.archetypeId === archetypeId);
  const active = instances.find((firm: any) => firm.active);
  if (!instances.length) return { state: "absent", instances: 0, activeInstanceId: null };
  if (!active) return { state: "failed", instances: instances.length, activeInstanceId: null };
  const shortfall = town.contracts.some((contract: any) => contract.active
    && (contract.buyerId === active.id || (archetypeId === "haulage" && contract.transportConstrainedToday))
    && contract.shortfallToday > 0);
  const transportConstrained = archetypeId === "haulage"
    && active.transportCapacityToday > 0
    && active.transportLoadToday >= active.transportCapacityToday;
  const constrained = active.status !== "operating" || active.operationalReadiness < 1 || shortfall || transportConstrained;
  return { state: constrained ? "constrained" : "operating", instances: instances.length, activeInstanceId: active.instanceId };
}

function summarizeTown(town: any, requestedDays: number) {
  const snapshot = town.snapshot();
  const living = town.people.filter((person: any) => person.alive);
  const activeFirms = town.firms.filter((firm: any) => firm.active);
  const wageEntries = entries(town, /wage from /);
  const supportEntries = entries(town, /support from treasury/);
  const medicineEntries = entries(town, /bought .* medicine dose/);
  const clinicalEntries = entries(town, /bought .* clinical appointment/);
  const educationEntries = entries(town, /bought .* lesson/);
  const failures = town.firms.filter((firm: any) => firm.closedDay !== null).map((firm: any) => ({
    archetypeId: firm.archetypeId,
    instanceId: firm.instanceId,
    day: firm.closedDay,
    status: firm.status,
  }));
  const formations = town.firms.filter((firm: any) => firm.foundingDay > 1).map((firm: any) => ({
    archetypeId: firm.archetypeId,
    instanceId: firm.instanceId,
    day: firm.foundingDay,
    founderId: firm.owner,
  }));
  return {
    completedDays: town.day - 1,
    requestedDays,
    population: {
      alive: snapshot.alive,
      dead: snapshot.dead,
      extinct: snapshot.alive === 0,
      meanLivingHealth: mean(living.map((person: any) => person.health)),
    },
    work: {
      employed: snapshot.employed,
      unemployed: Math.max(0, snapshot.alive - snapshot.employed),
      vacancies: snapshot.positionsAvailable,
      activeStaff: activeFirms.reduce((total: number, firm: any) => total + firm.employees.length, 0),
      targetStaff: activeFirms.reduce((total: number, firm: any) => total + firm.targetStaff, 0),
      netWagesPaid: sum(wageEntries.map((entry: any) => entry.amount)),
      wagePayments: wageEntries.length,
      meanStaffedWage: mean(activeFirms.flatMap((firm: any) => firm.employees.map(() => Math.max(town.policy.minimumWage, firm.wage)))),
    },
    business: {
      activeFirms: activeFirms.length,
      formations,
      closures: failures,
      insolvencies: failures.filter((failure: any) => ["insolvent", "receivership"].includes(failure.status)).length,
      replacements: formations.filter((formation: any) => Number(formation.instanceId.split(":")[1]) > 1).length,
      sectors: Object.fromEntries(EXPANDED_ARCHETYPES.map((archetypeId) => [archetypeId, sectorState(town, archetypeId)])),
    },
    access: {
      medicinePurchases: medicineEntries.length,
      clinicalTreatments: clinicalEntries.length,
      treatmentRecoveries: town.people.flatMap((person: any) => person.events).filter((event: any) => /treatment raised health|self-care medicine raised health/.test(event.text)).length,
      educationLessons: educationEntries.length,
      meanLivingSkill: mean(living.map((person: any) => person.skill)),
      dwellingCapacity: town.housingCapacityEnabled ? snapshot.dwellingCapacity : null,
      housed: Math.max(0, snapshot.alive - snapshot.unhoused),
      unhoused: snapshot.unhoused,
      hungry: snapshot.hungry,
      supportPaid: sum(supportEntries.map((entry: any) => entry.amount)),
      supportPayments: supportEntries.length,
    },
    cash: {
      initial: town.initialMoney,
      final: town.totalMoney(),
      conserved: Math.abs(town.totalMoney() - town.initialMoney) <= 0.1,
    },
  };
}

function runConfiguration(seed: number, days: number, expanded: boolean) {
  const town: any = new TownSimulation((expanded ? {
    seed,
    latentFirmNames: [...DEFAULT_LATENT_FIRM_NAMES],
    housingCapacityEnabled: true,
    transportEnabled: true,
  } : {
    seed,
    latentFirmNames: [...DEFAULT_LATENT_FIRM_NAMES],
    formationArchetypeIds: ["cafe", "premium-grocer"],
    housingCapacityEnabled: false,
    transportEnabled: false,
  }) as any);
  for (let elapsed = 0; elapsed < days && !town.isExtinct(); elapsed += 1) {
    for (let phase = 0; phase < PHASES.length; phase += 1) town.step();
    town.assertInvariants();
  }
  town.assertInvariants();
  const summary = summarizeTown(town, days);
  if (!summary.cash.conserved) throw new Error(`Cash conservation failed for ${expanded ? "expanded" : "baseline"} seed ${seed}`);
  return summary;
}

function comparison(seed: number, baseline: any, expanded: any) {
  const delta = {
    alive: expanded.population.alive - baseline.population.alive,
    employed: expanded.work.employed - baseline.work.employed,
    vacancies: expanded.work.vacancies - baseline.work.vacancies,
    activeStaff: expanded.work.activeStaff - baseline.work.activeStaff,
    hungry: expanded.access.hungry - baseline.access.hungry,
    unhoused: expanded.access.unhoused - baseline.access.unhoused,
    supportPaid: round(expanded.access.supportPaid - baseline.access.supportPaid),
    dwellingCapacity: baseline.access.dwellingCapacity === null ? null : expanded.access.dwellingCapacity - baseline.access.dwellingCapacity,
  };
  const regressions = [
    delta.alive < 0 ? `alive population fell by ${Math.abs(delta.alive)}` : null,
    delta.employed < 0 ? `employment fell by ${Math.abs(delta.employed)}` : null,
    delta.hungry > 0 ? `hunger rose by ${delta.hungry}` : null,
    delta.unhoused > 0 ? `unhoused population rose by ${delta.unhoused}` : null,
    expanded.population.extinct && !baseline.population.extinct ? "expanded town became extinct while baseline did not" : null,
  ].filter(Boolean).map((observation) => `${observation}; retain for causal review rather than treating the expanded sectors as an automatic improvement`);
  return { seed, baseline, expanded, delta, regressions };
}

export function evaluateSectorBalance(config: BalanceConfig) {
  if (!config.seeds.length || config.seeds.some((seed) => !Number.isInteger(seed))) throw new Error("At least one integer seed is required");
  if (!Number.isInteger(config.days) || config.days < 1) throw new Error("Balance days must be a positive integer");
  const runs = config.seeds.map((seed) => comparison(seed, runConfiguration(seed, config.days, false), runConfiguration(seed, config.days, true)));
  return {
    metadata: {
      schemaVersion: SECTOR_BALANCE_SCHEMA_VERSION,
      simulation: "Morrow",
      seeds: [...config.seeds],
      days: config.days,
      phasesPerDay: PHASES.length,
      baseline: "four-firm foundation; legacy self-delivery; unlimited operating housing; café and premium-food formation only",
      expanded: "five-firm foundation with haulage; finite housing; all seven private formation archetypes",
      invariantChecks: "cash conservation, non-negative finite balances, exact-transfer safety, valid employment/contracts, and reciprocal relationships checked after every simulated day",
      interpretation: "Deterministic gameplay comparison only. Thresholds and deltas are hypotheses, not empirical calibration, forecast, or policy evidence.",
    },
    status: "passed",
    runs,
    regressions: runs.flatMap((run) => run.regressions.map((observation) => ({ seed: run.seed, observation }))),
  } as const;
}

export function formatSectorBalance(report: ReturnType<typeof evaluateSectorBalance>) {
  const lines = [`Morrow sector balance · ${report.metadata.seeds.length} seeds × 2 configurations × ${report.metadata.days} days · ${report.status.toUpperCase()}`];
  report.runs.forEach((run) => lines.push(
    `seed ${run.seed}: alive ${run.baseline.population.alive}→${run.expanded.population.alive} (${run.delta.alive >= 0 ? "+" : ""}${run.delta.alive}) · employed ${run.baseline.work.employed}→${run.expanded.work.employed} (${run.delta.employed >= 0 ? "+" : ""}${run.delta.employed}) · vacancies ${run.baseline.work.vacancies}→${run.expanded.work.vacancies} · hungry ${run.baseline.access.hungry}→${run.expanded.access.hungry} · unhoused ${run.baseline.access.unhoused}→${run.expanded.access.unhoused} · formations ${run.baseline.business.formations.length}→${run.expanded.business.formations.length} · failures ${run.baseline.business.closures.length}→${run.expanded.business.closures.length}${run.regressions.length ? ` · REVIEW ${run.regressions.length}` : ""}`,
  ));
  lines.push(`Unexpected regressions retained: ${report.regressions.length}`);
  lines.push(report.metadata.interpretation);
  return lines.join("\n");
}
