import { GROCERY_KNOWLEDGE_CAPACITY_BONUS, PHASES } from "./config.js";
import { TownSimulation } from "./simulation.js";

export const KNOWLEDGE_EVALUATION_SCHEMA_VERSION = 1;

type KnowledgeEvaluationConfig = Readonly<{
  seeds: readonly number[];
  days: number;
}>;

const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function groceryCapacity(town: any) {
  return town.firms
    .filter((firm: any) => firm.active && firm.archetypeId === "everyday-grocer")
    .reduce((totals: any, firm: any) => {
      const attending = firm.employees.map((id: number) => town.people[id]).filter((person: any) => person.attended);
      const scalarGross = attending.length * firm.transactionsPerWorker;
      const knowledgeGross = attending.reduce((capacity: number, person: any) => {
        const vocational = (person.knowledgeProfile.retail + person.knowledgeProfile.inventory) / 2;
        return capacity + firm.transactionsPerWorker * (1 + vocational * GROCERY_KNOWLEDGE_CAPACITY_BONUS);
      }, 0);
      const readiness = firm.operationalReadiness;
      return {
        actual: totals.actual + town.transactionCapacity(firm),
        scalarCounterfactual: totals.scalarCounterfactual + Math.floor(scalarGross * readiness),
        grossKnowledgeBonus: totals.grossKnowledgeBonus + Math.max(0, (knowledgeGross - scalarGross) * readiness),
      };
    }, { actual: 0, scalarCounterfactual: 0, grossKnowledgeBonus: 0 });
}

function evaluateRun(seed: number, days: number, knowledgeEnabled: boolean) {
  const town: any = new TownSimulation({ seed, knowledgeEnabled } as any);
  let actualCapacityPointDays = 0;
  let scalarCounterfactualCapacityPointDays = 0;
  let grossKnowledgeBonusCapacityPointDays = 0;
  let groceryTransactions = 0;

  for (let elapsed = 0; elapsed < days && !town.isExtinct(); elapsed += 1) {
    for (let phase = 0; phase < PHASES.length; phase += 1) {
      town.step();
      if (phase === 0) {
        const capacity = groceryCapacity(town);
        actualCapacityPointDays += capacity.actual;
        scalarCounterfactualCapacityPointDays += capacity.scalarCounterfactual;
        grossKnowledgeBonusCapacityPointDays += capacity.grossKnowledgeBonus;
      }
      if (phase === 3) {
        groceryTransactions += sum(town.firms
          .filter((firm: any) => firm.active && firm.archetypeId === "everyday-grocer")
          .map((firm: any) => firm.transactionsToday));
      }
    }
  }

  town.assertInvariants();
  const final = town.snapshot();
  const learningRecords = town.people.flatMap((person: any) => person.learningHistory);
  const domainMean = (domain: string) => round(sum(town.people.map((person: any) => person.knowledgeProfile[domain])) / town.people.length);
  const sourceCounts = learningRecords.reduce((counts: Record<string, number>, record: any) => {
    counts[record.source] = (counts[record.source] ?? 0) + 1;
    return counts;
  }, {});
  const finalMoney = town.totalMoney();
  return {
    seed,
    mode: knowledgeEnabled ? "knowledge-v1" : "scalar-skill-baseline",
    requestedDays: days,
    completedDays: town.day - 1,
    learning: {
      records: learningRecords.length,
      sourceCounts,
      meanGeneral: domainMean("general"),
      meanRetail: domainMean("retail"),
      meanInventory: domainMean("inventory"),
    },
    grocery: {
      actualCapacityPointDays,
      scalarCounterfactualCapacityPointDays,
      discreteBonusCapacityPointDays: actualCapacityPointDays - scalarCounterfactualCapacityPointDays,
      grossKnowledgeBonusCapacityPointDays: round(grossKnowledgeBonusCapacityPointDays),
      completedTransactions: groceryTransactions,
    },
    outcomes: {
      alive: final.alive,
      dead: final.dead,
      employed: final.employed,
      hungry: final.hungry,
      unhoused: final.unhoused,
      insolventFirms: town.firms.filter((firm: any) => !firm.active).length,
    },
    cash: {
      initial: town.initialMoney,
      final: finalMoney,
      difference: round(finalMoney - town.initialMoney),
      conserved: Math.abs(finalMoney - town.initialMoney) <= 0.1,
    },
  };
}

export function evaluateKnowledgeTracer(config: KnowledgeEvaluationConfig) {
  if (!config.seeds.length || config.seeds.some((seed) => !Number.isInteger(seed))) throw new Error("At least one integer seed is required");
  if (!Number.isInteger(config.days) || config.days < 1) throw new Error("Knowledge evaluation days must be a positive integer");
  const pairs = config.seeds.map((seed) => {
    const scalar = evaluateRun(seed, config.days, false);
    const knowledge = evaluateRun(seed, config.days, true);
    return {
      seed,
      scalar,
      knowledge,
      deltas: {
        learningRecords: knowledge.learning.records - scalar.learning.records,
        grossKnowledgeBonusCapacityPointDays: round(knowledge.grocery.grossKnowledgeBonusCapacityPointDays - scalar.grocery.grossKnowledgeBonusCapacityPointDays),
        discreteBonusCapacityPointDays: knowledge.grocery.discreteBonusCapacityPointDays - scalar.grocery.discreteBonusCapacityPointDays,
        groceryTransactions: knowledge.grocery.completedTransactions - scalar.grocery.completedTransactions,
        alive: knowledge.outcomes.alive - scalar.outcomes.alive,
        employed: knowledge.outcomes.employed - scalar.outcomes.employed,
        hungry: knowledge.outcomes.hungry - scalar.outcomes.hungry,
        unhoused: knowledge.outcomes.unhoused - scalar.outcomes.unhoused,
        insolventFirms: knowledge.outcomes.insolventFirms - scalar.outcomes.insolventFirms,
      },
    };
  });
  const checks = {
    cashConserved: pairs.every((pair) => pair.scalar.cash.conserved && pair.knowledge.cash.conserved),
    scalarBaselineHasNoLearning: pairs.every((pair) => pair.scalar.learning.records === 0),
    learningObserved: sum(pairs.map((pair) => pair.knowledge.learning.records)) > 0,
    capacityEffectObserved: sum(pairs.map((pair) => pair.knowledge.grocery.grossKnowledgeBonusCapacityPointDays)) >= 1,
    discreteCapacityEffectObserved: sum(pairs.map((pair) => pair.knowledge.grocery.discreteBonusCapacityPointDays)) >= 1,
  };
  return {
    metadata: {
      schemaVersion: KNOWLEDGE_EVALUATION_SCHEMA_VERSION,
      simulation: "Morrow",
      seeds: [...config.seeds],
      days: config.days,
      phasesPerDay: PHASES.length,
      baseline: "scalar skill with knowledge updates and effects disabled",
      candidate: "knowledge-v1 workplace/course learning and grocery-capacity effect",
      hypothesis: "Across the fixed run set, knowledge-v1 should create auditable learning, at least one gross grocery capacity-point-day, and at least one accumulated whole transaction slot without violating cash conservation.",
      interpretation: "Deterministic gameplay comparison only; not empirical evidence about learning, productivity, education, or labor markets.",
    },
    status: Object.values(checks).every(Boolean) ? "passed" : "failed",
    checks,
    totals: {
      learningRecords: sum(pairs.map((pair) => pair.knowledge.learning.records)),
      grossKnowledgeBonusCapacityPointDays: round(sum(pairs.map((pair) => pair.knowledge.grocery.grossKnowledgeBonusCapacityPointDays))),
      discreteBonusCapacityPointDays: sum(pairs.map((pair) => pair.knowledge.grocery.discreteBonusCapacityPointDays)),
    },
    pairs,
  } as const;
}

export function formatKnowledgeEvaluation(report: ReturnType<typeof evaluateKnowledgeTracer>) {
  const lines = [`Morrow knowledge tracer · ${report.metadata.seeds.length} seeds × ${report.metadata.days} days · ${report.status.toUpperCase()}`];
  report.pairs.forEach((pair) => lines.push(
    `Seed ${pair.seed}: ${pair.knowledge.learning.records} learning records · ${pair.knowledge.grocery.grossKnowledgeBonusCapacityPointDays.toFixed(2)} gross capacity-point-days (${pair.knowledge.grocery.discreteBonusCapacityPointDays} after flooring) · grocery transactions Δ${pair.deltas.groceryTransactions} · alive Δ${pair.deltas.alive} · employed Δ${pair.deltas.employed} · hungry Δ${pair.deltas.hungry} · unhoused Δ${pair.deltas.unhoused} · insolvent firms Δ${pair.deltas.insolventFirms}`,
  ));
  lines.push(`Checks: ${Object.entries(report.checks).map(([name, passed]) => `${name}=${passed ? "pass" : "FAIL"}`).join(" · ")}`);
  lines.push(report.metadata.interpretation);
  return lines.join("\n");
}
