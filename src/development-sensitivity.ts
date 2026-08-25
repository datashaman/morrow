import { DEFAULT_LATENT_FIRM_NAMES, PHASES } from "./config.js";
import { TownSimulation } from "./simulation.js";

export const DEVELOPMENT_SENSITIVITY_SCHEMA_VERSION = 1;
type Scenario = Readonly<{ id: string; policy: Readonly<Record<string, number>> }>;
type DevelopmentConfig = Readonly<{ seeds: readonly number[]; days: number; scenarios?: readonly Scenario[] }>;

const defaultDevelopmentScenarios: Scenario[] = [
  { id: "low-demand", policy: { discretionaryDemand: 20 } },
  { id: "baseline", policy: {} },
  { id: "high-demand", policy: { discretionaryDemand: 80 } },
  { id: "low-support", policy: { supportRate: 10 } },
  { id: "high-shock", policy: { shockRisk: 40 } },
  { id: "high-wage", policy: { minimumWage: 10 } },
];
export const DEFAULT_DEVELOPMENT_SCENARIOS: readonly Scenario[] = Object.freeze(defaultDevelopmentScenarios);

const round = (value: number) => Math.round(value * 1000) / 1000;

function evaluateDevelopmentRun(seed: number, days: number, scenario: Scenario) {
  const town: any = new TownSimulation({ seed, policy: scenario.policy, latentFirmNames: [...DEFAULT_LATENT_FIRM_NAMES], housingCapacityEnabled: true } as any);
  const initialStage = town.snapshot().townStage;
  const stageTransitions: any[] = [];
  let previousStage = initialStage;

  for (let elapsed = 0; elapsed < days && !town.isExtinct(); elapsed += 1) {
    for (let phase = 0; phase < PHASES.length; phase += 1) town.step();
    const stage = town.snapshot().townStage;
    if (stage.id !== previousStage.id) {
      stageTransitions.push({ day: town.day, from: previousStage.id, to: stage.id, evidence: stage.evidence });
      previousStage = stage;
    }
  }

  town.assertInvariants();
  const final = town.snapshot();
  const optionalInstances = town.firms.filter((firm: any) => ["cafe", "premium-grocer"].includes(firm.archetypeId));
  const openings = optionalInstances.map((firm: any) => ({
    archetypeId: firm.archetypeId,
    instanceId: firm.instanceId,
    day: firm.foundingDay,
    founderId: firm.owner,
    founderName: town.people[firm.owner].name,
  }));
  const replacements = openings.filter((opening: any) => Number(opening.instanceId.split(":")[1]) > 1);
  const failures = town.firms.filter((firm: any) => !firm.active).map((firm: any) => ({
    archetypeId: firm.archetypeId,
    instanceId: firm.instanceId,
    day: firm.closedDay,
    status: firm.status,
  }));
  const repeatedChurn = optionalInstances.some((firm: any) => firm.instanceNumber >= 3)
    || replacements.length >= 2;
  return {
    seed,
    scenario: scenario.id,
    policy: { ...town.policy },
    requestedDays: days,
    completedDays: town.day - 1,
    openings,
    replacements,
    stageTransitions,
    final: {
      stage: final.townStage,
      alive: final.alive,
      survivalRate: round(final.alive / final.totalCitizens),
      employed: final.employed,
      employmentRate: final.alive ? round(final.employed / final.alive) : 0,
      hungry: final.hungry,
      unhoused: final.unhoused,
      hardshipRate: final.alive ? round((final.hungry + final.unhoused) / final.alive) : 0,
      firmFailures: failures,
    },
    cash: {
      initial: town.initialMoney,
      final: town.totalMoney(),
      conserved: Math.abs(town.totalMoney() - town.initialMoney) <= 0.1,
    },
    flags: {
      neverFormedOptionalFirm: openings.length === 0,
      repeatedPrivateChurn: repeatedChurn,
      collapsed: final.alive === 0 || final.townStage.id === "collapsed",
    },
  };
}

export function evaluateDevelopmentSensitivity(config: DevelopmentConfig) {
  if (!config.seeds.length || config.seeds.some((seed) => !Number.isInteger(seed))) throw new Error("At least one integer seed is required");
  if (!Number.isInteger(config.days) || config.days < 1) throw new Error("Development days must be a positive integer");
  const scenarios = config.scenarios ?? DEFAULT_DEVELOPMENT_SCENARIOS;
  if (!scenarios.length || scenarios.some((scenario) => !scenario.id.trim())) throw new Error("At least one named scenario is required");
  if (new Set(scenarios.map((scenario) => scenario.id)).size !== scenarios.length) throw new Error("Scenario IDs must be unique");
  const runs = scenarios.flatMap((scenario) => config.seeds.map((seed) => evaluateDevelopmentRun(seed, config.days, scenario)));
  return {
    metadata: {
      schemaVersion: DEVELOPMENT_SENSITIVITY_SCHEMA_VERSION,
      simulation: "Morrow",
      seeds: [...config.seeds],
      days: config.days,
      phasesPerDay: PHASES.length,
      startingComposition: "minimal-four-firm-foundation",
      scenarios: scenarios.map((scenario) => ({ id: scenario.id, policy: { ...scenario.policy } })),
      testedRanges: {
        discretionaryDemand: [Math.min(...scenarios.map((scenario) => scenario.policy.discretionaryDemand ?? 50)), Math.max(...scenarios.map((scenario) => scenario.policy.discretionaryDemand ?? 50))],
        supportRate: [Math.min(...scenarios.map((scenario) => scenario.policy.supportRate ?? 35)), Math.max(...scenarios.map((scenario) => scenario.policy.supportRate ?? 35))],
        shockRisk: [Math.min(...scenarios.map((scenario) => scenario.policy.shockRisk ?? 20)), Math.max(...scenarios.map((scenario) => scenario.policy.shockRisk ?? 20))],
        minimumWage: [Math.min(...scenarios.map((scenario) => scenario.policy.minimumWage ?? 5)), Math.max(...scenarios.map((scenario) => scenario.policy.minimumWage ?? 5))],
      },
      interpretation: "Deterministic gameplay sensitivity only; not empirical calibration, validation, forecast, or policy evidence.",
    },
    status: runs.every((run) => run.cash.conserved) ? "passed" : "failed",
    highlights: {
      neverFormed: runs.filter((run) => run.flags.neverFormedOptionalFirm).map((run) => ({ seed: run.seed, scenario: run.scenario })),
      repeatedChurn: runs.filter((run) => run.flags.repeatedPrivateChurn).map((run) => ({ seed: run.seed, scenario: run.scenario })),
      collapsed: runs.filter((run) => run.flags.collapsed).map((run) => ({ seed: run.seed, scenario: run.scenario })),
    },
    runs,
  } as const;
}

export function formatDevelopmentSensitivity(report: ReturnType<typeof evaluateDevelopmentSensitivity>) {
  const lines = [`Morrow development sensitivity · ${report.metadata.seeds.length} seeds × ${report.metadata.scenarios.length} scenarios × ${report.metadata.days} days · ${report.status.toUpperCase()}`];
  report.runs.forEach((run) => lines.push(
    `${run.scenario} / seed ${run.seed}: openings ${run.openings.map((opening: any) => `D${opening.day} ${opening.instanceId}`).join(", ") || "none"} · replacements ${run.replacements.length} · transitions ${run.stageTransitions.map((transition: any) => `${transition.from}→${transition.to}`).join(", ") || "none"} · alive ${run.final.alive} · employed ${run.final.employed} · hardship ${(run.final.hardshipRate * 100).toFixed(1)}% · failures ${run.final.firmFailures.length}${run.flags.repeatedPrivateChurn ? " · CHURN" : ""}${run.flags.collapsed ? " · COLLAPSED" : ""}`,
  ));
  lines.push(`Never formed: ${report.highlights.neverFormed.map((entry) => `${entry.scenario}/${entry.seed}`).join(", ") || "none"}`);
  lines.push(`Repeated churn: ${report.highlights.repeatedChurn.map((entry) => `${entry.scenario}/${entry.seed}`).join(", ") || "none"}`);
  lines.push(`Collapsed: ${report.highlights.collapsed.map((entry) => `${entry.scenario}/${entry.seed}`).join(", ") || "none"}`);
  lines.push(report.metadata.interpretation);
  return lines.join("\n");
}
