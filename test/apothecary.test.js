import assert from "node:assert/strict";
import test from "node:test";
import {
  HEALTH_TREATMENT_RECOVERY,
  OPPORTUNITY_OBSERVATION_DAYS,
  OPPORTUNITY_STARTUP_CAPITAL,
  PRODUCTS,
} from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

function prepareHealthDemand(town, health = 0.5) {
  town.people.forEach((person) => {
    person.cash = 100;
    person.health = health;
  });
  town.initialMoney = town.totalMoney();
}

function observeApothecaryWindow(town) {
  let result;
  for (let offset = 0; offset < OPPORTUNITY_OBSERVATION_DAYS; offset += 1) {
    town.day = offset + 1;
    const observed = town.observeFirmOpportunities();
    result = Array.isArray(observed)
      ? observed.find((entry) => entry.archetypeId === "apothecary")
      : observed;
  }
  return result;
}

function foundApothecary(seed = 42) {
  const town = new TownSimulation({ seed, policy: { shockRisk: 0 } });
  prepareHealthDemand(town);
  return { town, firm: observeApothecaryWindow(town) };
}

test("the apothecary is a latent farm-to-medicine opportunity", () => {
  const town = new TownSimulation({ seed: 42 });
  const archetype = town.firmArchetype("apothecary");
  const opportunity = town.firmOpportunities().find((entry) => entry.archetypeId === "apothecary");

  assert.equal(PRODUCTS[archetype.sells].name, "Self-care medicine");
  assert.equal(archetype.input, "produce");
  assert.equal(archetype.source, "Morrow Fields");
  assert.equal(town.firms.some((firm) => firm.archetypeId === "apothecary"), false);
  assert.equal(opportunity.ready, false);
  assert.equal(opportunity.latestPotentialCustomers, 0);
});

test("healthy households do not create a viable apothecary", () => {
  const town = new TownSimulation({ seed: 42 });
  prepareHealthDemand(town, 0.9);

  const opportunity = observeApothecaryWindow(town);

  assert.equal(opportunity.ready, false);
  assert.equal(opportunity.expectedDailyDemand, 0);
  assert.match(opportunity.reasons.join(" "), /demand does not cover/);
  assert.equal(town.firms.some((firm) => firm.archetypeId === "apothecary"), false);
});

test("sustained solvent health need founds a staffed apothecary with exact capital and contracts", () => {
  const town = new TownSimulation({ seed: 42 });
  prepareHealthDemand(town);
  const totalBefore = town.totalMoney();
  const founder = town.founderCandidates()[0];
  const founderBefore = founder.cash;

  const firm = observeApothecaryWindow(town);

  assert.equal(firm.archetypeId, "apothecary");
  assert.equal(firm.instanceId, "apothecary:1");
  assert.equal(firm.owner, founder.id);
  assert.equal(firm.foundingDay, OPPORTUNITY_OBSERVATION_DAYS);
  assert.equal(firm.founderCapital, OPPORTUNITY_STARTUP_CAPITAL);
  assert.equal(founder.cash, founderBefore - OPPORTUNITY_STARTUP_CAPITAL);
  assert.equal(firm.cash, OPPORTUNITY_STARTUP_CAPITAL);
  assert.equal(firm.inventory, 0);
  assert.deepEqual(firm.employees, [founder.id]);
  assert.deepEqual(
    town.contracts.filter((contract) => contract.buyerId === firm.id).map((contract) => contract.supplier).sort(),
    ["Makers Guild", "Morrow Fields"],
  );
  assert.equal(town.totalMoney(), totalBefore);
  town.assertInvariants();
});

test("an exact medicine purchase records its counterparty and provides bounded recovery", () => {
  const { town, firm } = foundApothecary();
  const patient = town.people.find((person) => person.id !== firm.owner);
  patient.cash = 20;
  patient.health = 0.4;
  firm.inventory = 2;
  firm.cash = 40;
  town.initialMoney = town.totalMoney();
  const patientBefore = patient.cash;
  const firmBefore = firm.cash;

  const treated = town.considerHealthCare(patient, firm);

  assert.equal(treated, true);
  assert.equal(patient.cash, patientBefore - firm.price);
  assert.equal(firm.cash, firmBefore + firm.price);
  assert.equal(firm.inventory, 1);
  assert.equal(patient.health, 0.4 + HEALTH_TREATMENT_RECOVERY);
  assert.equal(patient.healthSeller, firm.id);
  assert.equal(patient.lastTreatmentDay, town.day);
  assert.match(patient.ledger[0].text, /bought 1 medicine dose from Morrow Apothecary/);
  assert.equal(patient.decisions[0].kind, "health");
  assert.equal(patient.decisions[0].chosenAction, `buy-medicine:${firm.id}`);
  assert.match(patient.events[0].text, /self-care medicine raised health/);
  town.assertInvariants();
});

test("an unaffordable medicine dose cannot overdraw a patient or create partial treatment", () => {
  const { town, firm } = foundApothecary();
  const patient = town.people.find((person) => person.id !== firm.owner);
  patient.cash = firm.price - 0.01;
  patient.health = 0.4;
  firm.inventory = 2;
  const cashBefore = patient.cash;
  const healthBefore = patient.health;
  const stockBefore = firm.inventory;

  const treated = town.considerHealthCare(patient, firm);

  assert.equal(treated, false);
  assert.equal(patient.cash, cashBefore);
  assert.equal(patient.health, healthBefore);
  assert.equal(firm.inventory, stockBefore);
  assert.deepEqual(patient.decisions[0].legalActions, ["defer-treatment"]);
  assert.equal(patient.decisions[0].chosenAction, "defer-treatment");
});

test("the gated neural controller leaves the new health domain with its motivation fallback", () => {
  const { town, firm } = foundApothecary();
  const patient = town.people.find((person) => person.id !== firm.owner);
  patient.cash = 20;
  patient.health = 0.4;
  firm.inventory = 2;
  town.setNeuralControl(true);

  assert.equal(town.considerHealthCare(patient, firm), true);
  assert.equal(patient.decisions[0].policy, "motivation-v3");
  assert.equal(patient.decisions[0].control, null);
  assert.equal(patient.decisions[0].shadow, null);
});

test("apothecary founder and opening day reproduce from the same seed and state", () => {
  const first = foundApothecary(404);
  const second = foundApothecary(404);

  assert.deepEqual(
    { owner: first.firm.owner, day: first.firm.foundingDay, staff: first.firm.employees },
    { owner: second.firm.owner, day: second.firm.foundingDay, staff: second.firm.employees },
  );
});
