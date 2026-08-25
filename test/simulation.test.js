import assert from "node:assert/strict";
import test from "node:test";
import {
  createMotivationProfile,
  MotivationCitizenPolicy,
  RuleCitizenPolicy,
} from "../src/citizen-policy.ts";
import { PHASES, PRODUCTS } from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

test("money remains inside the closed economy", () => {
  const town = new TownSimulation({ seed: 42 });
  const initial = town.initialMoney;
  for (let step = 0; step < 600; step += 1) town.step();
  assert.ok(Math.abs(town.totalMoney() - initial) <= 0.1);
});

test("a citizen retains their complete in-memory activity history", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  person.events = [];
  person.ledger = [];

  for (let index = 0; index < 20; index += 1) {
    town.note(person, `event ${index}`);
    town.ledger(person, { direction: "in", amount: 1, text: `transaction ${index}`, before: person.cash });
  }

  assert.equal(person.events.length, 20);
  assert.equal(person.ledger.length, 20);
});

test("every firm begins with its configured owner and staff count", () => {
  const town = new TownSimulation({ seed: 42 });

  town.firms.forEach((firm) => {
    assert.equal(town.people[firm.owner].employer, firm.id);
    assert.equal(firm.employees.length, firm.initialStaff);
  });
});

test("every firm has a valid explicit product pipeline", () => {
  const town = new TownSimulation({ seed: 42 });

  town.firms.forEach((firm) => {
    assert.ok(PRODUCTS[firm.sells]);
    if (firm.input) {
      assert.ok(PRODUCTS[firm.input]);
      assert.equal(town.firms.find((supplier) => supplier.name === firm.source)?.sells, firm.input);
    }
  });
  assert.equal(town.firms.find((firm) => firm.sector === "agriculture").name, "Morrow Fields");
});

test("farm workers produce inputs that immediate-settlement contracts move to retailers", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  const harvest = town.firms.find((firm) => firm.name === "Harvest Foods");
  const farmInventory = farm.inventory;
  const harvestInventory = harvest.inventory;
  const farmCash = farm.cash;
  const harvestCash = harvest.cash;
  farm.employees.forEach((id) => { town.people[id].attended = true; });

  town.productionPhase();
  const produced = farm.inventory - farmInventory;
  town.procurementPhase();
  const contract = town.contracts.find((candidate) => candidate.buyer === "Harvest Foods");

  assert.ok(produced > 0);
  assert.equal(contract.deliveredToday, 22);
  assert.equal(harvest.inventory, harvestInventory + 22);
  assert.equal(harvest.cash, harvestCash - 24.2);
  assert.equal(farm.cash > farmCash, true);
  assert.equal(harvest.inputCosts, 24.2);
  assert.match(harvest.ledger[0].text, /22 crates from Morrow Fields/);
});

test("a supply contract cannot put its buyer into debt", () => {
  const town = new TownSimulation({ seed: 42 });
  const harvest = town.firms.find((firm) => firm.name === "Harvest Foods");
  const contract = town.contracts.find((candidate) => candidate.buyer === "Harvest Foods");
  harvest.cash = 1;

  town.procurementPhase();

  assert.equal(contract.deliveredToday, 0);
  assert.equal(contract.shortfallToday, contract.requestedToday);
  assert.equal(harvest.cash, 1);
});

test("replenishment cannot exceed a contract's daily quantity", () => {
  const town = new TownSimulation({ seed: 42 });
  const harvest = town.firms.find((firm) => firm.name === "Harvest Foods");
  const contract = town.contracts.find((candidate) => candidate.buyer === "Harvest Foods");
  harvest.inventory = 0;

  town.procurementPhase();

  assert.equal(contract.requestedToday, contract.dailyQuantity);
  assert.equal(contract.deliveredToday, contract.dailyQuantity);
  assert.equal(contract.shortfallToday, 0);
});

test("Makers Guild supplies operating stock without inflating saleable inventory", () => {
  const town = new TownSimulation({ seed: 42 });
  const guild = town.firms.find((firm) => firm.name === "Makers Guild");
  const homeWorks = town.firms.find((firm) => firm.name === "HomeWorks");
  const contract = town.contracts.find((candidate) => candidate.supplier === "Makers Guild" && candidate.buyer === "HomeWorks");
  town.contracts.filter((candidate) => candidate !== contract).forEach((candidate) => { candidate.active = false; });
  homeWorks.operatingSupplies = 0;
  const saleableInventoryBefore = homeWorks.inventory;
  const buyerCashBefore = homeWorks.cash;
  const supplierCashBefore = guild.cash;
  const totalBefore = town.totalMoney();

  town.procurementPhase();

  assert.equal(contract.requestedToday, 1);
  assert.equal(contract.deliveredToday, 1);
  assert.equal(homeWorks.operatingSupplies, 1);
  assert.equal(homeWorks.inventory, saleableInventoryBefore);
  assert.equal(homeWorks.inputCosts, 5);
  assert.equal(homeWorks.cash, buyerCashBefore - 5);
  assert.equal(guild.cash, supplierCashBefore + 5);
  assert.match(homeWorks.ledger[0].text, /1 kit from Makers Guild/);
  assert.equal(town.totalMoney(), totalBefore);
});

test("missing and restoring Makers Guild maintenance changes transaction capacity", () => {
  const town = new TownSimulation({ seed: 42 });
  const harvest = town.firms.find((firm) => firm.name === "Harvest Foods");
  harvest.employees.forEach((id) => { town.people[id].attended = true; });
  harvest.operatingSupplies = 0;
  harvest.events = [];
  town.day = 3;

  town.productionPhase();

  assert.equal(harvest.operationalReadiness, 0.65);
  assert.equal(town.transactionCapacity(harvest), 15);
  assert.match(harvest.events[0].text, /missing a maintenance kit/);

  harvest.operatingSupplies = 1;
  town.day = 4;
  town.productionPhase();

  assert.equal(harvest.operationalReadiness, 1);
  assert.equal(town.transactionCapacity(harvest), 24);
  assert.match(harvest.events[0].text, /restored full operating capacity/);
});

test("missed maintenance reduces direct production", () => {
  const maintainedTown = new TownSimulation({ seed: 42 });
  const constrainedTown = new TownSimulation({ seed: 42 });
  const maintainedFarm = maintainedTown.firms.find((firm) => firm.name === "Morrow Fields");
  const constrainedFarm = constrainedTown.firms.find((firm) => firm.name === "Morrow Fields");
  maintainedTown.day = constrainedTown.day = 3;
  maintainedFarm.operatingSupplies = 1;
  constrainedFarm.operatingSupplies = 0;
  const maintainedBefore = maintainedFarm.inventory;
  const constrainedBefore = constrainedFarm.inventory;

  maintainedTown.productionPhase();
  constrainedTown.productionPhase();

  const maintainedProduction = maintainedFarm.inventory - maintainedBefore;
  const constrainedProduction = constrainedFarm.inventory - constrainedBefore;
  assert.ok(maintainedProduction > constrainedProduction);
  assert.ok(Math.abs(constrainedProduction / maintainedProduction - 0.65) < 1e-9);
});

test("maintenance demand gives Makers Guild recurring seeded revenue", () => {
  const town = new TownSimulation({ seed: 20260823 });
  const guild = town.firms.find((firm) => firm.name === "Makers Guild");

  for (let day = 0; day < 30; day += 1) {
    for (let phase = 0; phase < PHASES.length; phase += 1) town.step();
  }

  assert.ok(guild.ledger.some((entry) => /kit to/.test(entry.text)));
  assert.ok(guild.revenueEMA > 0);
});

test("a vital firm receives at most one finite treasury rescue", () => {
  const town = new TownSimulation({ seed: 42 });
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  const initialMoney = town.totalMoney();
  town.transfer(farm, town.government, farm.cash, { exact: true });
  farm.distressDays = 2;
  const treasuryBefore = town.government.cash;

  town.assessFirmSolvency(farm);

  assert.equal(farm.status, "rescued");
  assert.equal(farm.rescueCount, 1);
  assert.equal(farm.lastRescueDay, town.day);
  assert.ok(farm.cash > 0 && firmCashIsBounded(farm.cash));
  assert.equal(town.government.cash, treasuryBefore - farm.cash);
  assert.equal(town.totalMoney(), initialMoney);
  assert.match(farm.ledger[0].text, /one-time vital-business rescue/);
});

test("treasury support fills an essential-runway shortfall without rewarding homelessness alone", () => {
  const town = new TownSimulation({ seed: 42, policy: { supportRate: 100, shockRisk: 0 } });
  const [cashRich, cashPoor] = town.people.filter((person) => person.employer < 0 && person.id >= town.firms.length);
  town.people.forEach((person) => {
    person.cash = 100;
    person.housed = true;
    person.hungryDays = 0;
    person.ledger = [];
  });
  cashRich.housed = false;
  cashRich.cash = 76;
  cashPoor.cash = 1;
  const targetCash = Math.round(town.essentialCost() * 4 * 100) / 100;
  const treasuryBefore = town.government.cash;

  town.settlementPhase();

  assert.equal(cashRich.cash, 76);
  assert.equal(cashRich.ledger.some((entry) => entry.text === "support from treasury"), false);
  assert.equal(cashPoor.cash, 6);
  assert.deepEqual(
    (({ amount, text, before, after }) => ({ amount, text, before, after }))(cashPoor.ledger.find((entry) => entry.text === "support from treasury")),
    { amount: 5, text: "support from treasury", before: 1, after: 6 },
  );
  assert.ok(targetCash > cashPoor.cash);
  assert.equal(town.government.cash, treasuryBefore - 5);
});

test("treasury support never pays beyond the essential-runway shortfall", () => {
  const town = new TownSimulation({ seed: 42, policy: { supportRate: 100, shockRisk: 0 } });
  const person = town.people.find((candidate) => candidate.employer < 0 && candidate.id >= town.firms.length);
  town.people.forEach((candidate) => {
    candidate.cash = 100;
    candidate.housed = true;
    candidate.hungryDays = 0;
  });
  const targetCash = Math.round(town.essentialCost() * 4 * 100) / 100;
  person.cash = targetCash - 0.75;

  town.settlementPhase();

  assert.equal(person.cash, targetCash);
  assert.equal(person.ledger.find((entry) => entry.text === "support from treasury").amount, 0.75);
});

test("a previously rescued vital firm can become insolvent without a second rescue", () => {
  const town = new TownSimulation({ seed: 42 });
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  town.transfer(farm, town.government, farm.cash, { exact: true });
  farm.rescueCount = 1;
  farm.status = "distressed";
  farm.distressDays = 5;

  town.assessFirmSolvency(farm);

  assert.equal(farm.active, false);
  assert.equal(farm.status, "insolvent");
  assert.equal(farm.rescueCount, 1);
  assert.equal(farm.employees.length, 0);
  assert.ok(town.contracts.filter((contract) => contract.supplierId === farm.id).every((contract) => !contract.active));
});

test("a persistently unfunded non-vital firm becomes insolvent", () => {
  const town = new TownSimulation({ seed: 42 });
  const makers = town.firms.find((firm) => firm.name === "Makers Guild");
  town.transfer(makers, town.government, makers.cash, { exact: true });
  makers.distressDays = 5;
  makers.status = "distressed";

  town.assessFirmSolvency(makers);

  assert.equal(makers.active, false);
  assert.equal(makers.status, "insolvent");
  assert.match(makers.events[0].text, /sustained insolvency/);
});

test("a secure working owner can waive wages to preserve a cash-poor firm", () => {
  const town = new TownSimulation({ seed: 42 });
  const firm = town.firms.find((candidate) => candidate.name === "Harvest Foods");
  const owner = town.people[firm.owner];
  const coworker = town.people[firm.employees.find((id) => id !== owner.id)];
  owner.cash = town.essentialCost() * 12;
  owner.ledger = [];
  owner.events = [];
  coworker.ledger = [];
  firm.cash = town.nextOperatingNeed(firm) - 1;
  firm.employees.forEach((id) => { town.people[id].attended = true; });

  town.payrollPhase();

  assert.equal(owner.ledger.length, 0);
  assert.equal(firm.ownerDecision.wage, "waived");
  assert.match(firm.ownerDecision.wageReason, /preserve operating cash/);
  assert.match(owner.events[0].text, /waived owner wage/);
  assert.match(coworker.ledger[0].text, /wage from Harvest Foods/);
  assert.equal(owner.decisions[0].kind, "owner");
  assert.equal(owner.decisions[0].observation.domain, "wage");
  assert.equal(owner.decisions[0].chosenAction, "waive-owner-wage");
  assert.deepEqual(owner.decisions[0].legalActions, ["draw-owner-wage", "waive-owner-wage"]);
  assert.equal(firm.decisions[0].chosenAction, "waive-owner-wage");
});

test("a cash-poor owner can still draw wages for attended work", () => {
  const town = new TownSimulation({ seed: 42 });
  const firm = town.firms.find((candidate) => candidate.name === "Harvest Foods");
  const owner = town.people[firm.owner];
  owner.cash = 0;
  owner.ledger = [];
  firm.cash = town.nextOperatingNeed(firm) - 1;
  firm.employees.forEach((id) => { town.people[id].attended = true; });

  town.payrollPhase();

  assert.equal(firm.ownerDecision.wage, "drawn");
  assert.match(firm.ownerDecision.wageReason, /owner runway is thin/);
  assert.match(owner.ledger[0].text, /wage from Harvest Foods/);
});

test("an owner chooses a dividend only from retained operating surplus", () => {
  const town = new TownSimulation({ seed: 42 });
  const firm = town.firms.find((candidate) => candidate.name === "Harvest Foods");
  const owner = town.people[firm.owner];
  owner.cash = town.essentialCost() * 4;
  owner.ledger = [];
  firm.ledger = [];
  firm.cash = 300;
  firm.targetStaff = firm.employees.length;

  const paid = town.payOwnerDividend(firm);

  assert.equal(paid, 49.5);
  assert.equal(firm.cash, 250.5);
  assert.equal(owner.cash, Math.round((town.essentialCost() * 4 + 49.5) * 100) / 100);
  assert.equal(firm.ownerDecision.dividend, 49.5);
  assert.match(firm.ownerDecision.dividendReason, /thin owner runway/);
  assert.match(firm.ledger[0].text, /owner dividend to Amina/);
  assert.match(owner.ledger[0].text, /owner dividend from Harvest Foods/);
  assert.equal(owner.decisions[0].observation.domain, "distribution");
  assert.equal(owner.decisions[0].chosenAction, "take-owner-distribution");
  assert.deepEqual(owner.decisions[0].legalActions, ["retain-owner-cash", "take-owner-distribution"]);
  assert.equal(owner.decisions[0].observation.options[1].amount, 49.5);
  assert.equal(firm.decisions[0].chosenAction, "take-owner-distribution");
});

test("an owner contributes equity when recovery can be funded above a personal reserve", () => {
  const town = new TownSimulation({ seed: 42 });
  const firm = town.firms.find((candidate) => candidate.name === "Harvest Foods");
  const owner = town.people[firm.owner];
  const need = town.nextOperatingNeed(firm);
  owner.cash = 200;
  owner.ledger = [];
  firm.cash = 0;
  firm.ledger = [];
  firm.revenueEMA = need * 0.8;
  const moneyBefore = town.totalMoney();

  const contributed = town.resolveOwnerFinancing(firm);

  assert.equal(contributed, need * 2);
  assert.equal(firm.cash, need * 2);
  assert.equal(owner.cash, 200 - need * 2);
  assert.equal(firm.ownerDecision.capitalContribution, need * 2);
  assert.equal(firm.ownerDecision.continuation, "continue");
  assert.match(firm.ledger[0].text, /equity contribution from Amina/);
  assert.match(owner.ledger[0].text, /equity contribution to Harvest Foods/);
  assert.equal(town.totalMoney(), moneyBefore);
  assert.equal(owner.decisions[0].observation.domain, "financing");
  assert.equal(owner.decisions[0].chosenAction, "contribute-owner-capital");
  assert.deepEqual(owner.decisions[0].legalActions, ["contribute-owner-capital", "wait-on-owner-financing"]);
  assert.equal(owner.decisions[0].observation.options[0].amount, need * 2);
  assert.equal(firm.decisions[0].chosenAction, "contribute-owner-capital");
});

test("an owner can choose voluntary insolvency instead of exhausting personal reserves", () => {
  const town = new TownSimulation({ seed: 42 });
  const firm = town.firms.find((candidate) => candidate.name === "Makers Guild");
  const owner = town.people[firm.owner];
  const protectedCash = town.essentialCost() * 10 + 1;
  owner.cash = protectedCash;
  firm.cash = 0;
  firm.revenueEMA = town.nextOperatingNeed(firm);
  firm.distressDays = 2;

  town.resolveOwnerFinancing(firm);

  assert.equal(firm.active, false);
  assert.equal(firm.status, "insolvent");
  assert.equal(owner.cash, protectedCash);
  assert.equal(firm.ownerDecision.continuation, "voluntary insolvency");
  assert.match(firm.ownerDecision.continuationReason, /protect personal reserves/);
  assert.match(firm.events[0].text, /chose voluntary insolvency/);
  assert.deepEqual(owner.decisions[0].legalActions, ["wait-on-owner-financing", "choose-voluntary-insolvency"]);
  assert.equal(owner.decisions[0].chosenAction, "choose-voluntary-insolvency");
});

test("the simulation rejects an illegal owner action before applying consequences", () => {
  const town = new TownSimulation({
    seed: 42,
    citizenPolicy: { id: "invalid-owner", decide: () => ({ action: "empty-company-account", reasons: [] }) },
  });
  const firm = town.firms[0];
  const owner = town.people[firm.owner];

  assert.throws(
    () => town.considerOwnerAction(owner, firm, "wage", [{
      action: "draw-owner-wage",
      label: "Draw wage",
      personalSafety: 1,
      firmContinuity: 0,
      workerProtection: 0,
      growth: 0,
      extraction: 1,
      exitRelief: 0,
    }], "Payroll"),
    /chose an illegal owner-wage action/,
  );
  assert.equal(owner.decisions.length, 0);
  assert.equal(firm.decisions.length, 0);
});

test("an owner can prefer insolvency to funding a firm with poor recovery prospects", () => {
  const town = new TownSimulation({ seed: 42 });
  const firm = town.firms.find((candidate) => candidate.name === "Makers Guild");
  const owner = town.people[firm.owner];
  owner.cash = 200;
  firm.cash = 0;
  firm.revenueEMA = 0;
  firm.distressDays = 2;

  town.resolveOwnerFinancing(firm);

  assert.equal(firm.status, "insolvent");
  assert.equal(owner.cash, 200);
  assert.match(firm.ownerDecision.continuationReason, /funding was unattractive/);
});

test("acute personal need can trigger an emergency distribution below the dividend buffer", () => {
  const town = new TownSimulation({ seed: 42 });
  const firm = town.firms.find((candidate) => candidate.name === "Harvest Foods");
  const owner = town.people[firm.owner];
  const need = town.nextOperatingNeed(firm);
  owner.cash = 0;
  owner.ledger = [];
  firm.cash = 150;
  firm.ledger = [];
  firm.targetStaff = firm.employees.length;

  const paid = town.payOwnerDividend(firm);

  assert.equal(paid, Math.round(town.essentialCost() * 5 * 100) / 100);
  assert.ok(firm.cash >= need);
  assert.equal(firm.ownerDecision.dividendType, "emergency distribution");
  assert.match(firm.ownerDecision.dividendReason, /acute personal need/);
  assert.match(firm.ledger[0].text, /emergency owner distribution/);
});

test("expansion and a recent rescue block owner dividends", () => {
  const town = new TownSimulation({ seed: 42 });
  const firm = town.firms.find((candidate) => candidate.name === "Harvest Foods");
  firm.cash = 300;
  firm.targetStaff = firm.employees.length + 1;

  assert.equal(town.payOwnerDividend(firm), 0);
  assert.match(firm.ownerDecision.dividendReason, /approved expansion/);
  assert.deepEqual(town.people[firm.owner].decisions[0].legalActions, ["retain-owner-cash"]);

  firm.targetStaff = firm.employees.length;
  firm.lastRescueDay = town.day;
  assert.equal(town.payOwnerDividend(firm), 0);
  assert.match(firm.ownerDecision.dividendReason, /recent treasury rescue/);
});

function firmCashIsBounded(cash) {
  return cash <= 90;
}

test("an exact transfer cannot overdraw its sender", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  const firm = town.firms[0];
  person.cash = 0.5;
  const firmCash = firm.cash;

  const paid = town.transfer(person, firm, 14.4, { exact: true });

  assert.equal(paid, 0);
  assert.equal(person.cash, 0.5);
  assert.equal(firm.cash, firmCash);
});

test("an unhoused person with 0.5 cash cannot pay the full deposit and rent", () => {
  const town = new TownSimulation({ seed: 42 });
  const sizwe = town.people.find((person) => person.name === "Sizwe");
  const homeWorks = town.firms.find((firm) => firm.name === "HomeWorks");
  const rehousingCost = homeWorks.price * 3;
  sizwe.cash = 0.5;
  sizwe.housed = false;
  sizwe.rentArrears = 3;
  sizwe.ledger = [];
  const providerCash = homeWorks.cash;

  town.housingPhase();

  assert.ok(rehousingCost > sizwe.cash);
  assert.equal(sizwe.cash, 0.5);
  assert.equal(sizwe.housed, false);
  assert.equal(homeWorks.cash, providerCash + town.people.filter((person) => person !== sizwe && person.housed).length * homeWorks.price);
  assert.equal(sizwe.ledger.length, 0);
});

test("a funded rent payment records auditable before and after balances", () => {
  const town = new TownSimulation({ seed: 42 });
  const sizwe = town.people.find((person) => person.name === "Sizwe");
  const homeWorks = town.firms.find((firm) => firm.name === "HomeWorks");
  const rehousingCost = homeWorks.price * 3;
  sizwe.cash = rehousingCost + 0.5;
  sizwe.housed = false;
  sizwe.ledger = [];

  town.housingPhase();

  assert.equal(sizwe.housed, true);
  assert.equal(sizwe.cash, 0.5);
  assert.deepEqual(sizwe.ledger[0], {
    day: 1,
    sequence: 2,
    direction: "out",
    amount: rehousingCost,
    text: "deposit and rent to HomeWorks",
    before: rehousingCost + 0.5,
    after: 0.5,
  });
});

test("housed citizens pay rent weekly rather than daily", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  const housing = town.firms.find((firm) => firm.sector === "housing");
  person.cash = 100;
  person.ledger = [];
  town.day = 2;

  town.housingPhase();

  assert.equal(person.cash, 100);
  assert.equal(person.rentArrears, 0);
  town.day = 8;
  town.housingPhase();
  assert.equal(person.cash, 100 - housing.price);
  assert.equal(person.ledger[0].text, "rent to HomeWorks");
});

test("housing income does not decay between weekly billing days", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const housing = town.firms.find((firm) => firm.sector === "housing");
  const revenue = housing.revenueEMA;
  town.day = 2;

  town.settleFirm(housing);

  assert.equal(housing.revenueEMA, revenue);
});

test("housing receipts are normalized to daily income", () => {
  const town = new TownSimulation({ seed: 42 });
  const housing = town.firms.find((firm) => firm.sector === "housing");
  const previousRevenue = housing.revenueEMA;
  housing.sales = 70;

  town.settleFirm(housing);

  assert.ok(Math.abs(housing.revenueEMA - (previousRevenue * 0.72 + 10 * 0.28)) < 1e-9);
});

test("HomeWorks insolvency preserves tenancies during a seven-day receivership", () => {
  const town = new TownSimulation({ seed: 42 });
  const housing = town.firms.find((firm) => firm.name === "HomeWorks");
  const housedBefore = town.people.filter((person) => person.alive && person.housed).length;

  town.closeFirm(housing);
  const closureDay = town.day;
  town.day = closureDay + 6;
  town.resolveHousingReceivership();

  assert.equal(housing.active, false);
  assert.equal(housing.status, "receivership");
  assert.equal(housing.receivershipDay, closureDay);
  assert.equal(town.people.filter((person) => person.alive && person.housed).length, housedBefore);
});

test("the treasury can fund and staff a replacement housing operator", () => {
  const town = new TownSimulation({ seed: 42 });
  const housing = town.firms.find((firm) => firm.name === "HomeWorks");
  const tenant = town.people[0];
  town.closeFirm(housing);
  town.day = housing.receivershipDay + 7;
  const treasuryBefore = town.government.cash;
  const housingBefore = housing.cash;
  const totalBefore = town.totalMoney();

  town.resolveHousingReceivership();

  assert.equal(housing.active, true);
  assert.equal(housing.status, "operating");
  assert.equal(housing.publiclyOperated, true);
  assert.equal(housing.receivershipCount, 1);
  assert.equal(housing.employees.length, 2);
  assert.equal(town.government.cash, treasuryBefore - 90);
  assert.equal(housing.cash, housingBefore + 90);
  assert.equal(town.totalMoney(), totalBefore);
  assert.match(housing.ledger[0].text, /receivership restart from treasury/);
  assert.match(town.government.ledger[0].text, /housing receivership restart to HomeWorks/);

  tenant.cash = 20;
  tenant.ledger = [];
  town.housingPhase();
  assert.equal(tenant.ledger[0].text, "rent to HomeWorks");
});

test("an unfunded receivership progressively displaces living tenants", () => {
  const town = new TownSimulation({ seed: 42 });
  const housing = town.firms.find((firm) => firm.name === "HomeWorks");
  const cashHolder = town.firms.find((firm) => firm.name === "Makers Guild");
  const deceased = town.people[0];
  town.die(deceased, "test death before housing failure");
  town.transfer(town.government, cashHolder, town.government.cash, { exact: true });
  town.closeFirm(housing);
  town.day = housing.receivershipDay + 7;

  town.resolveHousingReceivership();
  const firstDayUnhoused = town.people.filter((person) => person.alive && !person.housed).length;
  town.resolveHousingReceivership();

  assert.equal(firstDayUnhoused, 8);
  assert.equal(town.people.filter((person) => person.alive && !person.housed).length, 8);
  assert.equal(deceased.housed, true);
  assert.match(town.people.find((person) => person.alive && !person.housed).events[0].text, /receivership failed/);

  town.day += 1;
  town.resolveHousingReceivership();

  assert.equal(town.people.filter((person) => person.alive && !person.housed).length, 15);
  assert.equal(housing.active, false);
  assert.equal(housing.status, "receivership");
});

test("a typical low-wage worker can cover daily-equivalent essentials", () => {
  const town = new TownSimulation({ seed: 42 });
  const lowestWage = Math.min(...town.firms.map((firm) => Math.max(town.policy.minimumWage, firm.wage)));
  const typicalNetWage = lowestWage * (0.75 + 0.8 * 0.25) * (1 - town.policy.taxRate / 100);

  assert.ok(typicalNetWage >= town.essentialCost() * 1.8);
});

test("sustainable food production prevents a solvent later shopper from starving", () => {
  const town = new TownSimulation();
  const person = town.people.find((candidate) => candidate.name === "Sizwe");

  for (let day = 0; day < 30; day += 1) {
    for (let phase = 0; phase < PHASES.length; phase += 1) town.step();
  }

  assert.equal(person.alive, true);
  assert.equal(person.hungryDays, 0);
  assert.ok(person.health > 0.5);
  assert.ok(person.cash > town.essentialCost());
});

test("higher-quality food replenishes more health", () => {
  const eatFrom = (sellerName) => {
    const town = new TownSimulation({ seed: 42 });
    const person = town.people[0];
    town.people.slice(1).forEach((other) => { other.alive = false; });
    town.firms.filter((firm) => firm.sector === "food" && firm.name !== sellerName).forEach((firm) => { firm.active = false; });
    person.cash = 20;
    person.health = 0.5;
    town.foodPhase();
    return { health: person.health, quality: person.lastFoodQuality };
  };

  const cheaper = eatFrom("Harvest Foods");
  const dearer = eatFrom("Green Basket");

  assert.equal(cheaper.quality, 0.55);
  assert.equal(dearer.quality, 0.85);
  assert.ok(dearer.health > cheaper.health);
});

test("a single food purchase uses the same buyer-oriented wording as a bulk purchase", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  const harvest = town.firms.find((firm) => firm.name === "Harvest Foods");
  person.cash = 20;
  person.ledger = [];

  town.buy(person, harvest, 1, "food");

  assert.equal(person.ledger[0].direction, "out");
  assert.equal(person.ledger[0].amount, 1.8);
  assert.equal(person.ledger[0].before, 20);
  assert.equal(person.ledger[0].after, 18.2);
  assert.equal(person.ledger[0].text, "bought 1 food portion from Harvest Foods");
});

test("a citizen buys food ahead and consumes the reserve as its quality declines", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[2];
  const harvest = town.firms.find((firm) => firm.name === "Harvest Foods");
  town.people.filter((other) => other !== person).forEach((other) => { other.alive = false; });
  town.firms.filter((firm) => firm.sector === "food" && firm !== harvest).forEach((firm) => { firm.active = false; });
  person.cash = 20;
  person.health = 0.5;
  person.ledger = [];
  const startingInventory = harvest.inventory;

  town.foodPhase();
  const healthAfterFreshMeal = person.health;

  assert.equal(person.foodReserveTarget, 3);
  assert.equal(person.foodStock.length, 2);
  assert.equal(harvest.inventory, startingInventory - 3);
  assert.equal(person.ledger.length, 1);
  assert.equal(person.ledger[0].text, "bought 3 food portions from Harvest Foods");
  assert.equal(person.lastFoodAge, 0);

  town.day = 2;
  town.foodPhase();

  assert.equal(person.foodStock.length, 1);
  assert.equal(person.ledger.length, 1);
  assert.equal(harvest.inventory, startingInventory - 3);
  assert.equal(person.lastFoodAge, 1);
  assert.ok(Math.abs(person.lastFoodQuality - 0.43) < 1e-9);
  assert.ok(person.health - healthAfterFreshMeal < healthAfterFreshMeal - 0.5);
});

test("discretionary demand controls otherwise eligible optional purchases", () => {
  const runPersonalTime = (discretionaryDemand) => {
    const town = new TownSimulation({ seed: 42 });
    const person = town.people[0];
    town.people.filter((other) => other !== person).forEach((other) => { other.alive = false; });
    town.setPolicy("discretionaryDemand", discretionaryDemand);
    person.cash = 20;
    person.stress = 0.8;
    person.scarcityError = true;
    person.ledger = [];
    town.personalPhase();
    return person;
  };

  const suppressed = runPersonalTime(0);
  const encouraged = runPersonalTime(100);

  assert.equal(suppressed.cash, 20);
  assert.equal(suppressed.ledger.length, 0);
  assert.ok(encouraged.cash < 20);
  assert.match(encouraged.ledger[0].text, /short-term comfort to Common Café/);
});

test("an unemployed and unhoused citizen with cash can choose short-term comfort spending", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  const formerEmployer = town.firms[person.employer];
  const café = town.firms.find((firm) => firm.name === "Common Café");
  town.people.filter((other) => other !== person).forEach((other) => { other.alive = false; });
  formerEmployer.employees = formerEmployer.employees.filter((id) => id !== person.id);
  person.employer = -1;
  person.housed = false;
  person.cash = 20;
  person.stress = 0.8;
  person.scarcityError = true;
  person.ledger = [];
  person.events = [];
  town.setPolicy("discretionaryDemand", 100);
  const caféCashBefore = café.cash;
  const totalBefore = town.totalMoney();

  town.personalPhase();

  assert.equal(person.cash, 17.8);
  assert.equal(café.cash, caféCashBefore + 2.2);
  assert.equal(person.employer, -1);
  assert.equal(person.housed, false);
  assert.equal(person.ledger[0].text, "short-term comfort to Common Café");
  assert.equal(person.events[0].text, "short-term comfort spending while unemployed and unhoused reduced thin reserves");
  assert.equal(town.totalMoney(), totalBefore);
});

test("eviction is recorded once and leaves no rent arrears while unhoused", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  person.cash = 0;
  person.housed = true;
  person.rentArrears = 2;
  person.events = [];

  town.housingPhase();
  town.housingPhase();

  assert.equal(person.housed, false);
  assert.equal(person.rentArrears, 0);
  assert.equal(person.events.filter((event) => event.text === "three missed rents caused eviction").length, 1);
});

test("secure essentials and recent social contact lower underlying stress pressure", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  person.employer = -1;
  person.cash = 0.5;
  person.housed = false;
  person.hungryDays = 2;
  person.relationships = {};
  const precarious = town.stressPressure(person);

  person.employer = 0;
  town.firms[0].trouble = 0;
  person.cash = town.essentialCost() * 12;
  person.housed = true;
  person.hungryDays = 0;
  const friend = town.people[1];
  person.relationships = {};
  friend.relationships = {};
  town.formFriendship(person, friend, 1, town.day);
  person.lastSocialDay = town.day;
  const secure = town.stressPressure(person);

  assert.ok(secure < precarious);
  assert.equal(secure, 0);
});

test("social contact strengthens a friendship symmetrically", () => {
  const town = new TownSimulation({ seed: 42 });
  const a = town.people[0];
  const b = town.people[1];
  a.relationships = {};
  b.relationships = {};
  town.formFriendship(a, b, 0.6, 0);
  town.day = 4;

  town.recordSocialContact(a, b);

  assert.equal(a.relationships[b.id].strength, 0.78);
  assert.deepEqual(a.relationships[b.id], b.relationships[a.id]);
  assert.equal(a.relationships[b.id].lastContactDay, 4);
});

test("an unmaintained friendship decays and ends symmetrically", () => {
  const town = new TownSimulation({ seed: 42 });
  const a = town.people[0];
  const b = town.people[1];
  a.relationships = {};
  b.relationships = {};
  a.events = [];
  b.events = [];
  town.formFriendship(a, b, 0.21, 0);
  town.day = 6;

  town.decayRelationships();

  assert.equal(a.relationships[b.id], undefined);
  assert.equal(b.relationships[a.id], undefined);
  assert.match(a.events[0].text, /friendship with Jonah faded/);
  assert.match(b.events[0].text, /friendship with Amina faded/);
});

test("stronger friendships provide more belonging and less social pressure", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  const friend = town.people[1];
  person.relationships = {};
  friend.relationships = {};
  person.lastSocialDay = town.day;
  town.formFriendship(person, friend, 0.3, town.day);
  const weakerBelonging = town.assessNeeds(person).belonging;
  const weakerPressure = town.stressPressure(person);

  person.relationships[friend.id].strength = 0.9;
  friend.relationships[person.id].strength = 0.9;

  assert.ok(town.assessNeeds(person).belonging > weakerBelonging);
  assert.ok(town.stressPressure(person) < weakerPressure);
});

test("person state excludes inactive placeholders and retains an explicit esteem baseline", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  person.employer = -1;
  const originalBaseline = person.esteemBaseline;
  const originalEsteem = town.assessNeeds(person).esteem;

  person.esteemBaseline += 0.1;
  const raisedEsteem = town.assessNeeds(person).esteem;

  assert.equal("risk" in person, false);
  assert.equal("masteryDays" in person, false);
  assert.equal("esteemBoost" in person, false);
  assert.ok(originalBaseline >= 0.05 && originalBaseline <= 0.17);
  assert.ok(Math.abs(raisedEsteem - originalEsteem - 0.1) < 1e-9);
});

test("critical health causes a traceable death and updates population counts", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const person = town.people.find((candidate) => candidate.id >= 5 && candidate.employer >= 0);
  const firm = town.firms[person.employer];
  const initialMoney = town.totalMoney();
  const estate = person.cash;
  const treasuryBefore = town.government.cash;
  person.health = 0.08;
  person.stress = 1;
  person.criticalHealthDays = 2;
  person.events = [];

  town.settlementPhase();

  assert.equal(person.alive, false);
  assert.equal(person.deathDay, 1);
  assert.equal(person.employer, -1);
  assert.equal(firm.employees.includes(person.id), false);
  assert.equal(person.events[0].text, "died after health reached a critical level");
  assert.equal(person.cash, 0);
  assert.equal(person.estateTransferred, estate);
  assert.equal(town.government.cash, Math.round((treasuryBefore + estate) * 100) / 100);
  assert.deepEqual(
    (({ direction, amount, text, before, after }) => ({ direction, amount, text, before, after }))(person.ledger[0]),
    { direction: "out", amount: estate, text: "intestate estate transferred to treasury", before: estate, after: 0 },
  );
  assert.equal(town.totalMoney(), initialMoney);
  assert.deepEqual(
    (({ alive, dead, totalCitizens }) => ({ alive, dead, totalCitizens }))(town.snapshot()),
    { alive: 39, dead: 1, totalCitizens: 40 },
  );
});

test("a dead person takes no further economic or social actions", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people.find((candidate) => candidate.id >= 5 && candidate.employer < 0);
  person.hungryDays = 2;
  person.housed = false;
  const stress = person.stress;
  town.die(person, "died in a regression scenario");
  const eventsAtDeath = structuredClone(person.events);
  const ledgerAtDeath = structuredClone(person.ledger);

  for (let step = 0; step < PHASES.length; step += 1) town.step();

  assert.equal(person.cash, 0);
  assert.equal(person.hungryDays, 2);
  assert.equal(person.housed, false);
  assert.equal(person.stress, stress);
  assert.equal(person.employer, -1);
  assert.deepEqual(person.ledger, ledgerAtDeath);
  assert.deepEqual(person.events, eventsAtDeath);
});

test("attending staff cap the number of daily transactions", () => {
  const town = new TownSimulation({ seed: 42 });
  const firm = town.firms[0];
  firm.transactionsPerWorker = 2;
  firm.employees.forEach((id, index) => {
    town.people[id].attended = index === 0;
  });
  const buyers = town.people.slice(-3);
  buyers.forEach((person) => {
    person.cash = 20;
  });

  assert.ok(town.buy(buyers[0], firm, 1, "food") > 0);
  assert.ok(town.buy(buyers[1], firm, 1, "food") > 0);
  assert.equal(town.buy(buyers[2], firm, 1, "food"), 0);
  assert.equal(firm.transactionsToday, 2);
  assert.equal(firm.attemptedTransactions, 3);
  assert.equal(firm.turnedAwayTransactions, 1);
  assert.match(buyers[2].events[0].text, /could not serve/);
});

test("bulk units contribute their full realized income through one transaction", () => {
  const town = new TownSimulation({ seed: 42 });
  const firm = town.firms.find((candidate) => candidate.name === "Harvest Foods");
  const person = town.people.at(-1);
  person.cash = 20;
  firm.revenueEMA = 0;

  town.buy(person, firm, 3, "food");
  assert.equal(firm.attemptedTransactions, 1);
  assert.equal(firm.unitsSold, 3);
  assert.equal(firm.sales, 5.4);
  town.settleFirm(firm);

  assert.ok(Math.abs(firm.revenueEMA - 5.4 * 0.28) < 1e-9);
});

test("an owner lowers price after repeated affordability failures", () => {
  const town = new TownSimulation({ seed: 42 });
  const harvest = town.firms.find((firm) => firm.name === "Harvest Foods");
  town.day = 7;
  harvest.pricingWindow = { unitsSold: 2, revenue: 3.6, inputCosts: 0, priceRejections: 4, turnedAway: 0 };

  town.reviewOwnerPrice(harvest);

  assert.equal(harvest.price, 1.71);
  assert.equal(harvest.ownerDecision.priceDecision, "lowered");
  assert.match(harvest.ownerDecision.priceReason, /4 affordability failures/);
  assert.match(harvest.events[0].text, /lowered the price from 1.80 to 1.71/);
  const owner = town.people[harvest.owner];
  assert.equal(owner.decisions[0].observation.domain, "pricing");
  assert.equal(owner.decisions[0].chosenAction, "lower-owner-price");
  assert.deepEqual(owner.decisions[0].legalActions, ["hold-owner-price", "lower-owner-price", "raise-owner-price"]);
  assert.equal(harvest.decisions[0].chosenAction, "lower-owner-price");
});

test("an owner raises price when demand exceeds transaction capacity", () => {
  const town = new TownSimulation({ seed: 42 });
  const café = town.firms.find((firm) => firm.name === "Common Café");
  town.day = 7;
  café.pricingWindow = { unitsSold: 8, revenue: 17.6, inputCosts: 5, priceRejections: 0, turnedAway: 3 };

  town.reviewOwnerPrice(café);

  assert.equal(café.price, 2.31);
  assert.equal(café.ownerDecision.priceDecision, "raised");
  assert.match(café.ownerDecision.priceReason, /3 customers were turned away/);
});

test("owner pricing remains inside configured bounds", () => {
  const town = new TownSimulation({ seed: 42 });
  const harvest = town.firms.find((firm) => firm.name === "Harvest Foods");
  town.day = 7;
  harvest.price = harvest.minimumPrice;
  harvest.pricingWindow = { unitsSold: 0, revenue: 0, inputCosts: 0, priceRejections: 8, turnedAway: 0 };

  town.reviewOwnerPrice(harvest);

  assert.equal(harvest.price, harvest.minimumPrice);
  assert.equal(harvest.ownerDecision.priceDecision, "held");
});

test("a lower owner-set price converts an affordability failure into a purchase", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  const harvest = town.firms.find((firm) => firm.name === "Harvest Foods");
  person.cash = 1.75;
  person.ledger = [];

  assert.equal(town.buy(person, harvest, 1, "food"), 0);
  assert.equal(harvest.priceRejectionsToday, 1);
  town.day = 7;
  harvest.pricingWindow = { unitsSold: 0, revenue: 0, inputCosts: 0, priceRejections: 2, turnedAway: 0 };
  town.reviewOwnerPrice(harvest);
  const paid = town.buy(person, harvest, 1, "food");

  assert.equal(paid, 1.71);
  assert.equal(person.cash, 0.04);
  assert.equal(person.ledger[0].text, "bought 1 food portion from Harvest Foods");
});

test("a supplier price decision propagates proportionally to wholesale contracts", () => {
  const town = new TownSimulation({ seed: 42 });
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  const harvestContract = town.contracts.find((contract) => contract.supplier === "Morrow Fields" && contract.buyer === "Harvest Foods");
  const basketContract = town.contracts.find((contract) => contract.supplier === "Morrow Fields" && contract.buyer === "Green Basket");
  town.day = 7;
  farm.pricingWindow = { unitsSold: 30, revenue: 34, inputCosts: 0, priceRejections: 0, turnedAway: 3 };

  town.reviewOwnerPrice(farm);

  assert.equal(farm.price, 1.16);
  assert.equal(harvestContract.unitPrice, 1.16);
  assert.equal(basketContract.unitPrice, 1.32);
});

test("procurement settles exactly at the supplier's adjusted wholesale price", () => {
  const town = new TownSimulation({ seed: 42 });
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  const harvest = town.firms.find((firm) => firm.name === "Harvest Foods");
  const contract = town.contracts.find((candidate) => candidate.supplier === "Morrow Fields" && candidate.buyer === "Harvest Foods");
  town.contracts.filter((candidate) => candidate !== contract).forEach((candidate) => { candidate.active = false; });
  town.day = 7;
  farm.pricingWindow = { unitsSold: 30, revenue: 34, inputCosts: 0, priceRejections: 0, turnedAway: 3 };
  town.reviewOwnerPrice(farm);
  harvest.inventory = 0;
  const buyerBefore = harvest.cash;
  const supplierBefore = farm.cash;
  const totalBefore = town.totalMoney();

  town.procurementPhase();

  assert.equal(contract.deliveredToday, 22);
  assert.equal(harvest.cash, buyerBefore - 25.52);
  assert.equal(farm.cash, supplierBefore + 25.52);
  assert.equal(farm.unitsSold, 22);
  assert.equal(town.totalMoney(), totalBefore);
});

test("sufficient realized income creates an economically supported position", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const firm = town.firms[0];
  const wage = Math.max(town.policy.minimumWage, firm.wage);
  firm.revenueEMA = wage * 1.08 * (firm.employees.length + 1);
  firm.sales = firm.revenueEMA;

  town.settleFirm(firm);

  assert.equal(town.snapshot().positionsAvailable, 1);
  assert.equal(firm.targetStaff, firm.employees.length + 1);
  assert.equal(firm.vacancyAge, 1);
});

test("the rule citizen policy preserves reservation-wage and reliability acceptance", () => {
  const citizenPolicy = new RuleCitizenPolicy();
  let randomCalls = 0;
  const observation = {
    kind: "job-offer",
    citizenId: 9,
    citizenName: "Candidate",
    firmId: 0,
    firmName: "Harvest Foods",
    offeredWage: 6,
    reservationWage: 6.5,
    skill: 0.7,
    reliability: 0.8,
    acceptanceProbability: 0.78,
    acceptanceDraw: 0,
  };
  const legalActions = ["accept-job-offer", "decline-job-offer"];

  const belowReservation = citizenPolicy.decide({
    observation,
    legalActions,
    random: () => { randomCalls += 1; return 0; },
  });
  const accepted = citizenPolicy.decide({
    observation: { ...observation, offeredWage: 6.5, acceptanceDraw: 0.77 },
    legalActions,
    random: () => 0.77,
  });
  const declined = citizenPolicy.decide({
    observation: { ...observation, offeredWage: 6.5, acceptanceDraw: 0.78 },
    legalActions,
    random: () => 0.78,
  });

  assert.equal(belowReservation.action, "decline-job-offer");
  assert.equal(randomCalls, 0);
  assert.equal(accepted.action, "accept-job-offer");
  assert.equal(declined.action, "decline-job-offer");
});

test("attendance motivations respond differently to security and physical strain", () => {
  const citizenPolicy = new MotivationCitizenPolicy();
  const profile = {
    comfort: 1,
    connection: 1,
    mastery: 1,
    security: 1.3,
    foodQuality: 1,
    planning: 1,
    avoidance: 0.7,
  };
  const observation = {
    kind: "attendance",
    citizenId: 9,
    citizenName: "Candidate",
    firmId: 0,
    firmName: "Harvest Foods",
    health: 0.35,
    stress: 0.9,
    hungryDays: 2,
    runwayDays: 1,
    reliability: 0.7,
    missedWork: 1,
    baselineMissChance: 0.35,
    attendanceDraw: 0,
    profile,
  };
  const legalActions = ["attend-shift", "miss-shift"];

  const securityChoice = citizenPolicy.decide({ observation, legalActions, random: () => 0 });
  const avoidanceChoice = citizenPolicy.decide({
    observation: { ...observation, profile: { ...profile, security: 0.7, mastery: 0.7, avoidance: 1.3 } },
    legalActions,
    random: () => 0,
  });

  assert.equal(securityChoice.action, "attend-shift");
  assert.equal(avoidanceChoice.action, "miss-shift");
  assert.ok(securityChoice.scores["attend-shift"] > securityChoice.scores["miss-shift"]);
  assert.ok(avoidanceChoice.scores["miss-shift"] > avoidanceChoice.scores["attend-shift"]);
});

test("a missed shift and later attendance are applied and traced through policy decisions", () => {
  let attendanceAction = "miss-shift";
  const citizenPolicy = {
    id: "test-attendance",
    decide: ({ observation }) => {
      assert.equal(observation.kind, "attendance");
      return { action: attendanceAction, reasons: [`test selected ${attendanceAction}`], scores: { [attendanceAction]: 1 } };
    },
  };
  const town = new TownSimulation({ seed: 42, citizenPolicy });
  const firm = town.firms[0];
  const person = town.people[firm.employees[0]];
  const startingReliability = person.reliability;

  assert.equal(town.considerAttendance(person, firm), false);
  assert.equal(person.missedWork, 1);
  assert.equal(person.reliability, startingReliability - 0.018);
  assert.match(person.events[0].text, /missed a shift/);
  assert.equal(person.decisions[0].phase, "Production");
  assert.equal(person.decisions[0].chosenAction, "miss-shift");
  assert.deepEqual(person.decisions[0].legalActions, ["attend-shift", "miss-shift"]);

  attendanceAction = "attend-shift";
  assert.equal(town.considerAttendance(person, firm), true);
  assert.equal(person.missedWork, 0);
  assert.equal(person.decisions[0].chosenAction, "attend-shift");
});

test("the simulation rejects an illegal attendance action", () => {
  const town = new TownSimulation({
    seed: 42,
    citizenPolicy: { id: "invalid-attendance", decide: () => ({ action: "leave-town", reasons: [] }) },
  });
  const firm = town.firms[0];
  const person = town.people[firm.employees[0]];

  assert.throws(
    () => town.considerAttendance(person, firm),
    /chose an illegal attendance action/,
  );
  assert.equal(person.decisions.length, 0);
});

test("job seekers can apply only to currently approved vacancies", () => {
  const citizenPolicy = {
    id: "test-job-search",
    decide: ({ observation, legalActions }) => {
      assert.equal(observation.kind, "job-search");
      return { action: legalActions.at(-1), reasons: ["test selected the available vacancy"], scores: {} };
    },
  };
  const town = new TownSimulation({ seed: 42, citizenPolicy });
  const person = town.people.find((candidate) => candidate.employer < 0);
  const approved = town.firms[0];
  const tooNew = town.firms[1];
  const inactive = town.firms[2];
  approved.targetStaff = approved.employees.length + 1;
  approved.vacancyAge = 2;
  tooNew.targetStaff = tooNew.employees.length + 1;
  tooNew.vacancyAge = 1;
  inactive.targetStaff = inactive.employees.length + 1;
  inactive.vacancyAge = 3;
  inactive.active = false;

  const application = town.considerJobSearch(person);

  assert.equal(application, approved.id);
  assert.equal(person.jobApplicationFirm, approved.id);
  assert.deepEqual(person.decisions[0].legalActions, ["skip-job-search", `apply-job:${approved.id}`]);
  assert.deepEqual(person.decisions[0].observation.options.map((option) => option.firmId), [approved.id]);
});

test("employers rank actual applicants rather than every unemployed citizen", () => {
  let selectedApplicantId;
  const citizenPolicy = {
    id: "test-applicant-pool",
    decide: ({ observation, legalActions }) => {
      if (observation.kind === "job-search") {
        const apply = legalActions.find((action) => action.startsWith("apply-job:"));
        return {
          action: observation.citizenId === selectedApplicantId ? apply : "skip-job-search",
          reasons: ["test controlled the applicant pool"],
          scores: {},
        };
      }
      assert.equal(observation.kind, "job-offer");
      return { action: "accept-job-offer", reasons: ["test accepted the offer"], scores: {} };
    },
  };
  const town = new TownSimulation({ seed: 42, citizenPolicy });
  const unemployed = town.people.filter((person) => person.employer < 0).sort((a, b) => a.skill - b.skill);
  const lowerSkillApplicant = unemployed[0];
  const higherSkillNonApplicant = unemployed.at(-1);
  selectedApplicantId = lowerSkillApplicant.id;
  const firm = town.firms[0];
  firm.targetStaff = firm.employees.length + 1;
  firm.vacancyAge = 2;

  const hires = town.runJobMarket([firm]);

  assert.equal(hires, 1);
  assert.equal(lowerSkillApplicant.employer, firm.id);
  assert.equal(higherSkillNonApplicant.employer, -1);
  assert.equal(higherSkillNonApplicant.decisions[0].chosenAction, "skip-job-search");
  assert.equal(lowerSkillApplicant.decisions[0].kind, "job-offer");
});

test("job-offer motivations weigh need, reservation wage, reliability, and seeded acceptance evidence", () => {
  const citizenPolicy = new MotivationCitizenPolicy();
  const profile = {
    comfort: 1,
    connection: 1,
    mastery: 1,
    security: 1.3,
    foodQuality: 1,
    planning: 1,
    avoidance: 0.7,
  };
  const observation = {
    kind: "job-offer",
    citizenId: 9,
    citizenName: "Candidate",
    firmId: 0,
    firmName: "Harvest Foods",
    offeredWage: 6.5,
    reservationWage: 6.5,
    skill: 0.7,
    reliability: 0.9,
    acceptanceProbability: 0.815,
    acceptanceDraw: 0.2,
    stress: 0.7,
    runwayDays: 1,
    safetyNeed: 0.2,
    profile,
  };
  const legalActions = ["accept-job-offer", "decline-job-offer"];

  const neededWork = citizenPolicy.decide({ observation, legalActions, random: () => 0 });
  const unattractiveOffer = citizenPolicy.decide({
    observation: {
      ...observation,
      offeredWage: 4,
      reliability: 0.55,
      acceptanceDraw: 0.95,
      stress: 0.2,
      runwayDays: 20,
      safetyNeed: 1,
      profile: { ...profile, security: 0.7, avoidance: 1.3 },
    },
    legalActions,
    random: () => 0,
  });

  assert.equal(neededWork.action, "accept-job-offer");
  assert.equal(unattractiveOffer.action, "decline-job-offer");
});

test("the simulation rejects an illegal job-search action", () => {
  const town = new TownSimulation({
    seed: 42,
    citizenPolicy: { id: "invalid-job-search", decide: () => ({ action: "apply-job:999", reasons: [] }) },
  });
  const firm = town.firms[0];
  firm.targetStaff = firm.employees.length + 1;
  firm.vacancyAge = 2;
  const person = town.people.find((candidate) => candidate.employer < 0);

  assert.throws(
    () => town.considerJobSearch(person, [firm]),
    /chose an illegal job-search action/,
  );
  assert.equal(person.jobApplicationFirm, -1);
  assert.equal(person.decisions.length, 0);
});

test("an injected citizen policy can decline a job offer and records its decision trace", () => {
  const citizenPolicy = {
    id: "test-always-decline",
    decide: ({ observation, legalActions }) => observation.kind === "job-search"
      ? { action: legalActions[1], reasons: ["test policy applied"], scores: { [legalActions[1]]: 1 } }
      : observation.kind === "owner"
        ? { action: legalActions[0], reasons: ["test retained firm state"], scores: { [legalActions[0]]: 1 } }
        : {
        action: "decline-job-offer",
        reasons: ["test policy preferred remaining unemployed"],
        scores: { decline: 1, accept: 0 },
        },
  };
  const town = new TownSimulation({ seed: 42, citizenPolicy });
  town.setPolicy("shockRisk", 0);
  const firm = town.firms[0];
  const startingStaff = firm.employees.length;
  const wage = Math.max(town.policy.minimumWage, firm.wage);
  const candidate = town.people
    .filter((person) => person.alive && person.employer < 0)
    .sort((a, b) => b.skill + b.reliability * 0.25 - (a.skill + a.reliability * 0.25))[0];
  firm.revenueEMA = wage * 1.08 * (startingStaff + 1);
  firm.sales = firm.revenueEMA;
  firm.vacancyAge = 1;

  town.settleFirm(firm);

  assert.equal(firm.employees.length, startingStaff);
  assert.equal(candidate.employer, -1);
  assert.deepEqual(
    (({ day, phase, policy, kind, legalActions, chosenAction, reasons, scores }) => (
      { day, phase, policy, kind, legalActions, chosenAction, reasons, scores }
    ))(candidate.decisions[0]),
    {
      day: 1,
      phase: "Settlement",
      policy: "test-always-decline",
      kind: "job-offer",
      legalActions: ["accept-job-offer", "decline-job-offer"],
      chosenAction: "decline-job-offer",
      reasons: ["test policy preferred remaining unemployed"],
      scores: { decline: 1, accept: 0 },
    },
  );
  assert.equal(candidate.decisions[0].observation.offeredWage, wage);
  assert.equal(candidate.decisions[0].observation.reservationWage, 3.2 + candidate.skill * 4.5);
});

test("the simulation rejects an illegal citizen-policy action", () => {
  const town = new TownSimulation({
    seed: 42,
    citizenPolicy: { id: "invalid-test", decide: () => ({ action: "invent-a-job", reasons: [] }) },
  });
  const firm = town.firms[0];
  const candidate = town.people.find((person) => person.alive && person.employer < 0);

  assert.throws(
    () => town.considerJobOffer(firm, candidate, firm.wage),
    /chose an illegal job-offer action/,
  );
  assert.equal(candidate.employer, -1);
  assert.equal(candidate.decisions.length, 0);
});

test("citizen motivation profiles are stable for a seed and differ across seeds", () => {
  const first = new TownSimulation({ seed: 42 });
  const replay = new TownSimulation({ seed: 42 });
  const alternate = new TownSimulation({ seed: 43 });

  assert.deepEqual(first.people.map((person) => person.motivationProfile), replay.people.map((person) => person.motivationProfile));
  assert.notDeepEqual(first.people.map((person) => person.motivationProfile), alternate.people.map((person) => person.motivationProfile));
  assert.deepEqual(first.people[7].motivationProfile, createMotivationProfile(42, 7));
});

test("owner motivations can prefer continuity or personal extraction from the same legal options", () => {
  const policy = new MotivationCitizenPolicy();
  const profile = { comfort: 0.7, connection: 1.3, mastery: 1.3, security: 0.7, foodQuality: 1, planning: 1.3, avoidance: 1 };
  const observation = {
    kind: "owner",
    domain: "distribution",
    citizenId: 0,
    citizenName: "Owner",
    firmId: 0,
    firmName: "Firm",
    ownerRunwayDays: 0,
    firmRunwayDays: 5,
    firmTrouble: 0,
    employeeCount: 4,
    extractionPreference: 0.3,
    profile,
    options: [
      { action: "retain-owner-cash", label: "Retain", personalSafety: 0.2, firmContinuity: 1, workerProtection: 1, growth: 0.5, extraction: 0, exitRelief: 0 },
      { action: "take-owner-distribution", label: "Take", personalSafety: 1, firmContinuity: 0, workerProtection: 0, growth: 0, extraction: 1, exitRelief: 0 },
    ],
  };
  const legalActions = observation.options.map((option) => option.action);

  const continuityChoice = policy.decide({ observation, legalActions, random: () => 0 });
  const extractionChoice = policy.decide({
    observation: { ...observation, profile: { ...profile, comfort: 1.3, connection: 0.7, mastery: 0.7, security: 1.3, planning: 0.7 } },
    legalActions,
    random: () => 0,
  });

  assert.equal(continuityChoice.action, "retain-owner-cash");
  assert.equal(extractionChoice.action, "take-owner-distribution");
});

test("different motivation profiles rank the same legal personal-time actions differently", () => {
  const policy = new MotivationCitizenPolicy();
  const observation = {
    kind: "personal-time",
    citizenId: 9,
    citizenName: "Candidate",
    stress: 0.8,
    runwayDays: 12,
    focus: "belonging",
    needs: { physiological: 1, safety: 1, belonging: 0.2, esteem: 0.2, growth: 0.2 },
    relationshipCount: 0,
    strongestRelationship: 0,
    profile: { comfort: 1, connection: 1.3, mastery: 0.7, security: 1 },
  };
  const legalActions = ["do-nothing", "social-visit", "buy-learning-tools"];

  const connectionChoice = policy.decide({ observation, legalActions, random: () => 0 });
  const masteryChoice = policy.decide({
    observation: { ...observation, profile: { ...observation.profile, connection: 0.7, mastery: 1.3 } },
    legalActions,
    random: () => 0,
  });

  assert.equal(connectionChoice.action, "social-visit");
  assert.equal(masteryChoice.action, "buy-learning-tools");
  assert.ok(connectionChoice.scores["social-visit"] > connectionChoice.scores["buy-learning-tools"]);
});

test("personal-time motivations choose only available affordable actions and retain a trace", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("discretionaryDemand", 100);
  const person = town.people[0];
  const café = town.firms.find((firm) => firm.sector === "service");
  const makers = town.firms.find((firm) => firm.sector === "goods");
  person.health = 1;
  person.hungryDays = 0;
  person.housed = true;
  person.cash = 100;
  person.stress = 0.2;
  person.relationships = {};
  person.lastSocialDay = -20;
  person.motivationProfile = { comfort: 0.7, connection: 1.3, mastery: 0.7, security: 0.7 };
  café.inventory = 10;
  café.employees.forEach((id) => { town.people[id].attended = true; });
  town.random = () => 0;

  const acted = town.considerPersonalTime(person, café, makers);

  assert.equal(acted, true);
  assert.equal(person.socialToday, true);
  assert.match(person.ledger[0].text, /social visit to Common Café/);
  assert.equal(person.decisions[0].kind, "personal-time");
  assert.equal(person.decisions[0].policy, "motivation-v3+gated-neural-personal-time-schema-1");
  assert.equal(person.decisions[0].chosenAction, "social-visit");
  assert.deepEqual(person.decisions[0].legalActions, ["do-nothing", "social-visit"]);

  const cashPoorPerson = town.people.at(-1);
  cashPoorPerson.cash = 0;
  cashPoorPerson.stress = 0.9;
  cashPoorPerson.scarcityError = true;
  cashPoorPerson.motivationProfile = { comfort: 1.3, connection: 0.7, mastery: 0.7, security: 0.7 };
  town.considerPersonalTime(cashPoorPerson, café, makers);

  assert.equal(cashPoorPerson.decisions[0].chosenAction, "do-nothing");
  assert.deepEqual(cashPoorPerson.decisions[0].legalActions, ["do-nothing"]);
  assert.equal(cashPoorPerson.ledger.length, 0);
});

test("food quality and security motivations can prefer different legal sellers", () => {
  const policy = new MotivationCitizenPolicy();
  const cheapAction = "buy-food:0:3";
  const premiumAction = "buy-food:1:3";
  const observation = {
    kind: "food",
    citizenId: 9,
    citizenName: "Candidate",
    stress: 0.4,
    health: 0.8,
    hungryDays: 0,
    runwayDays: 1,
    reserveTarget: 3,
    scarcityError: false,
    profile: { comfort: 1, connection: 1, mastery: 1, security: 0.7, foodQuality: 1.3, planning: 1, avoidance: 1 },
    options: [
      { action: cheapAction, source: "seller", sellerId: 0, sellerName: "Value Foods", units: 3, unitPrice: 1, totalPrice: 3, effectiveQuality: 0.55, age: 0, capacityAvailable: true },
      { action: premiumAction, source: "seller", sellerId: 1, sellerName: "Premium Foods", units: 3, unitPrice: 10, totalPrice: 30, effectiveQuality: 0.85, age: 0, capacityAvailable: true },
    ],
  };
  const legalActions = ["skip-food", cheapAction, premiumAction];

  const qualityChoice = policy.decide({ observation, legalActions, random: () => 0 });
  const securityChoice = policy.decide({
    observation: { ...observation, profile: { ...observation.profile, security: 1.3, foodQuality: 0.7 } },
    legalActions,
    random: () => 0,
  });

  assert.equal(qualityChoice.action, premiumAction);
  assert.equal(securityChoice.action, cheapAction);
});

test("food policy options cannot overdraw cash or invent an unaffordable purchase", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  const harvest = town.firms.find((firm) => firm.name === "Harvest Foods");
  person.cash = harvest.price;
  person.foodStock = [];
  person.foodReserveTarget = 3;
  person.ledger = [];
  const before = person.cash;

  town.considerFood(person, [harvest]);

  assert.equal(person.cash, 0);
  assert.equal(person.ledger[0].amount, before);
  assert.deepEqual(person.decisions[0].legalActions, ["skip-food", `buy-food:${harvest.id}:1`]);
  assert.equal(person.decisions[0].observation.options[0].totalPrice, before);

  const invalidTown = new TownSimulation({
    seed: 42,
    citizenPolicy: { id: "illegal-food-test", decide: () => ({ action: `buy-food:${harvest.id}:3`, reasons: [] }) },
  });
  const invalidPerson = invalidTown.people[0];
  invalidPerson.cash = harvest.price;
  invalidPerson.foodStock = [];
  assert.throws(() => invalidTown.considerFood(invalidPerson, [invalidTown.firms[harvest.id]]), /chose an illegal food action/);
  assert.equal(invalidPerson.cash, harvest.price);
  assert.equal(invalidPerson.ledger.length, 0);
});

test("food observations expose seller capacity and the policy can choose an available alternative", () => {
  const town = new TownSimulation({ seed: 42 });
  const person = town.people[0];
  const harvest = town.firms.find((firm) => firm.name === "Harvest Foods");
  const basket = town.firms.find((firm) => firm.name === "Green Basket");
  person.cash = 20;
  person.foodStock = [];
  person.foodReserveTarget = 1;
  harvest.inventory = 5;
  basket.inventory = 5;
  harvest.employees.forEach((id) => { town.people[id].attended = true; });
  basket.employees.forEach((id) => { town.people[id].attended = true; });
  harvest.transactionsToday = town.transactionCapacity(harvest);

  town.considerFood(person, [harvest, basket]);

  const trace = person.decisions[0];
  assert.equal(trace.observation.options.find((option) => option.sellerId === harvest.id).capacityAvailable, false);
  assert.equal(trace.observation.options.find((option) => option.sellerId === basket.id).capacityAvailable, true);
  assert.equal(trace.chosenAction, `buy-food:${basket.id}:1`);
  assert.equal(person.foodSeller, basket.id);
  assert.equal(harvest.transactionsToday, town.transactionCapacity(harvest));
});

test("housing security and avoidance motivations can produce payment or deferral", () => {
  const runChoice = ({ security, avoidance }) => {
    const town = new TownSimulation({ seed: 42 });
    const person = town.people[0];
    const housing = town.firms.find((firm) => firm.sector === "housing");
    person.cash = housing.price + 0.1;
    person.stress = 0.9;
    person.scarcityError = true;
    person.rentArrears = 0;
    person.ledger = [];
    person.events = [];
    person.motivationProfile = { ...person.motivationProfile, security, avoidance };
    const personBefore = person.cash;
    const housingBefore = housing.cash;
    const totalBefore = town.totalMoney();
    town.considerHousing(person, housing);
    return { town, person, housing, personBefore, housingBefore, totalBefore };
  };

  const secure = runChoice({ security: 1.3, avoidance: 0.7 });
  const avoidant = runChoice({ security: 0.7, avoidance: 1.3 });

  assert.match(secure.person.decisions[0].chosenAction, /^pay-housing:/);
  assert.equal(secure.person.cash, 0.1);
  assert.equal(secure.housing.cash, secure.housingBefore + secure.housing.price);
  assert.equal(secure.town.totalMoney(), secure.totalBefore);
  assert.equal(avoidant.person.decisions[0].chosenAction, "defer-housing");
  assert.equal(avoidant.person.cash, avoidant.personBefore);
  assert.equal(avoidant.person.rentArrears, 1);
  assert.match(avoidant.person.events[0].text, /motivation-driven avoidance deferred rent/);
});

test("sustained income eventually expands staffing", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const firm = town.firms[0];
  const startingStaff = firm.employees.length;
  const wage = Math.max(town.policy.minimumWage, firm.wage);

  for (let day = 0; day < 10 && firm.employees.length === startingStaff; day += 1) {
    firm.sales = wage * 1.08 * (startingStaff + 2);
    town.settleFirm(firm);
  }

  assert.equal(firm.employees.length, startingStaff + 1);
});

test("income does not create a position without payroll reserves", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const firm = town.firms[0];
  const wage = Math.max(town.policy.minimumWage, firm.wage);
  firm.cash = wage * 5;
  firm.revenueEMA = wage * 1.08 * (firm.employees.length + 1);
  firm.sales = firm.revenueEMA;

  town.settleFirm(firm);

  assert.equal(firm.targetStaff, firm.employees.length);
  assert.equal(town.snapshot().positionsAvailable, 0);
});

test("a weak-income layoff does not create an available position", () => {
  const town = new TownSimulation({ seed: 42 });
  town.setPolicy("shockRisk", 0);
  const firm = town.firms[0];
  firm.revenueEMA = 0;
  firm.sales = 0;
  firm.overstaffedDays = 2;
  const before = town.snapshot();

  town.settleFirm(firm);

  const after = town.snapshot();
  assert.equal(after.employed, before.employed - 1);
  assert.equal(after.positionsAvailable, before.positionsAvailable);
});

test("the snapshot reports positions approved by active firms", () => {
  const town = new TownSimulation({ seed: 42 });
  town.firms.forEach((firm) => {
    firm.targetStaff = firm.employees.length;
  });
  town.firms[0].targetStaff += 2;
  town.firms[1].targetStaff += 1;
  town.firms[1].active = false;

  assert.equal(town.snapshot().positionsAvailable, 2);
});

test("the simulation clock cannot advance after every citizen has died", () => {
  const town = new TownSimulation({ seed: 42 });
  town.people.forEach((person) => town.die(person, "test extinction"));
  const before = town.snapshot();
  const firmCashBefore = town.firms.map((firm) => firm.cash);
  const treasuryCashBefore = town.government.cash;

  const after = town.step();

  assert.equal(town.isExtinct(), true);
  assert.equal(after.alive, 0);
  assert.equal(after.day, before.day);
  assert.equal(after.phase, before.phase);
  assert.deepEqual(town.firms.map((firm) => firm.cash), firmCashBefore);
  assert.equal(town.government.cash, treasuryCashBefore);
});

test("the same seed produces the same town", () => {
  const first = new TownSimulation({ seed: 2026 });
  const second = new TownSimulation({ seed: 2026 });
  for (let step = 0; step < 60; step += 1) {
    first.step();
    second.step();
  }
  assert.deepEqual(first.snapshot(), second.snapshot());
  assert.deepEqual(first.people, second.people);
});
