import { DEFAULT_LATENT_FIRM_NAMES, LIFECYCLE_STAGES, LIFECYCLE_STAGE_START_DAYS, PHASES } from "./config.js";
import { calendarForDay } from "./civil-time.js";
import { MotivationCitizenPolicy } from "./citizen-policy.js";
import { TownSimulation } from "./simulation.js";

export const LIFECYCLE_EVALUATION_SCHEMA_VERSION = 2;
export const DEFAULT_LIFECYCLE_EVALUATION_SEEDS = Object.freeze([101, 202, 303, 404, 505]);
export const DEFAULT_LIFECYCLE_EVALUATION_DAYS = 504;
export const LIFECYCLE_EVALUATION_MODES = Object.freeze([
  { id: "full-lifecycle", birthsEnabled: true },
  { id: "births-disabled", birthsEnabled: false },
]);

type LifecycleEvaluationConfig = Readonly<{ seeds: readonly number[]; days: number; replay?: boolean }>;

const round = (value: number) => Math.round(value * 1000) / 1000;
const sum = (values: number[]) => round(values.reduce((total, value) => total + value, 0));
const stageCounts = (town: any) => Object.fromEntries(LIFECYCLE_STAGES.map((stage) => [stage, town.people.filter((person: any) => person.alive && person.lifecycleStage === stage).length]));

function eligibleBirthPartnerships(town: any) {
  if (calendarForDay(town.day).weekdayIndex !== 0) return 0;
  return town.people.filter((person: any) => {
    if (!person.alive || person.partnerId === null || person.id >= person.partnerId) return false;
    const partner = town.people[person.partnerId];
    if (!partner?.alive || town.activeGestationFor(person.id) || town.activeGestationFor(partner.id)) return false;
    const lastBirth = town.lastBirthDays[town.pairKey(person.id, partner.id)];
    return lastBirth === undefined || town.day - lastBirth >= 84;
  }).length;
}

function runMode(seed: number, requestedDays: number, mode: (typeof LIFECYCLE_EVALUATION_MODES)[number]) {
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
    birthsEnabled: mode.birthsEnabled,
  } as any);
  let eligiblePartnershipOpportunities = 0;
  let dependentDays = 0;
  let dependentFoodDelivered = 0;
  let dependentFoodMissed = 0;
  let dependentHealthAttempts = 0;
  let dependentHealthFunded = 0;
  let dependentHealthFailed = 0;
  let livingCitizenDays = 0;
  let workforceCitizenDays = 0;
  let employedCitizenDays = 0;
  let unhousedCitizenDays = 0;
  let peakPopulation = town.people.filter((person: any) => person.alive).length;
  let peakDependencyRatio = 0;
  let peakHousingPressure = 0;
  let extinctionDay: number | null = null;
  const trajectory: any[] = [];

  for (let elapsed = 0; elapsed < requestedDays && !town.isExtinct(); elapsed += 1) {
    if (mode.birthsEnabled) eligiblePartnershipOpportunities += eligibleBirthPartnerships(town);
    for (let phase = 0; phase < PHASES.length; phase += 1) town.step();
    town.assertInvariants();
    const completedDay = town.day - 1;
    const living = town.people.filter((person: any) => person.alive);
    const dependents = living.filter((person: any) => person.isDependent);
    const workforce = living.filter((person: any) => !person.isDependent);
    const employed = workforce.filter((person: any) => person.employer >= 0);
    const capacity = town.firms.find((firm: any) => firm.sector === "housing")?.dwellingCapacity ?? 0;
    const occupancy = town.housingOccupancy();
    const dependencyRatio = workforce.length ? dependents.length / workforce.length : dependents.length ? Infinity : 0;
    const finiteDependencyRatio = Number.isFinite(dependencyRatio) ? dependencyRatio : dependents.length;
    dependentDays += dependents.length;
    dependentFoodDelivered += dependents.filter((person: any) => person.foodConsumedToday > 0).length;
    dependentFoodMissed += dependents.filter((person: any) => person.foodConsumedToday === 0).length;
    dependents.forEach((person: any) => {
      if (person.dependentHealthPlan?.day !== completedDay) return;
      dependentHealthAttempts += 1;
      if (person.dependentHealthPlan.status === "completed") dependentHealthFunded += 1;
      else dependentHealthFailed += 1;
    });
    livingCitizenDays += living.length;
    workforceCitizenDays += workforce.length;
    employedCitizenDays += employed.length;
    unhousedCitizenDays += living.filter((person: any) => !person.housed).length;
    peakPopulation = Math.max(peakPopulation, living.length);
    peakDependencyRatio = Math.max(peakDependencyRatio, finiteDependencyRatio);
    peakHousingPressure = Math.max(peakHousingPressure, capacity ? occupancy / capacity : occupancy ? 1 : 0);
    trajectory.push({ day: completedDay, population: living.length, stages: stageCounts(town), dependencyRatio: round(finiteDependencyRatio), employed: employed.length, unhoused: living.filter((person: any) => !person.housed).length });
    if (town.isExtinct()) extinctionDay = completedDay;
  }

  const lifecycleRecords = town.people.flatMap((person: any) => person.lifecycleHistory);
  const schoolRecords = town.people.flatMap((person: any) => person.schoolHistory).filter((record: any) => record.scheduled);
  const welfareRecords = town.people.flatMap((person: any) => person.welfareHistory).filter((record: any) => record.outcome === "delivered");
  const legacySupport = town.people.flatMap((person: any) => person.ledger).filter((entry: any) => entry.direction === "in" && entry.text === "support from treasury");
  const living = town.people.filter((person: any) => person.alive);
  const workforce = living.filter((person: any) => !person.isDependent);
  const finalCash = town.totalMoney();
  const cashDifference = round(finalCash - town.initialMoney);
  const cashConserved = Math.abs(cashDifference) <= 0.1;
  if (!cashConserved) throw new Error(`Lifecycle cash conservation failed for seed ${seed}, mode ${mode.id}: ${cashDifference}`);
  return {
    mode: mode.id,
    requestedDays,
    completedDays: town.day - 1,
    stoppedOnExtinction: extinctionDay !== null,
    extinctionDay,
    trajectory,
    reproduction: {
      eligiblePartnershipOpportunities,
      attempts: town.birthAttemptHistory.length,
      conceptions: town.birthAttemptHistory.filter((attempt: any) => attempt.conceived).length,
      births: town.people.filter((person: any) => person.birthDay !== null).length,
      activeGestations: town.gestations.filter((gestation: any) => gestation.status === "active").length,
    },
    population: {
      initial: 40,
      final: living.length,
      totalCitizens: town.people.length,
      stages: stageCounts(town),
      peak: peakPopulation,
      deaths: town.people.filter((person: any) => !person.alive).length,
      extinction: town.isExtinct(),
      dependencyRatio: workforce.length ? round(living.filter((person: any) => person.isDependent).length / workforce.length) : living.some((person: any) => person.isDependent) ? null : 0,
      peakDependencyRatio: round(peakDependencyRatio),
    },
    care: {
      dependentDays,
      foodDemand: dependentDays,
      foodDelivered: dependentFoodDelivered,
      foodMissed: dependentFoodMissed,
      healthAttempts: dependentHealthAttempts,
      healthFunded: dependentHealthFunded,
      healthFailed: dependentHealthFailed,
    },
    housing: { unhousedCitizenDays, peakPressure: round(peakHousingPressure), finalOccupancy: town.housingOccupancy(), finalCapacity: town.firms.find((firm: any) => firm.sector === "housing")?.dwellingCapacity ?? 0 },
    school: { demand: schoolRecords.length, fundedLessons: schoolRecords.filter((record: any) => record.outcome === "attended").length, missedLessons: schoolRecords.filter((record: any) => record.outcome !== "attended").length },
    workforce: {
      maturations: lifecycleRecords.filter((record: any) => record.type === "maturation").length,
      entriesEmployedAtEnd: town.people.filter((person: any) => person.lifecycleHistory.some((record: any) => record.type === "maturation") && person.alive && person.employer >= 0).length,
      finalAdults: workforce.length,
      finalEmployed: workforce.filter((person: any) => person.employer >= 0).length,
      employmentRate: workforceCitizenDays ? round(employedCitizenDays / workforceCitizenDays) : 0,
    },
    treasury: {
      supportPayments: legacySupport.length + welfareRecords.length,
      supportFlow: sum(legacySupport.map((entry: any) => entry.amount)) + sum(welfareRecords.map((record: any) => record.treasuryContribution ?? 0)),
      estateDutyFlow: sum(town.people.map((person: any) => person.estateDutyPaid ?? 0)),
      finalCash: town.government.cash,
    },
    firms: { failures: town.firms.filter((firm: any) => firm.closedDay !== null).length, active: town.firms.filter((firm: any) => firm.active).length },
    cash: { initial: town.initialMoney, final: finalCash, difference: cashDifference, conserved: cashConserved },
  };
}

export function evaluateLifecycle(config: LifecycleEvaluationConfig = { seeds: DEFAULT_LIFECYCLE_EVALUATION_SEEDS, days: DEFAULT_LIFECYCLE_EVALUATION_DAYS }) {
  if (!config.seeds.length || config.seeds.some((seed) => !Number.isInteger(seed))) throw new Error("At least one integer seed is required");
  if (!Number.isInteger(config.days) || config.days < 1) throw new Error("Lifecycle evaluation days must be a positive integer");
  const runs = config.seeds.map((seed) => {
    const modes = LIFECYCLE_EVALUATION_MODES.map((mode) => runMode(seed, config.days, mode));
    if (config.replay !== false) {
      const replay = LIFECYCLE_EVALUATION_MODES.map((mode) => runMode(seed, config.days, mode));
      if (JSON.stringify(modes) !== JSON.stringify(replay)) throw new Error(`Deterministic lifecycle replay failed for seed ${seed}`);
    }
    return { seed, deterministicReplay: config.replay !== false, modes };
  });
  const fullLifecycleModes = runs.map((run) => run.modes.find((mode) => mode.mode === "full-lifecycle")!);
  const minimumCompletedDays = LIFECYCLE_STAGE_START_DAYS.adult;
  const foodDemand = fullLifecycleModes.reduce((total, mode) => total + mode.care.foodDemand, 0);
  const foodDelivered = fullLifecycleModes.reduce((total, mode) => total + mode.care.foodDelivered, 0);
  const healthAttempts = fullLifecycleModes.reduce((total, mode) => total + mode.care.healthAttempts, 0);
  const healthFunded = fullLifecycleModes.reduce((total, mode) => total + mode.care.healthFunded, 0);
  const technicalIntegrity = {
    deterministicReplayRequired: config.replay !== false,
    deterministicRuns: runs.filter((run) => run.deterministicReplay).length,
    cashConservedRuns: runs.flatMap((run) => run.modes).filter((mode) => mode.cash.conserved).length,
    totalModeRuns: runs.length * LIFECYCLE_EVALUATION_MODES.length,
    passed: config.replay !== false
      && runs.every((run) => run.deterministicReplay)
      && runs.flatMap((run) => run.modes).every((mode) => mode.cash.conserved),
  };
  const lifecycleReach = {
    minimumCompletedDays,
    runsReachingMinimum: fullLifecycleModes.filter((mode) => mode.completedDays >= minimumCompletedDays).length,
    requiredRuns: fullLifecycleModes.length,
    maturations: fullLifecycleModes.reduce((total, mode) => total + mode.workforce.maturations, 0),
    passed: fullLifecycleModes.every((mode) => mode.completedDays >= minimumCompletedDays)
      && fullLifecycleModes.reduce((total, mode) => total + mode.workforce.maturations, 0) > 0,
  };
  const dependentEssentials = {
    minimumFoodDeliveryRate: 0.75,
    foodDemand,
    foodDelivered,
    foodDeliveryRate: foodDemand ? round(foodDelivered / foodDemand) : 1,
    healthAttempts,
    healthFunded,
    passed: (!foodDemand || foodDelivered / foodDemand >= 0.75)
      && (!healthAttempts || healthFunded > 0),
  };
  const gates = { technicalIntegrity, lifecycleReach, dependentEssentials };
  return {
    metadata: {
      schemaVersion: LIFECYCLE_EVALUATION_SCHEMA_VERSION,
      simulation: "Morrow",
      seeds: [...config.seeds],
      requestedDays: config.days,
      phasesPerDay: PHASES.length,
      modes: LIFECYCLE_EVALUATION_MODES.map((mode) => mode.id),
      initialPopulation: 40,
      stoppingRule: "Each run stops on extinction; requestedDays remains recorded even when completedDays is shorter.",
      definitions: {
        eligiblePartnershipOpportunities: "Weekly partnered pairs not in gestation and outside the birth-spacing cooldown before their birth decision.",
        foodDemand: "Living dependent citizen-days; delivery and misses are observed after each completed day.",
        healthCare: "Planned dependent health episodes, split by completed versus failed status.",
        schoolDemand: "Scheduled dependent lesson records, split by attended versus every non-attended outcome.",
      },
      invariantChecks: "Simulation invariants run after every completed day; any lost or created cash is a hard failure.",
      activationCriteria: "Activation additionally requires deterministic replay, conserved cash, every full-lifecycle seed to reach the 168-day adult threshold, at least one observed maturation, at least 75% aggregate dependent meal delivery, and at least one completed dependent health episode when care is attempted.",
      interpretation: "Bounded deterministic gameplay observations for the configured 504-day horizon. They are not empirical or demographic validation, calibration, forecasts, or claims about real families, fertility, care, education, welfare, or population dynamics.",
    },
    status: Object.values(gates).every((gate) => gate.passed) ? "passed" : "failed",
    gates,
    runs,
  } as const;
}

export function formatLifecycleEvaluation(report: ReturnType<typeof evaluateLifecycle>) {
  const lines = [`Morrow lifecycle evaluation · ${report.metadata.seeds.length} seeds × 2 modes × ${report.metadata.requestedDays} requested days · ${report.status.toUpperCase()}`];
  report.runs.forEach((run) => {
    lines.push(`seed ${run.seed}: ${run.modes.map((mode) => `${mode.mode} ${mode.completedDays}d, ${mode.reproduction.births} births, ${mode.population.final} alive, dependency ${mode.population.dependencyRatio ?? "∞"}, ${mode.school.fundedLessons}/${mode.school.demand} lessons, ${mode.firms.failures} firm failures`).join(" → ")}`);
  });
  lines.push(`gates: integrity ${report.gates.technicalIntegrity.passed ? "PASS" : "FAIL"} · lifecycle reach ${report.gates.lifecycleReach.passed ? "PASS" : "FAIL"} · dependent essentials ${report.gates.dependentEssentials.passed ? "PASS" : "FAIL"}`);
  lines.push(report.metadata.interpretation);
  return lines.join("\n");
}
