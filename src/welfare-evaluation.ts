import { DEFAULT_LATENT_FIRM_NAMES, PHASES, WELFARE_PROGRAMMES } from "./config.js";
import { TownSimulation } from "./simulation.js";

export const WELFARE_EVALUATION_SCHEMA_VERSION = 1;
export const DEFAULT_WELFARE_EVALUATION_SEEDS = Object.freeze([101, 202, 303, 404, 505]);
export const WELFARE_EVALUATION_MODES = Object.freeze(["none", "legacy-cash", "direct-only", "combined"] as const);

type WelfareMode = (typeof WELFARE_EVALUATION_MODES)[number];
type WelfareEvaluationConfig = Readonly<{ seeds: readonly number[]; days: number }>;

const round = (value: number) => Math.round(value * 1000) / 1000;
const sum = (values: number[]) => round(values.reduce((total, value) => total + value, 0));

function programmeMetrics(records: any[], programme: string) {
  const matching = records.filter((record: any) => record.programme === programme);
  const eligible = matching.filter((record: any) => record.eligibilityResult === "eligible").length;
  const accepted = matching.filter((record: any) => record.outcome === "accepted").length;
  const delivered = matching.filter((record: any) => record.outcome === "delivered");
  const failures = matching.filter((record: any) => record.outcome === "failed");
  return {
    eligible,
    offered: matching.filter((record: any) => record.offered === true && record.eligibilityResult === "eligible").length,
    accepted,
    refused: matching.filter((record: any) => record.outcome === "refused").length,
    delivered: delivered.length,
    failed: failures.length,
    takeUpRate: eligible ? round(accepted / eligible) : 0,
    deliveryRate: eligible ? round(delivered.length / eligible) : 0,
    treasuryContribution: sum(delivered.map((record: any) => record.treasuryContribution ?? 0)),
    completeProviderRevenue: sum(delivered.map((record: any) => record.completePrice ?? record.treasuryContribution ?? 0)),
    failureReasons: failures.reduce((totals: Record<string, number>, record: any) => {
      totals[record.reason] = (totals[record.reason] ?? 0) + 1;
      return totals;
    }, {}),
  };
}

function runMode(seed: number, days: number, welfareMode: WelfareMode) {
  const town: any = new TownSimulation({
    seed,
    latentFirmNames: [...DEFAULT_LATENT_FIRM_NAMES],
    housingCapacityEnabled: true,
    transportEnabled: true,
    schedulesEnabled: true,
    sleepEnabled: true,
    cooperationMode: "mutual-aid",
    welfareMode,
  } as any);
  let hungerCitizenDays = 0;
  let unhousedCitizenDays = 0;
  let employedCitizenDays = 0;
  let livingCitizenDays = 0;
  let healthTotal = 0;
  let minimumTreasuryCash = town.government.cash;
  const trajectory: any[] = [];
  for (let elapsed = 0; elapsed < days && !town.isExtinct(); elapsed += 1) {
    for (let phase = 0; phase < PHASES.length; phase += 1) town.step();
    town.assertInvariants();
    const living = town.people.filter((person: any) => person.alive);
    const hungry = living.filter((person: any) => person.hungryDays > 0).length;
    const unhoused = living.filter((person: any) => !person.housed).length;
    const employed = living.filter((person: any) => person.employer >= 0).length;
    hungerCitizenDays += hungry;
    unhousedCitizenDays += unhoused;
    employedCitizenDays += employed;
    livingCitizenDays += living.length;
    healthTotal += living.reduce((total: number, person: any) => total + person.health, 0);
    minimumTreasuryCash = Math.min(minimumTreasuryCash, town.government.cash);
    trajectory.push({ day: town.day - 1, alive: living.length, hungry, unhoused, employed, treasuryCash: town.government.cash });
  }

  const welfareRecords = town.people.flatMap((person: any) => person.welfareHistory);
  const deliveredRecords = welfareRecords.filter((record: any) => record.outcome === "delivered");
  const recipientIds = new Set(deliveredRecords.map((record: any) => record.recipientId));
  const nonRecipients = town.people.filter((person: any) => !recipientIds.has(person.id));
  const legacySupport = town.people.flatMap((person: any) => person.ledger)
    .filter((entry: any) => entry.direction === "in" && entry.text === "support from treasury");
  const providerRevenue = deliveredRecords.filter((record: any) => record.providerId !== null).reduce((totals: Record<string, number>, record: any) => {
    totals[record.providerName] = round((totals[record.providerName] ?? 0) + record.completePrice);
    return totals;
  }, {});
  const linkedIds = new Set([...town.people, ...town.firms, town.government].flatMap((actor: any) => actor.ledger).map((entry: any) => entry.transactionId).filter(Boolean));
  const finalCash = town.totalMoney();
  const hardChecks = {
    cashConserved: Math.abs(finalCash - town.initialMoney) <= 0.1,
    noOverdrafts: [...town.people, ...town.firms, town.government].every((actor: any) => actor.cash >= -1e-9),
    allWelfareTransfersLinked: deliveredRecords.every((record: any) => record.linkedTransactionIds.every((id: string) => linkedIds.has(id))),
    deathIsTerminal: town.people.every((person: any) => person.welfareHistory.every((record: any) => person.deathDay === null || record.day <= person.deathDay)),
  };
  if (Object.values(hardChecks).some((passed) => !passed)) throw new Error(`Welfare invariant failed for seed ${seed}, mode ${welfareMode}`);
  return {
    mode: welfareMode,
    completedDays: town.day - 1,
    trajectory,
    programmes: {
      food: programmeMetrics(welfareRecords, WELFARE_PROGRAMMES.food.id),
      rent: programmeMetrics(welfareRecords, WELFARE_PROGRAMMES.rent.id),
      cash: programmeMetrics(welfareRecords, WELFARE_PROGRAMMES.cash.id),
      legacyCash: { payments: legacySupport.length, amount: sum(legacySupport.map((entry: any) => entry.amount)) },
    },
    treasury: {
      initialCash: 120,
      finalCash: town.government.cash,
      minimumCash: round(minimumTreasuryCash),
      separateFundBalance: null,
    },
    providers: { welfareRevenueByProvider: providerRevenue },
    outcomes: {
      employmentRate: livingCitizenDays ? round(employedCitizenDays / livingCitizenDays) : 0,
      hungerCitizenDays,
      unhousedCitizenDays,
      meanLivingHealth: livingCitizenDays ? round(healthTotal / livingCitizenDays) : 0,
      survivors: town.people.filter((person: any) => person.alive).length,
      deaths: town.people.filter((person: any) => !person.alive).length,
      nonRecipientHardship: {
        citizens: nonRecipients.length,
        hungry: nonRecipients.filter((person: any) => person.alive && person.hungryDays > 0).length,
        unhoused: nonRecipients.filter((person: any) => person.alive && !person.housed).length,
        deaths: nonRecipients.filter((person: any) => !person.alive).length,
      },
    },
    hardChecks,
  };
}

export function evaluateWelfare(config: WelfareEvaluationConfig) {
  if (!config.seeds.length || config.seeds.some((seed) => !Number.isInteger(seed))) throw new Error("At least one integer seed is required");
  if (!Number.isInteger(config.days) || config.days < 1) throw new Error("Welfare evaluation days must be a positive integer");
  const runs = config.seeds.map((seed) => {
    const modes = WELFARE_EVALUATION_MODES.map((mode) => runMode(seed, config.days, mode));
    const replay = WELFARE_EVALUATION_MODES.map((mode) => runMode(seed, config.days, mode));
    if (JSON.stringify(modes) !== JSON.stringify(replay)) throw new Error(`Deterministic welfare replay failed for seed ${seed}`);
    return { seed, deterministicReplay: true, modes };
  });
  return {
    metadata: {
      schemaVersion: WELFARE_EVALUATION_SCHEMA_VERSION,
      simulation: "Morrow",
      seeds: [...config.seeds],
      days: config.days,
      phasesPerDay: PHASES.length,
      modes: [...WELFARE_EVALUATION_MODES],
      interpretation: "Deterministic gameplay comparison only. Programme take-up, provider revenue, employment, hardship, health, survival, and non-recipient outcomes are observations—not pass criteria, empirical calibration, forecasts, causal estimates, or claims about real welfare policy.",
    },
    status: "passed",
    runs,
  } as const;
}

export function formatWelfareEvaluation(report: ReturnType<typeof evaluateWelfare>) {
  const lines = [`Morrow welfare evaluation · ${report.metadata.seeds.length} seeds × 4 modes × ${report.metadata.days} days · ${report.status.toUpperCase()}`];
  report.runs.forEach((run) => {
    lines.push(`seed ${run.seed}: ${run.modes.map((mode) => `${mode.mode} delivered ${mode.programmes.food.delivered}/${mode.programmes.rent.delivered}/${mode.programmes.cash.delivered}, hunger-days ${mode.outcomes.hungerCitizenDays}, unhoused-days ${mode.outcomes.unhousedCitizenDays}, alive ${mode.outcomes.survivors}, treasury ${mode.treasury.finalCash.toFixed(1)}`).join(" → ")}`);
  });
  lines.push(report.metadata.interpretation);
  return lines.join("\n");
}
