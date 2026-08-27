import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCTS } from "../src/config.js";
import { describeContract, describePerishableInventory, describePipeline, describeProcessing } from "../src/firm-presentation.js";
import { TownSimulation } from "../src/simulation.js";

test("firm pipeline descriptions name every output and upstream producer", () => {
  const town = new TownSimulation({ seed: 42 });
  const descriptions = town.firms.map((firm) => describePipeline(firm, PRODUCTS));

  assert.equal(descriptions.length, town.firms.length);
  assert.match(descriptions[town.firms.findIndex((firm) => firm.name === "Harvest Foods")], /Everyday food.*Farm produce.*Morrow Fields/);
  assert.match(descriptions[town.firms.findIndex((firm) => firm.name === "Morrow Fields")], /Makes Farm produce directly/);
  assert.match(descriptions[town.firms.findIndex((firm) => firm.name === "HomeWorks")], /Operates Weekly housing/);
});

test("contract descriptions expose requested and delivered quantities", () => {
  const town = new TownSimulation({ seed: 42 });
  town.productionPhase();
  town.procurementPhase();
  const contract = town.contracts.find((candidate) => candidate.buyer === "Harvest Foods");

  assert.match(describeContract(contract, PRODUCTS), /Morrow Fields → Harvest Foods contract active/);
  assert.match(describeContract(contract, PRODUCTS), /40\/40 crates delivered today at 1.45 each/);
});

test("transported contracts expose paid freight load", () => {
  const town = new TownSimulation({ seed: 42, transportEnabled: true });
  town.productionPhase();
  const carrier = town.firms.find((firm) => firm.archetypeId === "haulage");
  carrier.employees.forEach((id) => { town.people[id].attended = true; });
  town.procurementPhase();
  const contract = town.contracts.find((candidate) => candidate.buyer === "Harvest Foods");

  assert.match(describeContract(contract, PRODUCTS), /80 haulage load for 18.00/);
});

test("Makers Guild exposes its maintenance customers", () => {
  const town = new TownSimulation({ seed: 42 });
  const guild = town.firms.find((firm) => firm.name === "Makers Guild");
  const customerContracts = town.contracts.filter((contract) => contract.supplierId === guild.id);

  assert.deepEqual(customerContracts.map((contract) => contract.buyer), [
    "Harvest Foods",
    "Green Basket",
    "HomeWorks",
    "Common Café",
    "Morrow Fields",
  ]);
  assert.ok(customerContracts.every((contract) => contract.product === "learningGoods" && contract.use === "operations"));
});

test("construction processing exposes separate input, output, capacity, and shortfall evidence", () => {
  const town = new TownSimulation({ seed: 42 });
  const archetype = town.firmArchetype("materials-yard");
  const yard = town.createFirmInstance(archetype, town.firms.length, { inventory: 3 });
  yard.inputInventory = 2;
  yard.processingCapacityToday = 1;
  yard.processedToday = 1;
  yard.processingShortfallToday = 1;

  assert.equal(
    describeProcessing(yard, PRODUCTS),
    "Processing · 2 kits awaiting · 3 bundles stocked · 1/1 units processed today · 1 labor-limited input shortfall",
  );
});

test("perishable presentation exposes dated stock, next expiry, processing, sales, and waste", () => {
  const town = new TownSimulation({ seed: 42 });
  const grocer = town.firms.find((firm) => firm.archetypeId === "everyday-grocer");
  grocer.inventory = 0;
  grocer.inventoryBatches = [];
  town.day = 2;
  town.addFirmInventory(grocer, 2, { batchDay: 1 });
  town.addFirmInventory(grocer, 3, { batchDay: 2 });
  grocer.perishableProcessedToday = 3;
  grocer.perishableSalesToday = 1;
  town.recordWaste(grocer, { product: grocer.sells, quantity: 4, batchDay: -2, age: 4, reason: "test" });

  assert.equal(
    describePerishableInventory(grocer, PRODUCTS, town.day),
    "Perishable stock · 5.0 meals (age 0: 3.0, age 1: 2.0) · next expiry D4 · 3 processed today · 1 sold today · 4.0 wasted total",
  );
  assert.equal(describePerishableInventory(town.firms.find((firm) => firm.archetypeId === "toolmaker"), PRODUCTS, town.day), "");
});
