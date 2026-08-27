import assert from "node:assert/strict";
import test from "node:test";
import { TownSimulation } from "../src/simulation.js";

function addRuntimeFirm(town, archetypeId, staff = 1) {
  const archetype = town.firmArchetype(archetypeId);
  const workers = town.people.filter((person) => person.alive && person.employer < 0).slice(0, staff);
  assert.equal(workers.length, staff);
  const firm = town.createFirmInstance(archetype, town.firms.length, {
    owner: workers[0].id,
    targetStaff: staff,
    inventory: 0,
  });
  town.firms.push(firm);
  workers.forEach((worker) => town.hire(firm, worker, true));
  return firm;
}

function setWorkerKnowledge(town, firm, value, attending = true) {
  firm.employees.forEach((id) => {
    const person = town.people[id];
    person.attended = attending;
    firm.knowledge.domains.forEach((domain) => { person.knowledgeProfile[domain.id] = value; });
  });
}

test("transaction and service archetypes release bounded whole capacity from per-worker knowledge", () => {
  const town = new TownSimulation({ seed: 42 });
  const archetypeIds = ["everyday-grocer", "premium-grocer", "housing-provider", "cafe", "apothecary", "clinic"];
  archetypeIds.forEach((archetypeId) => {
    const firm = town.firms.find((candidate) => candidate.archetypeId === archetypeId) ?? addRuntimeFirm(town, archetypeId);
    firm.employees.slice(1).forEach((id) => { town.people[id].attended = false; });
    const worker = town.people[firm.employees[0]];
    worker.attended = true;
    firm.knowledge.domains.forEach((domain) => { worker.knowledgeProfile[domain.id] = 1; });
    firm.knowledgeCapacityCarry = 0.9;

    const scalar = town.scalarTransactionCapacity(firm);
    const released = town.accrueKnowledgeCapacity(firm);
    assert.ok(released >= 1, archetypeId);
    assert.equal(town.transactionCapacity(firm), scalar + released);
    assert.ok(firm.knowledgeEffectGrossToday <= scalar * 0.15 + 1e-6);
    assert.equal(firm.knowledgeEffectHistory[0].rule, firm.knowledge.effectRule);
  });
});

test("every direct producer adds fractional knowledge yield bounded to each attending worker scalar", () => {
  ["toolmaker", "school", "farm"].forEach((archetypeId) => {
    const enabled = new TownSimulation({ seed: 42 });
    const firm = enabled.firms.find((candidate) => candidate.archetypeId === archetypeId) ?? addRuntimeFirm(enabled, archetypeId);
    setWorkerKnowledge(enabled, firm, 1);
    firm.employees.slice(1).forEach((id) => { enabled.people[id].attended = false; });
    enabled.accrueKnowledgeCapacity(firm);
    const worker = enabled.people[firm.employees[0]];
    const scalar = enabled.directScalarOutput(worker, firm);

    assert.equal(firm.knowledgeCapacitySlotsToday, 0, archetypeId);
    assert.equal(firm.knowledgeCapacityCarry, 0, archetypeId);
    assert.equal(firm.knowledgeEffectGrossToday, Math.round(scalar * 0.15 * 1_000_000) / 1_000_000, archetypeId);
    assert.equal(firm.knowledgeEffectUsedToday, firm.knowledgeEffectGrossToday, archetypeId);
    assert.equal(firm.knowledgeEffectHistory[0].usedUnits, firm.knowledgeEffectGrossToday, archetypeId);
  });

  const disabled = new TownSimulation({ seed: 42, knowledgeEnabled: false });
  const disabledGuild = disabled.firms.find((firm) => firm.archetypeId === "toolmaker");
  setWorkerKnowledge(disabled, disabledGuild, 1);
  disabled.accrueKnowledgeCapacity(disabledGuild);
  assert.equal(disabledGuild.knowledgeEffectHistory.length, 0);
});

test("every processing trade releases whole throughput only when workers attend and input can use it", () => {
  ["materials-yard", "builder"].forEach((archetypeId) => {
    const town = new TownSimulation({ seed: 42 });
    const firm = addRuntimeFirm(town, archetypeId);
    setWorkerKnowledge(town, firm, 1);
    firm.knowledgeCapacityCarry = 0.9;
    firm.inputInventory = 2;
    town.accrueKnowledgeCapacity(firm);

    town.procurementPhase();

    assert.equal(firm.processingScalarCapacityToday, 1, archetypeId);
    assert.equal(firm.processingCapacityToday, 2, archetypeId);
    assert.equal(firm.processedToday, 2, archetypeId);
    assert.equal(firm.knowledgeEffectUsedToday, 1, archetypeId);
    assert.equal(firm.knowledgeEffectHistory[0].usedUnits, 1, archetypeId);
  });
});

test("haulage knowledge adds bounded load points while zero knowledge, absence, and disabled mode preserve scalar capacity", () => {
  const town = new TownSimulation({ seed: 42, transportEnabled: true });
  const carrier = town.firms.find((firm) => firm.archetypeId === "haulage");
  carrier.employees.slice(1).forEach((id) => { town.people[id].attended = false; });
  const worker = town.people[carrier.employees[0]];
  worker.attended = true;
  worker.knowledgeProfile.logistics = 1;
  carrier.knowledgeCapacityCarry = 0.5;
  const scalar = town.transportCapacityPerWorker();

  town.accrueKnowledgeCapacity(carrier);

  assert.equal(carrier.knowledgeEffectGrossToday, scalar * 0.15);
  assert.equal(town.haulageCapacity(carrier), scalar + 7);
  town.day += 1;
  worker.attended = false;
  assert.equal(town.accrueKnowledgeCapacity(carrier), 0);
  assert.equal(town.haulageCapacity(carrier), 0);

  const disabled = new TownSimulation({ seed: 42, transportEnabled: true, knowledgeEnabled: false });
  const disabledCarrier = disabled.firms.find((firm) => firm.archetypeId === "haulage");
  disabledCarrier.employees.forEach((id, index) => {
    disabled.people[id].attended = index === 0;
    disabled.people[id].knowledgeProfile.logistics = 1;
  });
  disabled.accrueKnowledgeCapacity(disabledCarrier);
  assert.equal(disabled.haulageCapacity(disabledCarrier), disabled.transportCapacityPerWorker());
  assert.equal(disabledCarrier.knowledgeEffectHistory.length, 0);
});

test("fractional carry survives closure while a replacement instance starts from zero", () => {
  const town = new TownSimulation({ seed: 42 });
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  setWorkerKnowledge(town, grocer, 0.1);
  town.accrueKnowledgeCapacity(grocer);
  const historicalCarry = grocer.knowledgeCapacityCarry;

  town.closeFirm(grocer, "test closure");
  const replacement = town.createFirmInstance(town.firmArchetype("everyday-grocer"), town.firms.length, { instanceNumber: 2 });

  assert.ok(historicalCarry > 0 && historicalCarry < 1);
  assert.equal(grocer.knowledgeCapacityCarry, historicalCarry);
  assert.equal(replacement.knowledgeCapacityCarry, 0);
  assert.deepEqual(replacement.knowledgeEffectHistory, []);
});
