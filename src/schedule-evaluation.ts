import { DEFAULT_LATENT_FIRM_NAMES, PHASES } from "./config.js";
import { TownSimulation } from "./simulation.js";

export const SCHEDULE_EVALUATION_SCHEMA_VERSION = 1;
export const DEFAULT_SCHEDULE_EVALUATION_SEEDS = Object.freeze([20260823, 101, 202, 303, 404, 505]);

export const SCHEDULE_MODES = Object.freeze([
  { id: "compatibility-calendar-only", schedulesEnabled: false, sleepEnabled: false },
  { id: "schedules-without-sleep", schedulesEnabled: true, sleepEnabled: false },
  { id: "schedules-plus-sleep", schedulesEnabled: true, sleepEnabled: true },
]);

type ScheduleEvaluationConfig = Readonly<{ seeds: readonly number[]; days: number }>;

const round = (value: number) => Math.round(value * 1000) / 1000;
const sum = (values: number[]) => round(values.reduce((total, value) => total + value, 0));
const mean = (values: number[]) => values.length ? round(values.reduce((total, value) => total + value, 0) / values.length) : 0;

function allEvents(town: any) {
  return [...town.people, ...town.firms].flatMap((actor: any) => actor.events);
}

function allDecisions(town: any) {
  return town.people.flatMap((person: any) => person.decisions);
}

function runMode(seed: number, days: number, mode: (typeof SCHEDULE_MODES)[number]) {
  const town: any = new TownSimulation({
    seed,
    latentFirmNames: [...DEFAULT_LATENT_FIRM_NAMES],
    housingCapacityEnabled: true,
    transportEnabled: true,
    schedulesEnabled: mode.schedulesEnabled,
    sleepEnabled: mode.sleepEnabled,
  } as any);
  const trajectory: any[] = [];
  for (let elapsed = 0; elapsed < days && !town.isExtinct(); elapsed += 1) {
    for (let phase = 0; phase < PHASES.length; phase += 1) town.step();
    town.assertInvariants();
    const living = town.people.filter((person: any) => person.alive);
    trajectory.push({
      day: town.day - 1,
      alive: living.length,
      employed: living.filter((person: any) => person.employer >= 0).length,
      hungry: living.filter((person: any) => person.hungryDays > 0).length,
      unhoused: living.filter((person: any) => !person.housed).length,
      meanHealth: mean(living.map((person: any) => person.health)),
      meanSleepDebt: mean(living.map((person: any) => person.sleepDebt)),
    });
  }
  const living = town.people.filter((person: any) => person.alive);
  const decisions = allDecisions(town);
  const events = allEvents(town);
  const wages = town.people.flatMap((person: any) => person.ledger).filter((entry: any) => /wage from /.test(entry.text));
  const sleepRecords = town.people.flatMap((person: any) => person.sleepHistory);
  const personal = decisions.filter((decision: any) => decision.kind === "personal-time");
  const workday = decisions.filter((decision: any) => decision.kind === "workday-plan");
  const foodWaste = [...town.people, ...town.firms].flatMap((actor: any) => actor.wasteHistory)
    .filter((record: any) => ["produce", "budgetFood", "premiumFood", "cafeService"].includes(record.product));
  const closureFailures = events.filter((event: any) => /closed|next opening|next shared opening/.test(event.text)).length;
  const capacityFailures = events.filter((event: any) => /staffed capacity|no attending workers|could not serve/.test(event.text)).length;
  const stockFailures = events.filter((event: any) => /no .* stock|no food stock|inventory/.test(event.text)).length;
  const affordabilityFailures = events.filter((event: any) => /afford|price-sensitive|could not fund/.test(event.text)).length;
  const initial = town.initialMoney;
  const final = town.totalMoney();
  const formations = town.firms.filter((firm: any) => firm.foundingDay > 1);
  const failures = town.firms.filter((firm: any) => firm.closedDay !== null);
  return {
    mode: mode.id,
    completedDays: town.day - 1,
    trajectory,
    access: { closureFailures, capacityFailures, stockFailures, affordabilityFailures },
    work: {
      scheduledShifts: workday.filter((decision: any) => decision.observation.scheduled).length,
      attendedShifts: workday.filter((decision: any) => decision.chosenAction.startsWith("work-shift:")).length,
      wagePayments: wages.length,
      wagesPaid: sum(wages.map((entry: any) => entry.amount)),
      employed: living.filter((person: any) => person.employer >= 0).length,
    },
    activity: {
      personalPrimaries: personal.length,
      parkVisits: personal.filter((decision: any) => decision.chosenAction === "do-nothing" && decision.observation.freeActivity === "park-social").length,
      rests: personal.filter((decision: any) => decision.chosenAction === "do-nothing" && decision.observation.freeActivity === "rest").length
        + workday.filter((decision: any) => decision.chosenAction === "daytime-rest").length,
      selfStudy: personal.filter((decision: any) => decision.chosenAction === "do-nothing" && decision.observation.freeActivity === "self-study").length
        + workday.filter((decision: any) => decision.chosenAction === "self-study").length,
      learningRecords: town.people.reduce((total: number, person: any) => total + person.learningHistory.length, 0),
    },
    sleep: {
      nights: sleepRecords.length,
      lateStudy: sleepRecords.filter((record: any) => record.action === "late-self-study").length,
      meanQuality: mean(sleepRecords.map((record: any) => record.sleepQuality).filter((quality: any) => quality !== null)),
      meanFinalDebt: mean(living.map((person: any) => person.sleepDebt)),
      peakFinalDebt: living.reduce((peak: number, person: any) => Math.max(peak, person.sleepDebt), 0),
    },
    food: {
      wasteUnits: sum(foodWaste.map((record: any) => record.quantity)),
      hungerEvents: events.filter((event: any) => /missed food|food sellers were closed|no food stock/.test(event.text)).length,
      hungry: living.filter((person: any) => person.hungryDays > 0).length,
    },
    population: {
      alive: living.length,
      deaths: town.people.length - living.length,
      meanLivingHealth: mean(living.map((person: any) => person.health)),
      unhoused: living.filter((person: any) => !person.housed).length,
    },
    business: { formations: formations.length, failures: failures.length, activeFirms: town.firms.filter((firm: any) => firm.active).length },
    cash: { initial, final, conserved: Math.abs(final - initial) <= 0.1 },
  };
}

function delta(left: any, right: any) {
  return {
    alive: right.population.alive - left.population.alive,
    deaths: right.population.deaths - left.population.deaths,
    employed: right.work.employed - left.work.employed,
    hungry: right.food.hungry - left.food.hungry,
    unhoused: right.population.unhoused - left.population.unhoused,
    meanHealth: round(right.population.meanLivingHealth - left.population.meanLivingHealth),
    wagesPaid: round(right.work.wagesPaid - left.work.wagesPaid),
    closureFailures: right.access.closureFailures - left.access.closureFailures,
    foodWaste: round(right.food.wasteUnits - left.food.wasteUnits),
    formations: right.business.formations - left.business.formations,
    firmFailures: right.business.failures - left.business.failures,
    meanSleepDebt: round(right.sleep.meanFinalDebt - left.sleep.meanFinalDebt),
  };
}

export function evaluateSchedules(config: ScheduleEvaluationConfig) {
  if (!config.seeds.length || config.seeds.some((seed) => !Number.isInteger(seed))) throw new Error("At least one integer seed is required");
  if (!Number.isInteger(config.days) || config.days < 1) throw new Error("Schedule evaluation days must be a positive integer");
  const runs = config.seeds.map((seed) => {
    const modes = SCHEDULE_MODES.map((mode) => runMode(seed, config.days, mode));
    if (modes.some((mode) => !mode.cash.conserved)) throw new Error(`Cash conservation failed for seed ${seed}`);
    return {
      seed,
      modes,
      deltas: {
        schedulesVsCompatibility: delta(modes[0], modes[1]),
        sleepVsSchedules: delta(modes[1], modes[2]),
      },
    };
  });
  return {
    metadata: {
      schemaVersion: SCHEDULE_EVALUATION_SCHEMA_VERSION,
      simulation: "Morrow",
      seeds: [...config.seeds],
      days: config.days,
      phasesPerDay: PHASES.length,
      modes: SCHEDULE_MODES.map((mode) => mode.id),
      invariantChecks: "cash conservation and simulation invariants checked after every completed day in all three modes",
      interpretation: "Deterministic gameplay comparison only. Deltas are causal evidence for these configured rules, not empirical calibration, forecast, or policy evidence.",
    },
    status: "passed",
    runs,
  } as const;
}

export function formatScheduleEvaluation(report: ReturnType<typeof evaluateSchedules>) {
  const lines = [`Morrow schedule evaluation · ${report.metadata.seeds.length} seeds × 3 modes × ${report.metadata.days} days · ${report.status.toUpperCase()}`];
  report.runs.forEach((run) => {
    const [compatibility, schedules, sleep] = run.modes;
    lines.push(`seed ${run.seed}: alive ${compatibility.population.alive}→${schedules.population.alive}→${sleep.population.alive} · employed ${compatibility.work.employed}→${schedules.work.employed}→${sleep.work.employed} · hungry ${compatibility.food.hungry}→${schedules.food.hungry}→${sleep.food.hungry} · sleep debt ${sleep.sleep.meanFinalDebt} · waste ${compatibility.food.wasteUnits}→${schedules.food.wasteUnits}→${sleep.food.wasteUnits}`);
  });
  lines.push(report.metadata.interpretation);
  return lines.join("\n");
}
