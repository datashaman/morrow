import { MotivationCitizenPolicy, PERSONAL_TIME_ACTIONS, RuleCitizenPolicy, type CitizenPolicy } from "./citizen-policy.ts";
import { PHASES } from "./config.js";
import { ShadowCitizenPolicy } from "./neural-policy.ts";
import { TownSimulation } from "./simulation.js";

export const EVALUATION_SCHEMA_VERSION = 2;

export type PolicyFactory = () => CitizenPolicy;
export type EvaluationConfig = Readonly<{
  seeds: readonly number[];
  days: number;
  policies?: readonly string[];
  baseline?: string;
  policyFactories?: Readonly<Record<string, PolicyFactory>>;
}>;

const defaultPolicyFactories: Readonly<Record<string, PolicyFactory>> = {
  rule: () => new RuleCitizenPolicy(),
  motivation: () => new ShadowCitizenPolicy(new MotivationCitizenPolicy()),
};

function addCounts(target: Record<string, number>, source: Record<string, number>) {
  Object.entries(source).forEach(([name, value]) => { target[name] = (target[name] ?? 0) + value; });
}

function assertFiniteState(town: TownSimulation) {
  const visit = (value: unknown, path: string) => {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`Non-finite state at ${path}`);
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${path}[${index}]`));
    if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => {
      if (!["decisions", "ledger", "events"].includes(key)) visit(item, `${path}.${key}`);
    });
  };
  visit({ people: town.people, firms: town.firms, government: town.government, contracts: town.contracts }, "town");
}

function personalTimeDiversity(town: TownSimulation) {
  const distributions = (town as any).people.map((person: any) => {
    const counts = Object.fromEntries(PERSONAL_TIME_ACTIONS.map((action) => [action, 0])) as Record<string, number>;
    person.decisions.filter((decision: any) => decision.kind === "personal-time").forEach((decision: any) => { counts[decision.chosenAction] += 1; });
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const shares = PERSONAL_TIME_ACTIONS.map((action) => total ? counts[action] / total : 0);
    const entropy = total ? -shares.filter(Boolean).reduce((sum, share) => sum + share * Math.log(share), 0) / Math.log(PERSONAL_TIME_ACTIONS.length) : 0;
    return { total, shares, entropy };
  }).filter((distribution: any) => distribution.total > 0);
  const meanEntropy = distributions.length ? distributions.reduce((sum: number, item: any) => sum + item.entropy, 0) / distributions.length : 0;
  const betweenCitizenVariance = PERSONAL_TIME_ACTIONS.reduce((total, _, actionIndex) => {
    if (!distributions.length) return total;
    const meanShare = distributions.reduce((sum: number, item: any) => sum + item.shares[actionIndex], 0) / distributions.length;
    return total + distributions.reduce((sum: number, item: any) => sum + (item.shares[actionIndex] - meanShare) ** 2, 0) / distributions.length;
  }, 0) / PERSONAL_TIME_ACTIONS.length;
  const distinctProfiles = new Set(distributions.map((item: any) => item.shares.map((share: number) => share.toFixed(2)).join(","))).size;
  return { citizensObserved: distributions.length, meanEntropy, betweenCitizenVariance, distinctProfiles };
}

export function evaluatePolicyRun({ seed, days, policyFactory }: { seed: number; days: number; policyFactory: PolicyFactory }) {
  const policy = policyFactory();
  const town: any = new TownSimulation({ seed, citizenPolicy: policy } as any);
  const citizenDays = { alive: 0, hungry: 0, unhoused: 0, employed: 0 };
  let failure: string | null = null;
  let invalidActions = 0;
  let completedDays = 0;
  try {
    for (let day = 0; day < days && !town.isExtinct(); day += 1) {
      for (let phase = 0; phase < PHASES.length; phase += 1) town.step();
      assertFiniteState(town);
      const snapshot = town.snapshot();
      citizenDays.alive += snapshot.alive;
      citizenDays.hungry += snapshot.hungry;
      citizenDays.unhoused += snapshot.unhoused;
      citizenDays.employed += snapshot.employed;
      completedDays += 1;
    }
    town.assertInvariants();
    assertFiniteState(town);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    invalidActions = /illegal .* action/i.test(failure) ? 1 : 0;
  }

  const snapshot = town.snapshot();
  const actionCounts: Record<string, number> = {};
  const shadowActionCounts: Record<string, number> = {};
  const shadow = { decisions: 0, divergences: 0, invalidPreferencesBeforeMask: 0 };
  const control = { neuralDecisions: 0, neuralOutsidePersonalTime: 0, divergencesFromFallback: 0 };
  const outcomeProjections = { missedShiftDelta: 0, essentialSkipDelta: 0, acceptedOfferDelta: 0 };
  const isEssentialSkip = (action: string) => ["skip-food", "defer-housing", "remain-unhoused"].includes(action);
  town.people.forEach((person: any) => person.decisions.forEach((decision: any) => {
    actionCounts[decision.chosenAction] = (actionCounts[decision.chosenAction] ?? 0) + 1;
    if (decision.control?.mode === "neural") {
      control.neuralDecisions += 1;
      control.neuralOutsidePersonalTime += Number(decision.kind !== "personal-time");
      control.divergencesFromFallback += Number(decision.shadow?.diverged);
    }
    if (decision.shadow) {
      shadow.decisions += 1;
      shadow.divergences += Number(decision.shadow.diverged);
      shadow.invalidPreferencesBeforeMask += Number(decision.shadow.invalidPreferenceBeforeMask);
      shadowActionCounts[decision.shadow.action] = (shadowActionCounts[decision.shadow.action] ?? 0) + 1;
      outcomeProjections.missedShiftDelta += Number(decision.shadow.action === "miss-shift") - Number(decision.chosenAction === "miss-shift");
      outcomeProjections.essentialSkipDelta += Number(isEssentialSkip(decision.shadow.action)) - Number(isEssentialSkip(decision.chosenAction));
      outcomeProjections.acceptedOfferDelta += Number(decision.shadow.action === "accept-job-offer") - Number(decision.chosenAction === "accept-job-offer");
    }
  }));
  const rejectedOffers = actionCounts["decline-job-offer"] ?? 0;
  const inactiveFirms = town.firms.filter((firm: any) => !firm.active).length;
  return {
    seed,
    policyId: policy.id,
    policyMetadata: town.policyMetadata(),
    requestedDays: days,
    completedDays,
    status: failure ? "failed" : "passed",
    failure,
    final: {
      alive: snapshot.alive,
      dead: snapshot.dead,
      totalCitizens: snapshot.totalCitizens,
      hungry: snapshot.hungry,
      unhoused: snapshot.unhoused,
      employed: snapshot.employed,
      insolventFirms: inactiveFirms,
      totalFirms: town.firms.length,
    },
    citizenDays,
    rejectedOffers,
    invalidActions,
    cash: {
      initial: town.initialMoney,
      final: town.totalMoney(),
      difference: Math.round((town.totalMoney() - town.initialMoney) * 100) / 100,
      conserved: Math.abs(town.totalMoney() - town.initialMoney) <= 0.1,
    },
    actionCounts,
    behavior: personalTimeDiversity(town),
    control,
    shadow: {
      ...shadow,
      divergenceRate: shadow.decisions ? shadow.divergences / shadow.decisions : 0,
      invalidPreferenceRate: shadow.decisions ? shadow.invalidPreferencesBeforeMask / shadow.decisions : 0,
      actionCounts: shadowActionCounts,
      outcomeProjections,
    },
  } as const;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function aggregatePolicy(name: string, runs: ReturnType<typeof evaluatePolicyRun>[]) {
  const actionCounts: Record<string, number> = {};
  runs.forEach((run) => addCounts(actionCounts, run.actionCounts));
  return {
    name,
    policyId: runs[0]?.policyId ?? name,
    runs: runs.length,
    failures: runs.filter((run) => run.status === "failed").length,
    means: {
      survivalRate: mean(runs.map((run) => run.final.alive / run.final.totalCitizens)),
      hungry: mean(runs.map((run) => run.final.hungry)),
      unhoused: mean(runs.map((run) => run.final.unhoused)),
      employmentRate: mean(runs.map((run) => run.final.employed / Math.max(1, run.final.alive))),
      insolventFirms: mean(runs.map((run) => run.final.insolventFirms)),
      rejectedOffers: mean(runs.map((run) => run.rejectedOffers)),
      invalidActions: mean(runs.map((run) => run.invalidActions)),
      cashDifference: mean(runs.map((run) => run.cash.difference)),
      personalTimeEntropy: mean(runs.map((run) => run.behavior.meanEntropy)),
      betweenCitizenActionVariance: mean(runs.map((run) => run.behavior.betweenCitizenVariance)),
      distinctPersonalTimeProfiles: mean(runs.map((run) => run.behavior.distinctProfiles)),
      neuralControlledDecisions: mean(runs.map((run) => run.control.neuralDecisions)),
      neuralControlDivergences: mean(runs.map((run) => run.control.divergencesFromFallback)),
      shadowDivergenceRate: mean(runs.map((run) => run.shadow.divergenceRate)),
      shadowInvalidPreferenceRate: mean(runs.map((run) => run.shadow.invalidPreferenceRate)),
      projectedMissedShiftDelta: mean(runs.map((run) => run.shadow.outcomeProjections.missedShiftDelta)),
      projectedEssentialSkipDelta: mean(runs.map((run) => run.shadow.outcomeProjections.essentialSkipDelta)),
      projectedAcceptedOfferDelta: mean(runs.map((run) => run.shadow.outcomeProjections.acceptedOfferDelta)),
    },
    actionCounts,
  };
}

export function evaluatePolicies(config: EvaluationConfig) {
  if (!config.seeds.length) throw new Error("At least one evaluation seed is required");
  if (!Number.isInteger(config.days) || config.days < 1) throw new Error("Evaluation days must be a positive integer");
  const baseline = config.baseline ?? "rule";
  const requestedPolicies = config.policies ?? ["motivation"];
  const policyNames = [...new Set([baseline, ...requestedPolicies])];
  const factories = { ...defaultPolicyFactories, ...config.policyFactories };
  policyNames.forEach((name) => {
    if (!factories[name]) throw new Error(`Unknown policy implementation: ${name}`);
  });
  const runs = policyNames.flatMap((name) => config.seeds.map((seed) => ({
    name,
    result: evaluatePolicyRun({ seed, days: config.days, policyFactory: factories[name] }),
  })));
  const aggregates = Object.fromEntries(policyNames.map((name) => [
    name,
    aggregatePolicy(name, runs.filter((run) => run.name === name).map((run) => run.result)),
  ]));
  const baselineMeans = aggregates[baseline].means;
  const comparisons = Object.fromEntries(policyNames.filter((name) => name !== baseline).map((name) => [name, {
    baseline,
    deltas: Object.fromEntries(Object.entries(aggregates[name].means).map(([metric, value]) => [
      metric,
      value - baselineMeans[metric as keyof typeof baselineMeans],
    ])),
  }]));
  return {
    metadata: {
      schemaVersion: EVALUATION_SCHEMA_VERSION,
      simulation: "Morrow",
      simulationVersion: "0.1.0",
      baseline,
      policies: policyNames,
      policyVersions: Object.fromEntries(policyNames.map((name) => [name, aggregates[name].policyId])),
      weightVersions: Object.fromEntries(policyNames.map((name) => [
        name,
        [...new Set(runs.filter((run) => run.name === name).map((run) => run.result.policyMetadata.weightsVersion).filter(Boolean))],
      ])),
      seeds: [...config.seeds],
      days: config.days,
      phasesPerDay: PHASES.length,
    },
    status: runs.some((run) => run.result.status === "failed") ? "failed" : "passed",
    aggregates,
    comparisons,
    runs,
  } as const;
}

export function formatEvaluationSummary(report: ReturnType<typeof evaluatePolicies>) {
  const lines = [
    `Morrow policy evaluation · ${report.metadata.seeds.length} seeds × ${report.metadata.days} days · ${report.status.toUpperCase()}`,
  ];
  Object.values(report.aggregates).forEach((aggregate) => {
    lines.push(`${aggregate.name} (${aggregate.policyId}): survival ${(aggregate.means.survivalRate * 100).toFixed(1)}% · employed ${(aggregate.means.employmentRate * 100).toFixed(1)}% · hungry ${aggregate.means.hungry.toFixed(1)} · unhoused ${aggregate.means.unhoused.toFixed(1)} · insolvent firms ${aggregate.means.insolventFirms.toFixed(1)} · shadow divergence ${(aggregate.means.shadowDivergenceRate * 100).toFixed(1)}% · invalid pre-mask ${(aggregate.means.shadowInvalidPreferenceRate * 100).toFixed(1)}% · failures ${aggregate.failures}`);
  });
  Object.entries(report.comparisons).forEach(([name, comparison]) => {
    lines.push(`${name} − ${comparison.baseline}: survival ${(comparison.deltas.survivalRate * 100).toFixed(1)}pp · employment ${(comparison.deltas.employmentRate * 100).toFixed(1)}pp · hungry ${comparison.deltas.hungry.toFixed(1)} · unhoused ${comparison.deltas.unhoused.toFixed(1)}`);
  });
  return lines.join("\n");
}
