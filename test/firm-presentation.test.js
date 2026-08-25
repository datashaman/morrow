import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCTS } from "../src/config.js";
import { describeContract, describePipeline } from "../src/firm-presentation.js";
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
  assert.match(describeContract(contract, PRODUCTS), /22\/22 crates delivered today at 1.10 each/);
});

test("transported contracts expose paid freight load", () => {
  const town = new TownSimulation({ seed: 42, transportEnabled: true });
  town.productionPhase();
  town.procurementPhase();
  const contract = town.contracts.find((candidate) => candidate.buyer === "Harvest Foods");

  assert.match(describeContract(contract, PRODUCTS), /44 haulage load for 5.50/);
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
