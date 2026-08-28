import { DEFAULT_LATENT_FIRM_NAMES, PHASES } from "./config.js";
import { MotivationCitizenPolicy } from "./citizen-policy.js";
import { TownSimulation } from "./simulation.js";

export const PUBLIC_WORKS_EVALUATION_SCHEMA_VERSION = 1;
export const DEFAULT_PUBLIC_WORKS_EVALUATION_SEEDS = Object.freeze([101, 202, 303, 404, 505]);
export const DEFAULT_PUBLIC_WORKS_EVALUATION_DAYS = 196;

type PublicWorksEvaluationConfig = Readonly<{ seeds: readonly number[]; days: number; replay?: boolean }>;

const round = (value: number) => Math.round(value * 1000) / 1000;
const sum = (values: number[]) => round(values.reduce((total, value) => total + value, 0));

function runArm(seed: number, requestedDays: number, publicWorksEnabled: boolean) {
  const town: any = new TownSimulation({
    seed,
    citizenPolicy: new MotivationCitizenPolicy(),
    latentFirmNames: [...DEFAULT_LATENT_FIRM_NAMES],
    housingCapacityEnabled: true,
    transportEnabled: true,
    schedulesEnabled: true,
    sleepEnabled: true,
    cooperationMode: "mutual-aid",
    welfareMode: "combined",
    lifecycleEnabled: true,
    birthsEnabled: true,
    publicWorksEnabled,
  } as any);
  const initiallyUnemployed = new Set(town.people.filter((person: any) => person.alive && !person.isDependent && person.employer < 0).map((person: any) => person.id));
  let livingCitizenDays = 0;
  let fedCitizenDays = 0;
  let workforceCitizenDays = 0;
  let employedCitizenDays = 0;
  let dependentDays = 0;
  let dependentFoodDelivered = 0;
  let dependentHealthAttempts = 0;
  let dependentHealthFunded = 0;
  let extinctionDay: number | null = null;
  const trajectory: any[] = [];

  for (let elapsed = 0; elapsed < requestedDays && !town.isExtinct(); elapsed += 1) {
    for (let phase = 0; phase < PHASES.length; phase += 1) town.step();
    town.assertInvariants();
    const completedDay = town.day - 1;
    const living = town.people.filter((person: any) => person.alive);
    const workforce = living.filter((person: any) => !person.isDependent);
    const employed = workforce.filter((person: any) => person.employer >= 0);
    const dependents = living.filter((person: any) => person.isDependent);
    livingCitizenDays += living.length;
    fedCitizenDays += living.filter((person: any) => person.foodConsumedToday > 0).length;
    workforceCitizenDays += workforce.length;
    employedCitizenDays += employed.length;
    dependentDays += dependents.length;
    dependentFoodDelivered += dependents.filter((person: any) => person.foodConsumedToday > 0).length;
    dependents.forEach((person: any) => {
      if (person.dependentHealthPlan?.day !== completedDay) return;
      dependentHealthAttempts += 1;
      if (person.dependentHealthPlan.status === "completed") dependentHealthFunded += 1;
    });
    const civic = town.firms.find((firm: any) => firm.archetypeId === "public-works");
    trajectory.push({
      day: completedDay,
      alive: living.length,
      employed: employed.length,
      publicJobs: civic?.active ? civic.employees.length : 0,
      publicServiceUnits: civic?.publicServiceDeliveredToday ?? 0,
      publicServicePaid: civic?.publicServicePaidToday ?? 0,
      treasuryCash: round(town.government.cash),
      welfareEnvelope: round(town.welfareState.envelope),
      welfareSpent: round(town.welfareState.spent),
    });
    if (town.isExtinct()) extinctionDay = completedDay;
  }

  const civic = town.firms.find((firm: any) => firm.archetypeId === "public-works");
  const welfareRecords = town.people.flatMap((person: any) => person.welfareHistory);
  const deliveredWelfare = welfareRecords.filter((record: any) => record.outcome === "delivered");
  const firstWageRecipients = town.people.filter((person: any) => initiallyUnemployed.has(person.id) && person.ledger.some(
    (entry: any) => entry.amount > 0 && /wage from Morrow Civic Works/.test(entry.text),
  ));
  const firstWageDays = firstWageRecipients.flatMap((person: any) => person.ledger
    .filter((entry: any) => entry.amount > 0 && /wage from Morrow Civic Works/.test(entry.text))
    .map((entry: any) => entry.day));
  const serviceRecords = civic?.publicServiceHistory ?? [];
  const lifecycleRecords = town.people.flatMap((person: any) => person.lifecycleHistory);
  const finalCash = town.totalMoney();
  const cashDifference = round(finalCash - town.initialMoney);
  const cashConserved = Math.abs(cashDifference) <= 0.1;
  if (!cashConserved) throw new Error(`Public-works cash conservation failed for seed ${seed}, ${publicWorksEnabled ? "enabled" : "disabled"}: ${cashDifference}`);

  return {
    mode: publicWorksEnabled ? "public-works-enabled" : "public-works-disabled",
    requestedDays,
    completedDays: town.day - 1,
    jobs: {
      formed: Boolean(civic),
      formationDay: civic?.foundingDay ?? null,
      fundedJobs: civic?.initialStaff ?? 0,
      finalJobs: civic?.active ? civic.employees.length : 0,
      firstWageRecipients: firstWageRecipients.map((person: any) => person.id),
      firstWageDay: firstWageDays.length ? Math.min(...firstWageDays) : null,
      employmentRate: workforceCitizenDays ? round(employedCitizenDays / workforceCitizenDays) : 0,
    },
    publicService: {
      startupSpending: civic?.publicStartupCapital ?? 0,
      serviceSpending: sum(serviceRecords.map((record: any) => record.paid)),
      requestedUnits: sum(serviceRecords.map((record: any) => record.requestedUnits)),
      deliveredUnits: sum(serviceRecords.map((record: any) => record.deliveredUnits)),
      failedDays: serviceRecords.filter((record: any) => record.failureReason).length,
      closureDay: civic?.closedDay ?? null,
    },
    welfare: {
      deliveredPayments: deliveredWelfare.length,
      treasuryFlow: sum(deliveredWelfare.map((record: any) => record.treasuryContribution ?? 0)),
      exhaustedAssessments: welfareRecords.filter((record: any) => record.reason === "exhausted daily envelope").length,
    },
    food: {
      demandCitizenDays: livingCitizenDays,
      deliveredCitizenDays: fedCitizenDays,
      missedCitizenDays: livingCitizenDays - fedCitizenDays,
      deliveryRate: livingCitizenDays ? round(fedCitizenDays / livingCitizenDays) : 1,
    },
    dependentCare: {
      dependentDays,
      foodDelivered: dependentFoodDelivered,
      foodMissed: dependentDays - dependentFoodDelivered,
      healthAttempts: dependentHealthAttempts,
      healthFunded: dependentHealthFunded,
    },
    lifecycle: {
      births: town.people.filter((person: any) => person.birthDay !== null).length,
      maturations: lifecycleRecords.filter((record: any) => record.type === "maturation").length,
    },
    population: {
      alive: town.people.filter((person: any) => person.alive).length,
      deaths: town.people.filter((person: any) => !person.alive).length,
      extinct: town.isExtinct(),
      extinctionDay,
    },
    treasury: { finalCash: round(town.government.cash) },
    trajectory,
    cash: { initial: town.initialMoney, final: finalCash, difference: cashDifference, conserved: cashConserved },
  };
}

function compare(seed: number, disabled: any, enabled: any) {
  return {
    seed,
    disabled,
    enabled,
    delta: {
      fundedJobs: enabled.jobs.fundedJobs - disabled.jobs.fundedJobs,
      firstWageRecipients: enabled.jobs.firstWageRecipients.length - disabled.jobs.firstWageRecipients.length,
      employmentRate: round(enabled.jobs.employmentRate - disabled.jobs.employmentRate),
      publicSpending: round(enabled.publicService.startupSpending + enabled.publicService.serviceSpending),
      welfareFlow: round(enabled.welfare.treasuryFlow - disabled.welfare.treasuryFlow),
      welfareExhaustion: enabled.welfare.exhaustedAssessments - disabled.welfare.exhaustedAssessments,
      foodDeliveryRate: round(enabled.food.deliveryRate - disabled.food.deliveryRate),
      dependentFoodDelivered: enabled.dependentCare.foodDelivered - disabled.dependentCare.foodDelivered,
      dependentHealthFunded: enabled.dependentCare.healthFunded - disabled.dependentCare.healthFunded,
      maturations: enabled.lifecycle.maturations - disabled.lifecycle.maturations,
      deaths: enabled.population.deaths - disabled.population.deaths,
      extinctionDay: (enabled.population.extinctionDay ?? enabled.completedDays + 1) - (disabled.population.extinctionDay ?? disabled.completedDays + 1),
      treasuryCash: round(enabled.treasury.finalCash - disabled.treasury.finalCash),
    },
  };
}

export function evaluatePublicWorks(config: PublicWorksEvaluationConfig = { seeds: DEFAULT_PUBLIC_WORKS_EVALUATION_SEEDS, days: DEFAULT_PUBLIC_WORKS_EVALUATION_DAYS }) {
  if (!config.seeds.length || config.seeds.some((seed) => !Number.isInteger(seed))) throw new Error("At least one integer seed is required");
  if (!Number.isInteger(config.days) || config.days < 1) throw new Error("Public-works evaluation days must be a positive integer");
  const runs = config.seeds.map((seed) => {
    const disabled = runArm(seed, config.days, false);
    const enabled = runArm(seed, config.days, true);
    let deterministicReplay = config.replay !== false;
    if (deterministicReplay) {
      deterministicReplay = JSON.stringify({ disabled, enabled }) === JSON.stringify({
        disabled: runArm(seed, config.days, false),
        enabled: runArm(seed, config.days, true),
      });
      if (!deterministicReplay) throw new Error(`Deterministic public-works replay failed for seed ${seed}`);
    }
    return { ...compare(seed, disabled, enabled), deterministicReplay };
  });
  const technicalIntegrity = runs.every((run) => run.deterministicReplay && run.disabled.cash.conserved && run.enabled.cash.conserved);
  const earnedDemandImproved = sum(runs.map((run) => run.delta.firstWageRecipients)) > 0
    && sum(runs.map((run) => run.delta.employmentRate)) > 0;
  const survivalNotWorse = runs.every((run) => run.delta.deaths <= 0 && run.delta.extinctionDay >= 0);
  const careNotWorse = sum(runs.map((run) => run.delta.foodDeliveryRate)) >= 0
    && sum(runs.map((run) => run.delta.dependentFoodDelivered)) >= 0
    && sum(runs.map((run) => run.delta.dependentHealthFunded)) >= 0;
  const measuredImprovement = earnedDemandImproved && survivalNotWorse && careNotWorse;
  return {
    metadata: {
      schemaVersion: PUBLIC_WORKS_EVALUATION_SCHEMA_VERSION,
      simulation: "Morrow",
      seeds: [...config.seeds],
      requestedDays: config.days,
      phasesPerDay: PHASES.length,
      modes: ["public-works-disabled", "public-works-enabled"],
      stoppingRule: "Each arm stops on extinction; requestedDays remains recorded when completedDays is shorter.",
      welfareDisplacementDefinition: "Enabled minus disabled delivered treasury welfare and envelope-exhaustion assessments. This is a paired gameplay observation, not an isolated causal estimate.",
      activationRule: "Browser activation requires technical integrity, more first-wage reach and employment, no seed with more deaths or earlier extinction, and non-worse aggregate food and dependent-care delivery.",
      interpretation: "Fixed-seed gameplay evidence only. Values and gates are hypotheses, not empirical calibration, forecasts, or claims about public employment or welfare policy.",
    },
    status: technicalIntegrity ? "passed" : "failed",
    recommendation: technicalIntegrity && measuredImprovement ? "eligible-for-browser-review" : "keep-headless",
    gates: { technicalIntegrity, earnedDemandImproved, survivalNotWorse, careNotWorse, measuredImprovement },
    runs,
  } as const;
}

export function formatPublicWorksEvaluation(report: ReturnType<typeof evaluatePublicWorks>) {
  const lines = [`Morrow public works evaluation · ${report.metadata.seeds.length} seeds × 2 modes × ${report.metadata.requestedDays} days · ${report.status.toUpperCase()} · ${report.recommendation}`];
  report.runs.forEach((run) => lines.push(
    `seed ${run.seed}: jobs +${run.delta.fundedJobs}, first wages ${run.disabled.jobs.firstWageRecipients.length}→${run.enabled.jobs.firstWageRecipients.length}, employment ${(run.disabled.jobs.employmentRate * 100).toFixed(1)}%→${(run.enabled.jobs.employmentRate * 100).toFixed(1)}%, public spend ${run.delta.publicSpending.toFixed(1)}, welfare Δ${run.delta.welfareFlow.toFixed(1)}, food Δ${(run.delta.foodDeliveryRate * 100).toFixed(1)}pp, care meals Δ${run.delta.dependentFoodDelivered}, care health Δ${run.delta.dependentHealthFunded}, maturations Δ${run.delta.maturations}, deaths Δ${run.delta.deaths}, extinction Δ${run.delta.extinctionDay}d`,
  ));
  lines.push(`gates: integrity ${report.gates.technicalIntegrity ? "PASS" : "FAIL"} · earned demand ${report.gates.earnedDemandImproved ? "PASS" : "FAIL"} · survival ${report.gates.survivalNotWorse ? "PASS" : "FAIL"} · care ${report.gates.careNotWorse ? "PASS" : "FAIL"}`);
  lines.push(report.metadata.interpretation);
  return lines.join("\n");
}
