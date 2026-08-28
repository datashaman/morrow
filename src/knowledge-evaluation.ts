import {
  DEFAULT_LATENT_FIRM_NAMES,
  FIRMS,
  KNOWLEDGE_VOCATIONAL_DOMAINS,
  PHASES,
} from "./config.js";
import { TownSimulation } from "./simulation.js";

export const KNOWLEDGE_EVALUATION_SCHEMA_VERSION = 2;
export const KNOWLEDGE_SECTOR_FIXTURE_DAYS = 30;
export const KNOWLEDGE_WHOLE_TOWN_SEEDS = Object.freeze([20260823, 101, 202, 303, 404, 505]);
export const KNOWLEDGE_WHOLE_TOWN_DAYS = 60;

type KnowledgeEvaluationConfig = Readonly<{ seeds: readonly number[]; days: number }>;

const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function aggregateEffects(firms: any[]) {
  return Object.fromEntries(FIRMS.map((archetype) => {
    const entries = firms
      .filter((firm) => firm.archetypeId === archetype.archetypeId)
      .flatMap((firm) => firm.knowledgeEffectHistory);
    return [archetype.archetypeId, {
      days: entries.length,
      gross: round(sum(entries.map((entry) => entry.grossContribution))),
      released: sum(entries.map((entry) => entry.releasedUnits)),
      used: round(sum(entries.map((entry) => entry.usedUnits))),
    }];
  }));
}

function ensureFixtureFirm(town: any, archetype: any, workerCount: number) {
  let firm = town.firms.find((candidate: any) => candidate.archetypeId === archetype.archetypeId);
  if (!firm) {
    const owner = town.people.find((person: any) => person.employer < 0);
    firm = town.createFirmInstance(archetype, town.firms.length, { owner: owner.id, cash: 0, founderCapital: 0, targetStaff: workerCount, inventory: 0 });
    town.firms.push(firm);
  }
  while (firm.employees.length < workerCount) {
    const worker = town.people.find((person: any) => person.alive && person.employer < 0);
    if (!worker) throw new Error(`Fixture lacks workers for ${archetype.archetypeId}`);
    town.hire(firm, worker, true);
  }
  firm.operationalReadiness = 1;
  firm.active = true;
  return firm;
}

function runSectorFixture(archetype: any, knowledgeEnabled: boolean) {
  const town: any = new TownSimulation({ seed: 6200 + FIRMS.indexOf(archetype), knowledgeEnabled, transportEnabled: true } as any);
  const workerCount = archetype.archetypeId === "public-works"
    ? 6
    : archetype.knowledge.effectType === "processing-capacity"
    ? 6
    : archetype.knowledge.effectType === "transaction-capacity" ? 2 : 1;
  const firm = ensureFixtureFirm(town, archetype, workerCount);
  const workers = firm.employees.slice(0, workerCount).map((id: number) => town.people[id]);
  const buyer = town.people
    .filter((person: any) => person.alive && !workers.includes(person))
    .sort((a: any, b: any) => b.cash - a.cash)[0] ?? workers[0];
  const initialVocationalKnowledge = Math.max(...workers.flatMap((worker: any) => KNOWLEDGE_VOCATIONAL_DOMAINS.map((domain) => worker.knowledgeProfile[domain])));
  firm.inputInventory = archetype.knowledge.effectType === "processing-capacity" ? 500 : firm.inputInventory;
  let directAdditionalOutput = 0;

  for (let day = 1; day <= KNOWLEDGE_SECTOR_FIXTURE_DAYS; day += 1) {
    town.day = day;
    workers.forEach((worker: any) => {
      worker.attended = true;
      town.applyWorkplaceLearning(worker, firm);
    });
    town.accrueKnowledgeCapacity(firm);

    if (firm.knowledge.effectType === "transaction-capacity") {
      firm.transactionsToday = 0;
      const capacity = town.transactionCapacity(firm);
      for (let attempt = 0; attempt < capacity; attempt += 1) town.requestTransaction(firm, buyer, "funded fixture demand");
    } else if (firm.knowledge.effectType === "direct-yield") {
      town.addFirmInventory(firm, firm.knowledgeEffectGrossToday);
      directAdditionalOutput += firm.knowledgeEffectGrossToday;
    } else if (firm.knowledge.effectType === "processing-capacity") {
      firm.processingScalarCapacityToday = Math.floor(workers.length * firm.processingPerWorker * firm.operationalReadiness * town.scheduledShiftCapacityMultiplier());
      firm.processingCapacityToday = firm.processingScalarCapacityToday + firm.knowledgeCapacitySlotsToday;
      firm.processedToday = 0;
      town.processConstructionInputs(firm);
    } else if (firm.knowledge.effectType === "haulage-capacity") {
      firm.transportScalarCapacityToday = Math.floor(workers.length * town.transportCapacityPerWorker() * firm.operationalReadiness * town.scheduledShiftCapacityMultiplier());
      firm.transportCapacityToday = firm.transportScalarCapacityToday + firm.knowledgeCapacitySlotsToday;
      firm.transportLoadToday = firm.transportCapacityToday;
      town.markKnowledgeEffectUsed(firm, Math.max(0, firm.transportLoadToday - firm.transportScalarCapacityToday));
    }
    firm.transactionsToday = 0;
    firm.knowledgeCapacitySlotsToday = 0;
  }

  town.assertInvariants();
  const effects = aggregateEffects([firm])[archetype.archetypeId];
  const learning = workers.flatMap((worker: any) => worker.learningHistory);
  return {
    mode: knowledgeEnabled ? "knowledge-v2" : "scalar-skill-baseline",
    workers: workerCount,
    initialVocationalKnowledge,
    fundedDemand: buyer.cash >= firm.price,
    inputAvailable: firm.knowledge.effectType !== "processing-capacity" || firm.inputInventory >= 0,
    learningRecords: learning.length,
    learnedDomains: Object.fromEntries(archetype.knowledge.domains.map((domain: any) => [
      domain.id,
      round(sum(workers.map((worker: any) => worker.knowledgeProfile[domain.id])) / workers.length),
    ])),
    effects,
    directAdditionalOutput: round(directAdditionalOutput),
    cashDifference: round(town.totalMoney() - town.initialMoney),
  };
}

function evaluateSectorFixtures() {
  return FIRMS.map((archetype) => {
    const scalar = runSectorFixture(archetype, false);
    const knowledge = runSectorFixture(archetype, true);
    return {
      archetypeId: archetype.archetypeId,
      name: archetype.name,
      effectType: archetype.knowledge.effectType,
      scalar,
      knowledge,
      deltas: {
        learningRecords: knowledge.learningRecords - scalar.learningRecords,
        gross: round(knowledge.effects.gross - scalar.effects.gross),
        released: knowledge.effects.released - scalar.effects.released,
        used: round(knowledge.effects.used - scalar.effects.used),
        directAdditionalOutput: round(knowledge.directAdditionalOutput - scalar.directAdditionalOutput),
      },
    };
  });
}

function evaluateRun(seed: number, days: number, knowledgeEnabled: boolean) {
  const town: any = new TownSimulation({
    seed,
    knowledgeEnabled,
    latentFirmNames: DEFAULT_LATENT_FIRM_NAMES,
    housingCapacityEnabled: true,
    transportEnabled: true,
    schedulesEnabled: true,
    sleepEnabled: true,
  } as any);
  const salesByArchetype: Record<string, number> = Object.fromEntries(FIRMS.map((firm) => [firm.archetypeId, 0]));

  for (let elapsed = 0; elapsed < days && !town.isExtinct(); elapsed += 1) {
    for (let phase = 0; phase < PHASES.length; phase += 1) {
      if (PHASES[phase] === "Settlement") town.firms.forEach((firm: any) => {
        salesByArchetype[firm.archetypeId] += firm.sales;
      });
      town.step();
    }
  }

  town.assertInvariants();
  const final = town.snapshot();
  const learningRecords = town.people.flatMap((person: any) => person.learningHistory);
  const sourceCounts = learningRecords.reduce((counts: Record<string, number>, record: any) => {
    counts[record.source] = (counts[record.source] ?? 0) + 1;
    return counts;
  }, {});
  const domainLearning = Object.fromEntries(KNOWLEDGE_VOCATIONAL_DOMAINS.map((domain) => [domain, {
    records: learningRecords.filter((record: any) => record.domain === domain).length,
    mean: round(sum(town.people.map((person: any) => person.knowledgeProfile[domain])) / town.people.length),
  }]));
  const finalMoney = town.totalMoney();
  return {
    seed,
    mode: knowledgeEnabled ? "knowledge-v2" : "scalar-skill-baseline",
    requestedDays: days,
    completedDays: town.day - 1,
    formationCoverage: {
      observedArchetypes: [...new Set(town.firms.map((firm: any) => firm.archetypeId))].sort(),
      formedArchetypes: [...new Set(town.firms.filter((firm: any) => firm.foundingDay > 1).map((firm: any) => firm.archetypeId))].sort(),
    },
    learning: { records: learningRecords.length, sourceCounts, domains: domainLearning },
    effects: aggregateEffects(town.firms),
    sales: {
      total: round(sum(Object.values(salesByArchetype))),
      byArchetype: Object.fromEntries(Object.entries(salesByArchetype).map(([id, value]) => [id, round(value)])),
    },
    outcomes: {
      alive: final.alive,
      dead: final.dead,
      employed: final.employed,
      hungry: final.hungry,
      unhoused: final.unhoused,
      insolventFirms: town.firms.filter((firm: any) => !firm.active).length,
    },
    cash: { initial: town.initialMoney, final: finalMoney, difference: round(finalMoney - town.initialMoney), conserved: Math.abs(finalMoney - town.initialMoney) <= 0.1 },
  };
}

function effectDelta(knowledge: any, scalar: any) {
  return Object.fromEntries(FIRMS.map((archetype) => {
    const candidate = knowledge.effects[archetype.archetypeId];
    const baseline = scalar.effects[archetype.archetypeId];
    return [archetype.archetypeId, {
      gross: round(candidate.gross - baseline.gross),
      released: candidate.released - baseline.released,
      used: round(candidate.used - baseline.used),
    }];
  }));
}

export function evaluateKnowledgeTracer(config: KnowledgeEvaluationConfig) {
  if (!config.seeds.length || config.seeds.some((seed) => !Number.isInteger(seed))) throw new Error("At least one integer seed is required");
  if (!Number.isInteger(config.days) || config.days < 1) throw new Error("Knowledge evaluation days must be a positive integer");
  const sectorFixtures = evaluateSectorFixtures();
  const pairs = config.seeds.map((seed) => {
    const scalar = evaluateRun(seed, config.days, false);
    const knowledge = evaluateRun(seed, config.days, true);
    const scalarReplay = evaluateRun(seed, config.days, false);
    const knowledgeReplay = evaluateRun(seed, config.days, true);
    return {
      seed,
      scalar,
      knowledge,
      replay: { scalar: JSON.stringify(scalar) === JSON.stringify(scalarReplay), knowledge: JSON.stringify(knowledge) === JSON.stringify(knowledgeReplay) },
      deltas: {
        formationCoverage: knowledge.formationCoverage.observedArchetypes.length - scalar.formationCoverage.observedArchetypes.length,
        learningRecords: knowledge.learning.records - scalar.learning.records,
        effects: effectDelta(knowledge, scalar),
        sales: round(knowledge.sales.total - scalar.sales.total),
        employed: knowledge.outcomes.employed - scalar.outcomes.employed,
        hungry: knowledge.outcomes.hungry - scalar.outcomes.hungry,
        unhoused: knowledge.outcomes.unhoused - scalar.outcomes.unhoused,
        alive: knowledge.outcomes.alive - scalar.outcomes.alive,
        dead: knowledge.outcomes.dead - scalar.outcomes.dead,
        insolventFirms: knowledge.outcomes.insolventFirms - scalar.outcomes.insolventFirms,
        cash: round(knowledge.cash.difference - scalar.cash.difference),
      },
    };
  });
  const discreteFixtures = sectorFixtures.filter((fixture) => fixture.effectType !== "direct-yield");
  const checks = {
    fixturesCoverEveryArchetype: sectorFixtures.length === FIRMS.length,
    fixturesStartAtScalarZero: sectorFixtures.every((fixture) => fixture.scalar.initialVocationalKnowledge === 0
      && fixture.knowledge.initialVocationalKnowledge === 0
      && fixture.scalar.learningRecords === 0
      && fixture.scalar.effects.gross === 0),
    fixtureLearningObserved: sectorFixtures.every((fixture) => fixture.knowledge.learningRecords > 0),
    fixtureGrossEffectsObserved: sectorFixtures.every((fixture) => fixture.knowledge.effects.gross > 0),
    fixtureDiscreteReleaseObserved: discreteFixtures.every((fixture) => fixture.knowledge.effects.released > 0),
    fixtureEffectsUsed: sectorFixtures.every((fixture) => fixture.knowledge.effects.used > 0),
    cashConserved: sectorFixtures.every((fixture) => fixture.scalar.cashDifference === 0 && fixture.knowledge.cashDifference === 0)
      && pairs.every((pair) => pair.scalar.cash.conserved && pair.knowledge.cash.conserved),
    replayStable: pairs.every((pair) => pair.replay.scalar && pair.replay.knowledge),
    scalarBaselineHasNoLearningOrEffects: pairs.every((pair) => pair.scalar.learning.records === 0
      && Object.values(pair.scalar.effects).every((effect: any) => effect.gross === 0)),
    townLearningObserved: sum(pairs.map((pair) => pair.knowledge.learning.records)) > 0,
  };
  return {
    metadata: {
      schemaVersion: KNOWLEDGE_EVALUATION_SCHEMA_VERSION,
      simulation: "Morrow",
      seeds: [...config.seeds],
      days: config.days,
      fixtureDays: KNOWLEDGE_SECTOR_FIXTURE_DAYS,
      phasesPerDay: PHASES.length,
      baseline: "post-schedule scalar skill with vocational learning and effects disabled",
      candidate: "knowledge-v2 configured workplace learning and bounded operational effects",
      hypothesis: "Zero-start trade fixtures should naturally learn and use a bounded effect in every archetype; paired towns should remain replay-stable and conserve cash.",
      interpretation: "Deterministic gameplay evidence only. Downstream sales, employment, hardship, housing, survival, and firm-failure deltas are observations, not directional targets or empirical claims.",
    },
    status: Object.values(checks).every(Boolean) ? "passed" : "failed",
    checks,
    totals: {
      fixtureLearningRecords: sum(sectorFixtures.map((fixture) => fixture.knowledge.learningRecords)),
      fixtureGross: round(sum(sectorFixtures.map((fixture) => fixture.knowledge.effects.gross))),
      fixtureReleased: sum(sectorFixtures.map((fixture) => fixture.knowledge.effects.released)),
      fixtureUsed: round(sum(sectorFixtures.map((fixture) => fixture.knowledge.effects.used))),
      townLearningRecords: sum(pairs.map((pair) => pair.knowledge.learning.records)),
    },
    sectorFixtures,
    pairs,
  } as const;
}

export function formatKnowledgeEvaluation(report: ReturnType<typeof evaluateKnowledgeTracer>) {
  const lines = [`Morrow cross-trade knowledge tracer · ${report.metadata.seeds.length} seeds × ${report.metadata.days} days · ${report.status.toUpperCase()}`];
  lines.push(`Sector fixtures: ${report.sectorFixtures.length}/${FIRMS.length} archetypes · ${report.totals.fixtureLearningRecords} learning records · ${report.totals.fixtureGross.toFixed(2)} gross · ${report.totals.fixtureReleased} whole released · ${report.totals.fixtureUsed.toFixed(2)} used`);
  report.pairs.forEach((pair) => lines.push(
    `Seed ${pair.seed}: formed ${pair.knowledge.formationCoverage.formedArchetypes.length} archetypes · learning ${pair.knowledge.learning.records} · sales Δ${pair.deltas.sales.toFixed(2)} · alive Δ${pair.deltas.alive} · employed Δ${pair.deltas.employed} · hungry Δ${pair.deltas.hungry} · unhoused Δ${pair.deltas.unhoused} · insolvent firms Δ${pair.deltas.insolventFirms} · replay ${pair.replay.scalar && pair.replay.knowledge ? "pass" : "FAIL"}`,
  ));
  lines.push(`Checks: ${Object.entries(report.checks).map(([name, passed]) => `${name}=${passed ? "pass" : "FAIL"}`).join(" · ")}`);
  lines.push(report.metadata.interpretation);
  return lines.join("\n");
}
