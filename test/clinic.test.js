import assert from "node:assert/strict";
import test from "node:test";
import {
  CLINIC_TREATMENT_RECOVERY,
  CLINIC_TREATMENT_RESERVE_DAYS,
  OPPORTUNITY_OBSERVATION_DAYS,
} from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

function prepareSevereNeed(town) {
  town.people.forEach((person) => {
    person.cash = 100;
    person.health = 0.2;
  });
  town.initialMoney = town.totalMoney();
}

function resultFor(observed, archetypeId) {
  return Array.isArray(observed) ? observed.find((entry) => entry.archetypeId === archetypeId) : observed;
}

function observeClinicWindow(town) {
  let result;
  for (let offset = 0; offset < OPPORTUNITY_OBSERVATION_DAYS; offset += 1) {
    town.day = offset + 1;
    result = resultFor(town.observeFirmOpportunities(), "clinic");
  }
  return result;
}

function foundClinic(seed = 42) {
  const town = new TownSimulation({ seed, policy: { shockRisk: 0 } });
  prepareSevereNeed(town);
  return { town, clinic: observeClinicWindow(town), apothecary: town.firms.find((firm) => firm.archetypeId === "apothecary") };
}

test("the clinic is an explicit medicine-to-treatment pipeline", () => {
  const town = new TownSimulation({ seed: 42 });
  const clinic = town.firmArchetype("clinic");
  const templates = town.contractTemplatesFor(clinic);

  assert.equal(clinic.input, "medicine");
  assert.equal(clinic.source, "Morrow Apothecary");
  assert.equal(clinic.sells, "clinicalCare");
  assert.ok(templates.some((contract) => contract.supplier === "Morrow Apothecary" && contract.product === "medicine"));
  assert.ok(templates.some((contract) => contract.supplier === "Makers Guild" && contract.use === "operations"));
});

test("a clinic cannot form without an operating apothecary", () => {
  const town = new TownSimulation({ seed: 42, formationArchetypeIds: ["clinic"] });
  prepareSevereNeed(town);

  const opportunity = observeClinicWindow(town);

  assert.equal(opportunity.ready, false);
  assert.match(opportunity.reasons.join(" "), /missing active supplier: Morrow Apothecary/);
  assert.equal(town.firms.some((firm) => firm.archetypeId === "clinic"), false);
});

test("severe solvent demand can found an apothecary and downstream clinic", () => {
  const { town, clinic, apothecary } = foundClinic();

  assert.equal(apothecary.active, true);
  assert.equal(clinic.instanceId, "clinic:1");
  assert.equal(clinic.foundingDay, OPPORTUNITY_OBSERVATION_DAYS);
  assert.equal(clinic.employees.length, 1);
  assert.equal(town.people[clinic.owner].employer, clinic.id);
  assert.deepEqual(
    town.contracts.filter((contract) => contract.buyerId === clinic.id).map((contract) => contract.supplier).sort(),
    ["Makers Guild", "Morrow Apothecary"],
  );
  town.assertInvariants();
});

test("procurement consumes apothecary medicine to create clinic appointments", () => {
  const { town, clinic, apothecary } = foundClinic();
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  const makers = town.firms.find((firm) => firm.name === "Makers Guild");
  farm.inventory = 100;
  makers.inventory = 100;
  apothecary.cash = 100;
  clinic.cash = 100;
  town.initialMoney = town.totalMoney();
  const totalBefore = town.totalMoney();

  town.procurementPhase();

  assert.equal(clinic.inventory, 4);
  assert.equal(clinic.operatingSupplies, 1);
  assert.ok(clinic.ledger.some((entry) => /doses? from Morrow Apothecary/.test(entry.text)));
  assert.ok(apothecary.ledger.some((entry) => /doses? to Morrow Clinic/.test(entry.text)));
  assert.equal(town.totalMoney(), totalBefore);
  town.assertInvariants();
});

test("an exact clinical appointment provides stronger but bounded recovery", () => {
  const { town, clinic } = foundClinic();
  const patient = town.people.find((person) => person.id !== clinic.owner);
  patient.cash = 30;
  patient.health = 0.2;
  patient.stress = 0;
  clinic.inventory = 2;
  town.initialMoney = town.totalMoney();
  const cashBefore = patient.cash;
  const clinicBefore = clinic.cash;

  assert.equal(town.considerClinicalCare(patient, clinic), true);
  assert.equal(patient.cash, cashBefore - clinic.price);
  assert.equal(clinic.cash, clinicBefore + clinic.price);
  assert.equal(patient.health, 0.2 + CLINIC_TREATMENT_RECOVERY);
  assert.ok(patient.health < 1);
  assert.equal(patient.clinicalSeller, clinic.id);
  assert.match(patient.ledger[0].text, /bought 1 clinical appointment from Morrow Clinic/);
  assert.match(patient.events[0].text, /clinical treatment raised health/);
  town.assertInvariants();
});

test("clinical care takes precedence over same-phase self-care", () => {
  const { town, clinic, apothecary } = foundClinic();
  const patient = town.people.find((person) => person.id !== clinic.owner && person.id !== apothecary.owner);
  town.people.forEach((person) => { person.health = 0.9; });
  patient.health = 0.2;
  patient.cash = 100;
  clinic.inventory = 2;
  apothecary.inventory = 2;

  town.personalPhase();

  assert.equal(patient.ledger.filter((entry) => /clinical appointment/.test(entry.text)).length, 1);
  assert.equal(patient.ledger.filter((entry) => /medicine dose/.test(entry.text)).length, 0);
  assert.ok(patient.health >= 0.2 + CLINIC_TREATMENT_RECOVERY);
  assert.ok(patient.health < 0.4);
});

test("clinical care remains unavailable when its price plus reserve is unaffordable", () => {
  const { town, clinic } = foundClinic();
  const patient = town.people.find((person) => person.id !== clinic.owner);
  const reserve = town.essentialCost() * CLINIC_TREATMENT_RESERVE_DAYS;
  patient.cash = clinic.price + reserve - 0.01;
  patient.health = 0.2;
  clinic.inventory = 2;
  const before = { cash: patient.cash, health: patient.health, stock: clinic.inventory };

  assert.equal(town.considerClinicalCare(patient, clinic), false);
  assert.deepEqual({ cash: patient.cash, health: patient.health, stock: clinic.inventory }, before);
  assert.deepEqual(patient.decisions[0].legalActions, ["defer-clinical-care"]);
});

test("clinic insolvency removes clinical jobs and medicine supply", () => {
  const { town, clinic } = foundClinic();
  const clinician = town.people[clinic.owner];

  town.closeFirm(clinic, "clinical income could not sustain treatment");

  assert.equal(clinician.employer, -1);
  assert.equal(clinic.employees.length, 0);
  assert.equal(town.contracts.filter((contract) => contract.buyerId === clinic.id && contract.active).length, 0);
});

test("clinic formation reproduces from the same seed", () => {
  const first = foundClinic(404);
  const second = foundClinic(404);
  assert.deepEqual(
    { owner: first.clinic.owner, day: first.clinic.foundingDay, staff: first.clinic.employees },
    { owner: second.clinic.owner, day: second.clinic.foundingDay, staff: second.clinic.employees },
  );
});
