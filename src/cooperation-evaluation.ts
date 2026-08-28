import { DEFAULT_LATENT_FIRM_NAMES, PHASES } from "./config.js";
import { TownSimulation } from "./simulation.js";

export const COOPERATION_EVALUATION_SCHEMA_VERSION = 1;
export const DEFAULT_COOPERATION_EVALUATION_SEEDS = Object.freeze([20260823, 101, 202, 303, 404, 505]);
export const COOPERATION_EVALUATION_MODES = Object.freeze(["legacy", "public-social", "mutual-aid"] as const);

type CooperationMode = (typeof COOPERATION_EVALUATION_MODES)[number];
type CooperationEvaluationConfig = Readonly<{ seeds: readonly number[]; days: number }>;

const round = (value: number) => Math.round(value * 1000) / 1000;
const sum = (values: number[]) => round(values.reduce((total, value) => total + value, 0));

function concentration(records: any[], idField: "giverId" | "recipientId") {
  const counts = records.reduce((result: Map<number, number>, record: any) => {
    result.set(record[idField], (result.get(record[idField]) ?? 0) + 1);
    return result;
  }, new Map());
  const total = records.length;
  const byCitizen = [...counts.entries()].sort(([left], [right]) => left - right).map(([citizenId, count]) => ({ citizenId, count }));
  return {
    participants: counts.size,
    byCitizen,
    largestShare: total ? round(Math.max(...counts.values()) / total) : 0,
    hhi: total ? round([...counts.values()].reduce((value, count) => value + (count / total) ** 2, 0)) : 0,
  };
}

function runMode(seed: number, days: number, mode: CooperationMode) {
  const town: any = new TownSimulation({
    seed,
    latentFirmNames: [...DEFAULT_LATENT_FIRM_NAMES],
    housingCapacityEnabled: true,
    transportEnabled: true,
    schedulesEnabled: true,
    sleepEnabled: true,
    cooperationMode: mode,
  } as any);
  let hungerCitizenDays = 0;
  const trajectory: any[] = [];
  for (let elapsed = 0; elapsed < days && !town.isExtinct(); elapsed += 1) {
    for (let phase = 0; phase < PHASES.length; phase += 1) town.step();
    town.assertInvariants();
    const living = town.people.filter((person: any) => person.alive);
    const hungry = living.filter((person: any) => person.hungryDays > 0).length;
    hungerCitizenDays += hungry;
    trajectory.push({ day: town.day - 1, alive: living.length, hungry, treasuryCash: town.government.cash });
  }

  const decisions = town.people.flatMap((person: any) => person.decisions);
  const giverDecisions = decisions.filter((decision: any) => decision.kind === "mutual-aid-offer");
  const recipientDecisions = decisions.filter((decision: any) => decision.kind === "mutual-aid-receive");
  const giftRecords = town.people.flatMap((person: any) => person.mutualAidHistory).filter((record: any) => record.direction === "out");
  const giftedMeals = Object.values(town.foodItems).filter((meal: any) => meal.custody.length > 0) as any[];
  const support = town.people.flatMap((person: any) => person.ledger).filter((entry: any) => entry.direction === "in" && entry.text === "support from treasury");
  const foodWaste = [...town.people, ...town.firms].flatMap((actor: any) => actor.wasteHistory)
    .filter((record: any) => ["produce", "budgetFood", "premiumFood", "cafeService"].includes(record.product));
  const closeFriendships = town.people.reduce((count: number, person: any) => count + Object.entries(person.relationships)
    .filter(([friendId, relationship]: any) => Number(friendId) > person.id && relationship.strength >= 0.75 && town.people[friendId].relationships[person.id]?.strength >= 0.75).length, 0);
  const applicationFailures = decisions.filter((decision: any) => decision.application?.applied === false);
  const custody = town.foodCustodyChecks();
  const initialCash = town.initialMoney;
  const finalCash = town.totalMoney();
  const hardChecks = {
    zeroIllegalAppliedActions: decisions.every((decision: any) => !decision.application?.applied || !decision.application.failure),
    zeroProtectedReserveViolations: applicationFailures.filter((decision: any) => /protected reserve/.test(decision.application.failure)).every((decision: any) => !decision.application.applied),
    zeroPantryOverflow: custody.pantryWithinCapacity,
    validCustodyChains: custody.validChains,
    noExpiredGifts: custody.noExpiredGifts,
    mealOwnershipReconciled: custody.ownershipReconciled,
    cashConserved: Math.abs(finalCash - initialCash) <= 0.1,
  };
  if (Object.values(hardChecks).some((passed) => !passed)) throw new Error(`Cooperation invariant failed for seed ${seed}, mode ${mode}`);
  return {
    mode,
    completedDays: town.day - 1,
    trajectory,
    social: {
      parkAttendance: town.cooperationMetrics.parkAttendance,
      cafeAttendance: town.cooperationMetrics.cafeAttendance,
      contacts: town.cooperationMetrics.contacts,
      newFriendships: town.cooperationMetrics.newFriendships,
      closeFriendshipsReached: town.cooperationMetrics.closeFriendshipsReached,
      closeFriendshipsFinal: closeFriendships,
    },
    mutualAid: {
      eligibleOptions: giverDecisions.reduce((total: number, decision: any) => total + decision.observation.options.length, 0),
      offers: giverDecisions.filter((decision: any) => decision.chosenAction.startsWith("offer-meal:")).length,
      keeps: giverDecisions.filter((decision: any) => decision.chosenAction === "keep-meals").length,
      refusals: recipientDecisions.filter((decision: any) => decision.chosenAction === "refuse-all-meal-gifts").length,
      acceptedGifts: giftRecords.length,
      giftedMealsEaten: giftedMeals.filter((meal: any) => meal.consumedDay !== null).length,
      giftedMealsSpoiled: giftedMeals.filter((meal: any) => meal.spoiledDay !== null).length,
      reGiftedTransfers: giftedMeals.reduce((total: number, meal: any) => total + Math.max(0, meal.custody.length - 1), 0),
      giverReserveFailures: applicationFailures.filter((decision: any) => /protected reserve/.test(decision.application.failure)).length,
      pantryCapacityFailures: applicationFailures.filter((decision: any) => /pantry/.test(decision.application.failure)).length,
      givingConcentration: concentration(giftRecords, "giverId"),
      receivingConcentration: concentration(giftRecords, "recipientId"),
    },
    hardship: {
      hungerCitizenDays,
      foodWasteUnits: sum(foodWaste.map((record: any) => record.quantity)),
      treasurySupportPayments: support.length,
      treasurySupportAmount: sum(support.map((entry: any) => entry.amount)),
      deaths: town.people.filter((person: any) => !person.alive).length,
      survivors: town.people.filter((person: any) => person.alive).length,
    },
    hardChecks,
  };
}

export function evaluateCooperation(config: CooperationEvaluationConfig) {
  if (!config.seeds.length || config.seeds.some((seed) => !Number.isInteger(seed))) throw new Error("At least one integer seed is required");
  if (!Number.isInteger(config.days) || config.days < 1) throw new Error("Cooperation evaluation days must be a positive integer");
  const runs = config.seeds.map((seed) => {
    const modes = COOPERATION_EVALUATION_MODES.map((mode) => runMode(seed, config.days, mode));
    const replay = COOPERATION_EVALUATION_MODES.map((mode) => runMode(seed, config.days, mode));
    if (JSON.stringify(modes) !== JSON.stringify(replay)) throw new Error(`Deterministic cooperation replay failed for seed ${seed}`);
    return { seed, deterministicReplay: true, modes };
  });
  return {
    metadata: {
      schemaVersion: COOPERATION_EVALUATION_SCHEMA_VERSION,
      simulation: "Morrow",
      seeds: [...config.seeds],
      days: config.days,
      phasesPerDay: PHASES.length,
      modes: [...COOPERATION_EVALUATION_MODES],
      interpretation: "Deterministic gameplay comparison only. Hunger, support, survival, and concentration are observations—not pass criteria, tuning triggers, empirical calibration, forecasts, or evidence about real mutual aid.",
    },
    status: "passed",
    runs,
  } as const;
}

export function formatCooperationEvaluation(report: ReturnType<typeof evaluateCooperation>) {
  const lines = [`Morrow cooperation evaluation · ${report.metadata.seeds.length} seeds × 3 modes × ${report.metadata.days} days · ${report.status.toUpperCase()}`];
  report.runs.forEach((run) => {
    lines.push(`seed ${run.seed}: ${run.modes.map((mode) => `${mode.mode} gifts ${mode.mutualAid.acceptedGifts}, hunger-days ${mode.hardship.hungerCitizenDays}, support ${mode.hardship.treasurySupportAmount}, alive ${mode.hardship.survivors}`).join(" → ")}`);
  });
  lines.push(report.metadata.interpretation);
  return lines.join("\n");
}
