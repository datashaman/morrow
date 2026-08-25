import assert from "node:assert/strict";
import test from "node:test";
import { TownSimulation } from "../src/simulation.js";

function transportTown(seed = 42) {
  const town = new TownSimulation({ seed, transportEnabled: true });
  const carrier = town.firms.find((firm) => firm.archetypeId === "haulage");
  const driver = town.people[carrier.employees[0]];
  town.people.forEach((person) => { person.attended = false; });
  driver.attended = true;
  carrier.operationalReadiness = 1;
  return { town, carrier };
}

test("physical supply settles supplier goods and paid haulage only on delivery", () => {
  const { town, carrier } = transportTown();
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  const grocer = town.firms.find((firm) => firm.name === "Harvest Foods");
  const contract = town.contracts.find((candidate) => candidate.supplierId === farm.id && candidate.buyerId === grocer.id);
  town.contracts.filter((candidate) => candidate !== contract).forEach((candidate) => { candidate.active = false; });
  farm.inventory = 100;
  grocer.inventory = 0;
  grocer.cash = 100;
  town.initialMoney = town.totalMoney();
  const farmBefore = farm.cash;
  const grocerBefore = grocer.cash;
  const carrierBefore = carrier.cash;
  const totalBefore = town.totalMoney();

  town.procurementPhase();

  assert.equal(contract.deliveredToday, 22);
  assert.equal(contract.transportLoadToday, 44);
  assert.equal(contract.transportFeeToday, 5.5);
  assert.equal(grocer.inventory, 22);
  assert.equal(grocer.cash, grocerBefore - 22 * contract.unitPrice);
  assert.equal(farm.cash, farmBefore + 22 * (contract.unitPrice - carrier.basePrice));
  assert.equal(carrier.cash, carrierBefore + 5.5);
  assert.ok(grocer.ledger.some((entry) => /haulage by Morrow Haulage/.test(entry.text)));
  assert.ok(carrier.ledger.some((entry) => /delivery for Harvest Foods/.test(entry.text)));
  assert.equal(town.totalMoney(), totalBefore);
  town.assertInvariants();
});

test("distance-weighted finite capacity creates deterministic contention", () => {
  const { town, carrier } = transportTown();
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  const harvest = town.firms.find((firm) => firm.name === "Harvest Foods");
  const premium = town.firms.find((firm) => firm.name === "Green Basket");
  const premiumContract = town.contracts.find((contract) => contract.supplierId === farm.id && contract.buyerId === premium.id);
  farm.inventory = 100;
  harvest.inventory = 0;
  premium.inventory = 0;
  harvest.cash = 100;
  premium.cash = 100;

  town.procurementPhase();

  assert.equal(carrier.transportCapacityToday, 45);
  assert.equal(carrier.transportLoadToday, 44);
  assert.equal(premiumContract.requestedToday, 14);
  assert.equal(premiumContract.deliveredToday, 0);
  assert.equal(premium.inventory, 0);
  assert.match(premium.events[0].text, /Morrow Haulage could transport only 0 of 14/);
});

test("a missing carrier leaves title, goods, and cash with the supplier", () => {
  const { town, carrier } = transportTown();
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  const grocer = town.firms.find((firm) => firm.name === "Harvest Foods");
  farm.inventory = 100;
  grocer.inventory = 0;
  grocer.cash = 100;
  const stateBefore = { farmStock: farm.inventory, farmCash: farm.cash, grocerCash: grocer.cash };
  town.closeFirm(carrier, "transport income could not sustain operations");

  town.procurementPhase();

  assert.deepEqual(
    { farmStock: farm.inventory, farmCash: farm.cash, grocerCash: grocer.cash },
    stateBefore,
  );
  assert.equal(grocer.inventory, 0);
  assert.match(grocer.events[0].text, /No carrier could transport/);
  assert.equal(town.people[carrier.owner].employer, -1);
});

test("goods affordability without the complete freight fee creates no partial settlement", () => {
  const { town } = transportTown();
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  const grocer = town.firms.find((firm) => firm.name === "Harvest Foods");
  const contract = town.contracts.find((candidate) => candidate.supplierId === farm.id && candidate.buyerId === grocer.id);
  town.contracts.filter((candidate) => candidate !== contract).forEach((candidate) => { candidate.active = false; });
  farm.inventory = 100;
  grocer.inventory = 0;
  grocer.cash = contract.unitPrice - town.firms.find((firm) => firm.archetypeId === "haulage").basePrice;
  town.initialMoney = town.totalMoney();
  const before = { farmStock: farm.inventory, farmCash: farm.cash, grocerCash: grocer.cash };

  town.procurementPhase();

  assert.deepEqual({ farmStock: farm.inventory, farmCash: farm.cash, grocerCash: grocer.cash }, before);
  assert.equal(grocer.inventory, 0);
  town.assertInvariants();
});

test("legacy scenarios without transport retain local self-delivery", () => {
  const town = new TownSimulation({ seed: 42, transportEnabled: false });
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  const grocer = town.firms.find((firm) => firm.name === "Harvest Foods");
  farm.inventory = 100;
  grocer.inventory = 0;
  grocer.cash = 100;
  town.initialMoney = town.totalMoney();

  town.procurementPhase();

  assert.equal(grocer.inventory, 22);
  assert.equal(town.firms.some((firm) => firm.archetypeId === "haulage"), false);
  assert.equal(grocer.ledger.some((entry) => /haulage/.test(entry.text)), false);
  town.assertInvariants();
});

test("the carrier's bounded fee changes delivered affordability", () => {
  const { town, carrier } = transportTown();
  const farm = town.firms.find((firm) => firm.name === "Morrow Fields");
  const grocer = town.firms.find((firm) => firm.name === "Harvest Foods");
  const contract = town.contracts.find((candidate) => candidate.supplierId === farm.id && candidate.buyerId === grocer.id);
  town.contracts.filter((candidate) => candidate !== contract).forEach((candidate) => { candidate.active = false; });
  farm.inventory = 100;
  grocer.inventory = 0;
  grocer.cash = contract.unitPrice;
  carrier.price = carrier.maximumPrice;

  town.procurementPhase();

  assert.equal(contract.deliveredToday, 0);
  assert.equal(grocer.inventory, 0);
  assert.equal(grocer.cash, contract.unitPrice);
});

test("haulage outcomes reproduce from the same seed and state", () => {
  const run = (seed) => {
    const { town, carrier } = transportTown(seed);
    town.firms.find((firm) => firm.name === "Morrow Fields").inventory = 100;
    town.firms.filter((firm) => firm.sector === "food").forEach((firm) => {
      firm.inventory = 0;
      firm.cash = 100;
    });
    town.procurementPhase();
    return {
      load: carrier.transportLoadToday,
      deliveries: town.contracts.map((contract) => contract.deliveredToday),
      cash: town.firms.map((firm) => firm.cash),
    };
  };

  assert.deepEqual(run(404), run(404));
});
