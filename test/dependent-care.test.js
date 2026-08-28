import assert from "node:assert/strict";
import test from "node:test";
import { MotivationCitizenPolicy } from "../src/citizen-policy.ts";
import { TownSimulation } from "../src/simulation.js";

const carePolicy = ({ actionForGuardian = () => null, acceptWelfare = true } = {}) => ({
  id: "dependent-care-test",
  decide: ({ observation, legalActions }) => {
    if (observation.kind === "dependent-food-care") {
      const requested = actionForGuardian(observation, legalActions);
      return { action: requested && legalActions.includes(requested) ? requested : "defer-dependent-food", reasons: ["dependent care fixture"] };
    }
    if (observation.kind === "welfare") return { action: acceptWelfare ? "accept-welfare" : "refuse-welfare", reasons: ["welfare fixture"] };
    return { action: legalActions[0], reasons: ["fixture default"] };
  },
});

const careTown = (options = {}) => {
  const town = new TownSimulation({ seed: 71, lifecycleEnabled: true, birthsEnabled: true, welfareMode: "combined", policy: { supportRate: 100 }, ...options });
  const dependent = town.createNewborn([0, 1]);
  return { town, dependent, first: town.people[0], second: town.people[1] };
};

const availableFoodFirms = (town) => town.firms.filter((firm) => town.firmServiceAvailable(firm, "Evening") && firm.sector === "food").sort((a, b) => a.price - b.price);

test("motivation-v3 can provide a meal or defer a capacity-blocked purchase", () => {
  const policy = new MotivationCitizenPolicy();
  const base = {
    kind: "dependent-food-care",
    citizenId: 0,
    citizenName: "Guardian",
    dependentId: 40,
    dependentName: "Child",
    stress: 0,
    guardianSelfNeed: 0,
    careScarcity: 0,
    profile: { comfort: 1, connection: 1, mastery: 1, security: 1, foodQuality: 1, planning: 1, avoidance: 1 },
  };
  const transfer = { action: "transfer-dependent-meal:1", source: "pantry", mealQuality: 1, spoilagePressure: 1, reserveCoverage: 0, costPressure: 0, capacityAvailable: true };
  assert.equal(policy.decide({ observation: { ...base, dependentNeed: 1, options: [transfer] }, legalActions: ["defer-dependent-food", transfer.action], random: () => 0 }).action, transfer.action);

  const blocked = { action: "buy-dependent-food:1", source: "seller", mealQuality: 0, spoilagePressure: 0, reserveCoverage: 0, costPressure: 1, capacityAvailable: false };
  assert.equal(policy.decide({ observation: { ...base, dependentNeed: 0, options: [blocked] }, legalActions: ["defer-dependent-food", blocked.action], random: () => 0 }).action, "defer-dependent-food");
});

test("motivation-v3 weighs dependent medicine against clinic cost and a guardian's lost wage", () => {
  const policy = new MotivationCitizenPolicy();
  const base = {
    kind: "dependent-health-care",
    citizenId: 0,
    citizenName: "Guardian",
    dependentId: 40,
    dependentName: "Child",
    stress: 0.2,
    healthNeed: 0.9,
    careScarcity: 0.1,
    lostWagePressure: 0.8,
    profile: { comfort: 1, connection: 1, mastery: 1, security: 1, foodQuality: 1, planning: 1, avoidance: 1 },
  };
  const medicine = { action: "buy-dependent-medicine:5", source: "medicine", expectedRecovery: 0.12, costPressure: 0.1, capacityAvailable: true };
  const clinic = { action: "buy-dependent-clinic:6", source: "clinic", expectedRecovery: 0.3, costPressure: 0.1, capacityAvailable: true };
  const actions = ["defer-dependent-health", medicine.action, clinic.action];

  assert.equal(policy.decide({ observation: { ...base, options: [medicine, clinic] }, legalActions: actions, random: () => 0 }).action, clinic.action);
  assert.equal(policy.decide({ observation: { ...base, healthNeed: 0.2, options: [medicine, { ...clinic, capacityAvailable: false }] }, legalActions: actions, random: () => 0 }).action, medicine.action);
  assert.equal(policy.decide({ observation: { ...base, healthNeed: 0, careScarcity: 1, stress: 1, options: [{ ...medicine, capacityAvailable: false }] }, legalActions: ["defer-dependent-health", medicine.action], random: () => 0 }).action, "defer-dependent-health");
});

test("a dependent follows a housed living guardian and enters treasury guardianship only when none remain", () => {
  const { town, dependent, first, second } = careTown();
  first.housed = false;
  second.housed = true;

  town.reconcileDependentCare(dependent);
  assert.equal(dependent.residentialGuardianId, second.id);
  assert.equal(dependent.housed, true);
  assert.equal(dependent.treasuryGuardian, false);

  town.die(second, "guardian died");
  town.reconcileDependentCare(dependent);
  assert.deepEqual(dependent.guardianIds, [first.id]);
  assert.deepEqual(dependent.formerGuardianIds, [second.id]);
  assert.equal(dependent.residentialGuardianId, first.id);
  assert.equal(dependent.housed, false);

  town.die(first, "last guardian died");
  town.reconcileDependentCare(dependent);
  assert.deepEqual(dependent.guardianIds, []);
  assert.equal(dependent.residentialGuardianId, null);
  assert.equal(dependent.treasuryGuardian, true);
  assert.equal(dependent.housed, false);
});

test("one guardian exact-pays for one meal that is assigned to and consumed by the dependent", () => {
  const policy = carePolicy({ actionForGuardian: (_observation, legal) => legal.find((action) => action.startsWith("buy-dependent-food:")) });
  const { town, dependent, first } = careTown({ citizenPolicy: policy });
  const grocer = availableFoodFirms(town)[0];
  first.cash = 20;
  dependent.health = 0.5;
  const moneyBefore = town.totalMoney();
  const guardianBefore = first.cash;
  const providerBefore = grocer.cash;

  assert.equal(town.considerDependentFood(dependent, [grocer]), true);

  assert.equal(first.cash, guardianBefore - grocer.price);
  assert.equal(grocer.cash, providerBefore + grocer.price);
  assert.equal(dependent.foodStock.length, 0);
  assert.equal(dependent.foodConsumedToday, 1);
  assert.equal(dependent.foodSeller, grocer.id);
  assert.ok(dependent.health > 0.5);
  assert.equal(town.totalMoney(), moneyBefore);
  assert.match(first.ledger[0].text, /bought 1 food portion/);
});

test("a guardian may transfer their last unexpired meal without moving money", () => {
  const policy = carePolicy({ actionForGuardian: (_observation, legal) => legal.find((action) => action.startsWith("transfer-dependent-meal:")) });
  const { town, dependent, first } = careTown({ citizenPolicy: policy });
  const grocer = availableFoodFirms(town)[0];
  first.cash = 20;
  assert.ok(town.buy(first, grocer, 1, "food"));
  const moneyBefore = town.totalMoney();
  assert.equal(first.foodStock.length, 1);

  assert.equal(town.considerDependentFood(dependent, [grocer]), true);

  assert.equal(first.foodStock.length, 0);
  assert.equal(dependent.foodConsumedToday, 1);
  assert.equal(town.totalMoney(), moneyBefore);
  assert.match(first.events[0].text, /provided a stored meal/);
});

test("restricted inheritance pays before guardian cash and welfare shortfall", () => {
  const policy = carePolicy({ actionForGuardian: (_observation, legal) => legal.find((action) => action.startsWith("buy-dependent-food:")) });
  const { town, dependent, first } = careTown({ citizenPolicy: policy });
  const grocer = availableFoodFirms(town).find((firm) => firm.sells === "budgetFood");
  dependent.restrictedInheritance = 0.65;
  first.cash = 0.5;
  town.government.cash = 100;
  town.initialMoney = town.totalMoney();
  const moneyBefore = town.totalMoney();
  const treasuryBefore = town.government.cash;

  assert.equal(town.considerDependentFood(dependent, [grocer]), true);

  assert.equal(dependent.restrictedInheritance, 0);
  assert.equal(first.cash, 0);
  assert.equal(town.government.cash, treasuryBefore - (grocer.price - 1.15));
  assert.equal(town.totalMoney(), moneyBefore);
  assert.deepEqual(dependent.welfareHistory[0].linkedTransactionIds, [
    "welfare:1:1:restricted",
    "welfare:1:1:private",
    "welfare:1:1:treasury",
  ]);
});

test("a co-guardian is tried when the residential guardian defers care", () => {
  const policy = carePolicy({
    actionForGuardian: (observation, legal) => observation.citizenId === 0
      ? "defer-dependent-food"
      : legal.find((action) => action.startsWith("buy-dependent-food:")),
  });
  const { town, dependent, first, second } = careTown({ citizenPolicy: policy });
  const grocer = availableFoodFirms(town)[0];
  first.cash = second.cash = 20;
  dependent.residentialGuardianId = first.id;
  const firstBefore = first.cash;
  const secondBefore = second.cash;

  assert.equal(town.considerDependentFood(dependent, [grocer]), true);
  assert.equal(first.cash, firstBefore);
  assert.equal(second.cash, secondBefore - grocer.price);
  assert.deepEqual(first.decisions.at(-1).chosenAction, "defer-dependent-food");
});

test("treasury guardianship provides only a finite exact food purchase", () => {
  const funded = careTown({ citizenPolicy: carePolicy() });
  funded.dependent.guardianIds = [];
  funded.dependent.residentialGuardianId = null;
  funded.town.government.cash = 100;
  const grocer = availableFoodFirms(funded.town).find((firm) => firm.sells === "budgetFood");
  const treasuryBefore = funded.town.government.cash;
  assert.equal(funded.town.considerDependentFood(funded.dependent, [grocer]), true);
  assert.equal(funded.town.government.cash, treasuryBefore - grocer.price);
  assert.equal(funded.dependent.foodConsumedToday, 1);
  assert.equal(funded.dependent.welfareHistory[0].decisionMakerName, "Town treasury");

  const exhausted = careTown({ citizenPolicy: carePolicy() });
  exhausted.dependent.guardianIds = [];
  exhausted.dependent.residentialGuardianId = null;
  exhausted.town.government.cash = 0;
  const exhaustedGrocer = availableFoodFirms(exhausted.town).find((firm) => firm.sells === "budgetFood");
  const stockBefore = exhaustedGrocer.inventory;
  assert.equal(exhausted.town.considerDependentFood(exhausted.dependent, [exhaustedGrocer]), false);
  assert.equal(exhausted.dependent.hungryDays, 1);
  assert.equal(exhaustedGrocer.inventory, stockBefore);
  assert.equal(exhausted.dependent.foodConsumedToday, 0);
});
