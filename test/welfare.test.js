import assert from "node:assert/strict";
import test from "node:test";
import { TownSimulation } from "../src/simulation.js";

test("welfare mode is explicit, validated, retained by reset, and exposed by snapshot", () => {
  const town = new TownSimulation({ seed: 61, welfareMode: "combined" });
  assert.equal(town.snapshot().welfareMode, "combined");
  assert.throws(() => new TownSimulation({ welfareMode: "unknown" }), /Unknown welfare mode/);

  town.reset();

  assert.equal(town.welfareMode, "combined");
  assert.equal(town.people.every((person) => person.welfareHistory.length === 0 && person.welfareSequence === 0), true);
  assert.deepEqual(town.government.welfareHistory, []);
});

test("the daily welfare envelope snapshots treasury cash once after payroll", () => {
  const town = new TownSimulation({ seed: 61, welfareMode: "combined", policy: { supportRate: 35 } });
  town.government.cash = 200;

  const state = town.beginWelfareEnvelope();
  assert.deepEqual(state, { day: 1, envelopeSnapshotCash: 200, envelope: 12.6, spent: 0, directAidByCitizen: {} });

  town.government.cash = 250;
  assert.equal(town.beginWelfareEnvelope(), state);
  assert.equal(town.remainingWelfareEnvelope(), 12.6);

  town.day = 2;
  assert.deepEqual(town.beginWelfareEnvelope(), { day: 2, envelopeSnapshotCash: 250, envelope: 15.75, spent: 0, directAidByCitizen: {} });
});

test("zero welfare budget and no-welfare mode both create a zero envelope", () => {
  assert.equal(new TownSimulation({ welfareMode: "combined", policy: { supportRate: 0 } }).beginWelfareEnvelope().envelope, 0);
  assert.equal(new TownSimulation({ welfareMode: "none", policy: { supportRate: 100 } }).beginWelfareEnvelope().envelope, 0);
});

test("structured welfare evidence carries programme, actor, and civil time identity", () => {
  const town = new TownSimulation({ seed: 61, welfareMode: "combined" });
  town.phase = 4;
  const person = town.people[0];
  const record = town.recordWelfare(person, { programme: "food-assistance", outcome: "eligible", reason: "exact shortfall" }, "Food shopping");

  assert.deepEqual(record, {
    day: 1,
    block: "Evening",
    processingPhase: "Food",
    phaseIndex: 4,
    sequence: 1,
    actorKind: "person",
    actorId: person.id,
    actorName: person.name,
    programme: "food-assistance",
    outcome: "eligible",
    reason: "exact shortfall",
  });
  assert.equal(Object.isFrozen(record), true);
});

test("Food Assistance atomically combines private cash and the exact treasury shortfall", () => {
  const town = new TownSimulation({ seed: 61, welfareMode: "combined", policy: { supportRate: 100 } });
  town.phase = 4;
  const recipient = town.people.at(-1);
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  recipient.cash = 1.05;
  town.government.cash = 100;
  const moneyBefore = town.totalMoney();
  const providerCashBefore = grocer.cash;
  const inventoryBefore = grocer.inventory;

  const result = town.settleDirectAssistance({ programme: "food", recipient, provider: grocer, purpose: "food" });

  assert.equal(result.completed, true);
  assert.equal(recipient.cash, 0);
  assert.equal(town.government.cash, 98.9);
  assert.equal(grocer.cash, providerCashBefore + grocer.price);
  assert.equal(grocer.inventory, inventoryBefore - 1);
  assert.equal(grocer.sales, grocer.price);
  assert.equal(grocer.unitsSold, 1);
  assert.equal(recipient.foodStock.length, 1);
  assert.equal(town.totalMoney(), moneyBefore);
  assert.deepEqual(result.evidence.linkedTransactionIds, ["welfare:1:1:private", "welfare:1:1:treasury"]);
  assert.equal(result.evidence.privateContribution, 1.05);
  assert.equal(result.evidence.treasuryContribution, 1.1);
  assert.equal(result.evidence.completePrice, 2.15);
  assert.equal(town.welfareState.spent, 1.1);
  assert.equal(town.welfareState.directAidByCitizen[recipient.id], 1.1);
  assert.equal(recipient.ledger[0].transactionId, "welfare:1:1:private");
  assert.equal(town.government.ledger[0].transactionId, "welfare:1:1:treasury");
  assert.equal(grocer.welfareHistory[0].outcome, "delivered");
});

test("Food Assistance supports a zero-cash recipient without manufacturing a private leg", () => {
  const town = new TownSimulation({ seed: 62, welfareMode: "combined", policy: { supportRate: 100 } });
  town.phase = 4;
  const recipient = town.people.at(-1);
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  recipient.cash = 0;
  town.government.cash = 100;

  const result = town.settleDirectAssistance({ programme: "food", recipient, provider: grocer, purpose: "food" });

  assert.equal(result.completed, true);
  assert.deepEqual(result.evidence.linkedTransactionIds, ["welfare:1:1:treasury"]);
  assert.equal(result.evidence.privateContribution, 0);
  assert.equal(result.evidence.treasuryContribution, 2.15);
  assert.equal(recipient.ledger.length, 0);
});

test("Rent Assistance settles only the current exact rent and clears arrears", () => {
  const town = new TownSimulation({ seed: 63, welfareMode: "combined", policy: { supportRate: 100 } });
  town.phase = 5;
  const recipient = town.people.at(-1);
  const housing = town.firms.find((firm) => firm.sector === "housing");
  recipient.cash = 2.35;
  recipient.rentArrears = 2;
  town.government.cash = 100;
  const providerCashBefore = housing.cash;

  const result = town.settleDirectAssistance({ programme: "rent", recipient, provider: housing, purpose: "rent" });

  assert.equal(result.completed, true);
  assert.equal(result.evidence.completePrice, 6);
  assert.equal(result.evidence.privateContribution, 2.35);
  assert.equal(result.evidence.treasuryContribution, 3.65);
  assert.equal(recipient.rentArrears, 0);
  assert.equal(recipient.rentSeller, housing.id);
  assert.equal(housing.cash, providerCashBefore + 6);
});

test("direct assistance failure reasons leave money, stock, sales, and capacity untouched", () => {
  const cases = [
    ["no eligible provider", (town) => ({ provider: null })],
    ["provider inactive", (town, provider) => { provider.active = false; return { provider }; }],
    ["provider closed", (town, provider) => { town.schedulesEnabled = true; provider.openWeekdays = []; return { provider }; }],
    ["no stock", (town, provider) => { provider.inventory = 0; provider.inventoryBatches = []; return { provider }; }],
    ["no attended staff", (town, provider) => { provider.employees = []; return { provider }; }],
    ["no transaction capacity", (town, provider) => { provider.transactionsToday = town.transactionCapacity(provider); return { provider }; }],
    ["exhausted daily envelope", (town, provider) => { town.welfareState.spent = town.welfareState.envelope; return { provider }; }],
    ["insufficient treasury cash", (town, provider) => { town.government.cash = 0.5; return { provider }; }],
  ];

  cases.forEach(([reason, arrange], index) => {
    const town = new TownSimulation({ seed: 100 + index, welfareMode: "combined", policy: { supportRate: 100 } });
    town.phase = 4;
    const recipient = town.people.at(-1);
    const provider = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
    recipient.cash = 1;
    town.government.cash = 100;
    town.beginWelfareEnvelope();
    const options = arrange(town, provider);
    const balancesBefore = [recipient.cash, provider.cash, town.government.cash];
    const inventoryBefore = provider.inventory;
    const salesBefore = provider.sales;
    const unitsBefore = provider.unitsSold;
    const transactionsBefore = provider.transactionsToday;

    const result = town.settleDirectAssistance({ programme: "food", recipient, purpose: "food", ...options });

    assert.equal(result.completed, false, reason);
    assert.equal(result.reason, reason);
    assert.deepEqual([recipient.cash, provider.cash, town.government.cash], balancesBefore, reason);
    assert.equal(provider.inventory, inventoryBefore, reason);
    assert.equal(provider.sales, salesBefore, reason);
    assert.equal(provider.unitsSold, unitsBefore, reason);
    assert.equal(provider.transactionsToday, transactionsBefore, reason);
    assert.equal(recipient.welfareHistory[0].reason, reason);
  });
});

test("Rent Assistance rejects a non-current housing transaction without moving money", () => {
  const town = new TownSimulation({ seed: 64, welfareMode: "combined", policy: { supportRate: 100 } });
  town.day = 2;
  town.phase = 5;
  const recipient = town.people.at(-1);
  const housing = town.firms.find((firm) => firm.sector === "housing");
  recipient.cash = 1;
  const balancesBefore = [recipient.cash, housing.cash, town.government.cash];

  const result = town.settleDirectAssistance({ programme: "rent", recipient, provider: housing, purpose: "rent" });

  assert.equal(result.reason, "unavailable housing transaction");
  assert.deepEqual([recipient.cash, housing.cash, town.government.cash], balancesBefore);
});
