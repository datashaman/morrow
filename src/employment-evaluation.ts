import { DEFAULT_LATENT_FIRM_NAMES, PHASES } from "./config.js";
import { TownSimulation } from "./simulation.js";

export const EMPLOYMENT_EVALUATION_SCHEMA_VERSION = 4;
export const DEFAULT_EMPLOYMENT_EVALUATION_SEEDS = Object.freeze([20260823, 101, 202, 303, 404, 505]);
const CONTROL_FIRST_WAGES = Object.freeze([1, 1, 1, 1, 1, 0]);
const CONTROL_DEATHS = Object.freeze([40, 40, 22, 25, 22, 22]);

type EvaluationConfig = Readonly<{ seeds: readonly number[]; days: number }>;

const round = (value: number) => Math.round(value * 100) / 100;
const sum = (values: number[]) => round(values.reduce((total, value) => total + value, 0));

function recordsForDay(town: any, day: number) {
  const current = (records: any[]) => {
    const found = [];
    for (const record of records) {
      if (record.day < day) break;
      if (record.day === day) found.push(record);
    }
    return found;
  };
  const decisions = town.people.flatMap((person: any) => current(person.decisions));
  const events = town.people.flatMap((person: any) => current(person.events));
  const ledger = town.people.flatMap((person: any) => current(person.ledger));
  return { decisions, events, ledger };
}

function fundedSlots(town: any) {
  return town.firms.flatMap((firm: any) => firm.investmentSlots.map((slot: any) => ({
    id: slot.id,
    firmId: firm.id,
    firmInstanceId: firm.instanceId,
    firmName: firm.name,
    status: slot.status,
    approvalCount: slot.approvalCount,
    approvedDay: slot.approvedDay,
    recruitmentDeadline: slot.recruitmentDeadline,
    hiredCitizenId: slot.hiredCitizenId,
    hiredDay: slot.hiredDay,
    evaluationDeadline: slot.evaluationDeadline,
    endedDay: slot.endedDay,
    outcome: slot.outcome,
    expectedContribution: slot.expectedContribution,
    requiredContribution: slot.requiredContribution,
    fundingRequired: slot.fundingRequired,
    demandDays: [...slot.demandDays],
    attempts: slot.attempts.map((attempt: any) => ({ ...attempt, demandDays: [...attempt.demandDays] })),
  })));
}

function matureSlotIdsByDay(slots: any[], day: number) {
  return slots.filter((slot) => slot.attempts.some((attempt: any) => {
    const matureDay = attempt.approvedDay + 2;
    return matureDay <= day && (slot.endedDay === null || slot.endedDay >= matureDay);
  })).map((slot) => slot.id);
}

function formationJobIdsByDay(town: any, day: number) {
  return town.firms.filter((firm: any) => firm.foundingDay > 1 && firm.foundingDay <= day).flatMap((firm: any) => {
    const workers = firm.formationStaff ?? firm.initialStaff;
    return Array.from({ length: workers }, (_, index) => `${firm.instanceId}:formation:${index + 1}`);
  });
}

function fundedOpportunityIdsByDay(town: any, slots: any[], day: number) {
  return [...formationJobIdsByDay(town, day), ...matureSlotIdsByDay(slots, day)];
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function runArm(seed: number, days: number, enabled: boolean) {
  const town: any = new TownSimulation({
    seed,
    latentFirmNames: [...DEFAULT_LATENT_FIRM_NAMES],
    housingCapacityEnabled: true,
    transportEnabled: true,
    employmentInterventionEnabled: enabled,
  } as any);
  const initiallyUnemployedIds = town.people.filter((person: any) => person.employer < 0).map((person: any) => person.id);
  const initiallyUnemployed = new Set(initiallyUnemployedIds);
  const trajectory: any[] = [];

  for (let elapsed = 0; elapsed < days && !town.isExtinct(); elapsed += 1) {
    for (let phase = 0; phase < PHASES.length; phase += 1) town.step();
    town.assertInvariants();
    const completedDay = town.day - 1;
    const snapshot = town.snapshot();
    const { decisions, events, ledger } = recordsForDay(town, completedDay);
    const slots = fundedSlots(town);
    trajectory.push({
      day: completedDay,
      alive: snapshot.alive,
      workforceAdults: snapshot.workforceAdults,
      dead: snapshot.dead,
      employed: snapshot.employed,
      unemployed: snapshot.workforceAdults - snapshot.employed,
      vacancies: snapshot.positionsAvailable,
      fundedSlots: slots.length,
      matureFundedSlots: matureSlotIdsByDay(slots, completedDay).length,
      fundedOpportunities: fundedOpportunityIdsByDay(town, slots, completedDay).length,
      applications: decisions.filter((decision: any) => decision.kind === "job-search" && decision.chosenAction.startsWith("apply-job:")).length,
      offers: decisions.filter((decision: any) => decision.kind === "job-offer").length,
      hires: events.filter((event: any) => /^hired by /.test(event.text)).length,
      layoffs: events.filter((event: any) => /ended employment|eliminated a position/.test(event.text)).length,
      wages: sum(ledger.filter((entry: any) => /wage from /.test(entry.text)).map((entry: any) => entry.amount)),
      support: sum(ledger.filter((entry: any) => /support from treasury/.test(entry.text)).map((entry: any) => entry.amount)),
      hungerEvents: events.filter((event: any) => /missed food|starv|hunger/.test(event.text)).length,
      housingEvents: events.filter((event: any) => /rent|evict|housing|unhoused/.test(event.text)).length,
      healthEvents: events.filter((event: any) => /health|treatment|clinical|medicine/.test(event.text)).length,
      deaths: events.filter((event: any) => /^died /.test(event.text)).length,
    });
  }

  const wageRecipients = town.people.filter((person: any) => initiallyUnemployed.has(person.id) && person.ledger.some(
    (entry: any) => entry.day <= 30 && entry.amount > 0 && /wage from /.test(entry.text),
  ));
  const slots = fundedSlots(town);
  const formations = town.firms.filter((firm: any) => firm.foundingDay > 1).map((firm: any) => ({
    firmId: firm.id,
    instanceId: firm.instanceId,
    name: firm.name,
    day: firm.foundingDay,
    founderId: firm.owner,
    workers: firm.formationObservedDays === undefined ? null : (firm.formationStaff ?? firm.initialStaff),
  }));
  const closures = town.firms.filter((firm: any) => firm.closedDay !== null).map((firm: any) => ({
    firmId: firm.id,
    instanceId: firm.instanceId,
    name: firm.name,
    day: firm.closedDay,
    status: firm.status,
  }));
  const totals = {
    applications: trajectory.reduce((total, day) => total + day.applications, 0),
    offers: trajectory.reduce((total, day) => total + day.offers, 0),
    hires: trajectory.reduce((total, day) => total + day.hires, 0),
    layoffs: trajectory.reduce((total, day) => total + day.layoffs, 0),
    wages: sum(trajectory.map((day) => day.wages)),
    support: sum(trajectory.map((day) => day.support)),
    hungerEvents: trajectory.reduce((total, day) => total + day.hungerEvents, 0),
    housingEvents: trajectory.reduce((total, day) => total + day.housingEvents, 0),
    healthEvents: trajectory.reduce((total, day) => total + day.healthEvents, 0),
    deaths: trajectory.reduce((total, day) => total + day.deaths, 0),
  };
  return {
    enabled,
    initiallyUnemployedIds,
    trajectory,
    fundedSlots: slots,
    matureFundedSlotIdsByDay7: matureSlotIdsByDay(slots, 7),
    fundedOpportunityIdsByDay7: fundedOpportunityIdsByDay(town, slots, 7),
    formations,
    closures,
    firstWageCitizenIds: wageRecipients.map((person: any) => person.id),
    firstWagesByDay30: wageRecipients.length,
    deathsByDay60: trajectory.find((day) => day.day === 60)?.dead ?? trajectory.at(-1)?.dead ?? 0,
    totals,
    cash: {
      initial: town.initialMoney,
      final: town.totalMoney(),
      conserved: Math.abs(town.totalMoney() - town.initialMoney) <= 0.1,
    },
  };
}

function fixtureForSeeds(seeds: readonly number[], fixture: readonly number[]) {
  const values = seeds.map((seed) => {
    const index = DEFAULT_EMPLOYMENT_EVALUATION_SEEDS.indexOf(seed);
    return index < 0 ? null : fixture[index];
  });
  return values.every((value) => value !== null) ? values : null;
}

export function evaluateEmploymentIntervention(config: EvaluationConfig) {
  if (!config.seeds.length || config.seeds.some((seed) => !Number.isInteger(seed))) throw new Error("At least one integer seed is required");
  if (!Number.isInteger(config.days) || config.days < 1) throw new Error("Evaluation days must be a positive integer");
  if (config.days < 60) throw new Error("Employment evaluation requires at least 60 completed days");
  const runs = config.seeds.map((seed) => ({
    seed,
    control: runArm(seed, config.days, false),
    treatment: runArm(seed, config.days, true),
  }));
  const expectedFirstWages = fixtureForSeeds(config.seeds, CONTROL_FIRST_WAGES);
  const expectedDeaths = fixtureForSeeds(config.seeds, CONTROL_DEATHS);
  const controlBaseline = {
    firstWages: {
      expected: expectedFirstWages,
      observed: runs.map((run) => run.control.firstWagesByDay30),
      matches: expectedFirstWages === null ? null : runs.every((run, index) => run.control.firstWagesByDay30 === expectedFirstWages[index]),
    },
    deaths: {
      expected: expectedDeaths,
      observed: runs.map((run) => run.control.deathsByDay60),
      matches: expectedDeaths === null ? null : runs.every((run, index) => run.control.deathsByDay60 === expectedDeaths[index]),
    },
  };
  const fundedOpportunitiesByDay7 = {
    minimumPerSeed: 1,
    minimumTotal: 2 * runs.length,
    observed: runs.map((run) => run.treatment.fundedOpportunityIdsByDay7.length),
    total: runs.reduce((total, run) => total + run.treatment.fundedOpportunityIdsByDay7.length, 0),
    passed: runs.every((run) => run.treatment.fundedOpportunityIdsByDay7.length >= 1)
      && runs.reduce((total, run) => total + run.treatment.fundedOpportunityIdsByDay7.length, 0) >= 2 * runs.length,
  };
  const firstWageValues = runs.map((run) => run.treatment.firstWagesByDay30);
  const wageImprovements = runs.filter((run) => run.treatment.firstWagesByDay30 > run.control.firstWagesByDay30).length;
  const firstWagesByDay30 = {
    minimumMedian: 4,
    minimumSeedsAtOrAboveThree: Math.min(5, runs.length),
    minimumImprovedSeeds: Math.min(5, runs.length),
    observed: firstWageValues,
    median: median(firstWageValues),
    seedsAtOrAboveThree: firstWageValues.filter((value) => value >= 3).length,
    improvedSeeds: wageImprovements,
    passed: median(firstWageValues) >= 4
      && firstWageValues.filter((value) => value >= 3).length >= Math.min(5, runs.length)
      && wageImprovements >= Math.min(5, runs.length),
  };
  const deathDeltas = runs.map((run) => run.treatment.deathsByDay60 - run.control.deathsByDay60);
  const mortality = {
    maximumTreatmentToControlRatio: 0.91,
    treatmentTotal: runs.reduce((total, run) => total + run.treatment.deathsByDay60, 0),
    controlTotal: runs.reduce((total, run) => total + run.control.deathsByDay60, 0),
    improvedSeeds: deathDeltas.filter((delta) => delta < 0).length,
    minimumImprovedSeeds: Math.min(4, runs.length),
    maximumPerSeedRegression: 2,
    deltas: deathDeltas,
    passed: runs.reduce((total, run) => total + run.treatment.deathsByDay60, 0)
      <= runs.reduce((total, run) => total + run.control.deathsByDay60, 0) * 0.91
      && deathDeltas.filter((delta) => delta < 0).length >= Math.min(4, runs.length)
      && deathDeltas.every((delta) => delta <= 2),
  };
  const criteria = {
    controlBaseline: controlBaseline.firstWages.matches !== false && controlBaseline.deaths.matches !== false,
    fundedOpportunitiesByDay7: fundedOpportunitiesByDay7.passed,
    firstWagesByDay30: firstWagesByDay30.passed,
    mortality: mortality.passed,
  };
  return {
    metadata: {
      schemaVersion: EMPLOYMENT_EVALUATION_SCHEMA_VERSION,
      simulation: "Morrow",
      seeds: [...config.seeds],
      days: config.days,
      phasesPerDay: PHASES.length,
      control: "employment intervention disabled: legacy staffing and seven-day formation",
      treatment: "investment hiring and accelerated viable formation enabled",
      interpretation: "Deterministic gameplay comparison only. Thresholds are design hypotheses, not empirical calibration or causal evidence about real employment and mortality.",
    },
    status: Object.values(criteria).every(Boolean) ? "passed" : "failed",
    controlBaseline,
    gates: { fundedOpportunitiesByDay7, firstWagesByDay30, mortality },
    criteria,
    runs,
  } as const;
}

export function formatEmploymentEvaluation(report: ReturnType<typeof evaluateEmploymentIntervention>) {
  const lines = [
    `Morrow employment intervention · ${report.metadata.seeds.length} paired seeds × ${report.metadata.days} completed days · ${report.status.toUpperCase()}`,
    `control: wages D30 ${report.controlBaseline.firstWages.observed.join(", ")} · deaths D60 ${report.controlBaseline.deaths.observed.join(", ")}`,
  ];
  report.runs.forEach((run) => lines.push(
    `seed ${run.seed}: funded jobs D7 ${run.treatment.fundedOpportunityIdsByDay7.length} · first wages D30 ${run.control.firstWagesByDay30}→${run.treatment.firstWagesByDay30} · deaths D60 ${run.control.deathsByDay60}→${run.treatment.deathsByDay60}`,
  ));
  lines.push(
    `gates: funded jobs ${report.gates.fundedOpportunitiesByDay7.passed ? "PASS" : "FAIL"} · wages ${report.gates.firstWagesByDay30.passed ? "PASS" : "FAIL"} · mortality ${report.gates.mortality.passed ? "PASS" : "FAIL"}`,
    report.metadata.interpretation,
  );
  return lines.join("\n");
}
