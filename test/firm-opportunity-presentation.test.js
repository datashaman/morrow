import assert from "node:assert/strict";
import test from "node:test";
import { describeFirmOpportunity, firmInstanceLabel } from "../src/firm-opportunity-presentation.js";
import { TownSimulation } from "../src/simulation.js";

test("opportunity presentation explains an absent firm's evidence and blockers", () => {
  const town = new TownSimulation({ seed: 42, latentFirmNames: ["Common Café"] });
  const opportunity = town.firmOpportunities()[0];

  assert.deepEqual(describeFirmOpportunity(opportunity), {
    evidence: "0/3 days observed · 0 potential customers today · 0.0 expected daily revenue · 17.8 expected daily cost",
    resources: "2/2 workers available · founder Luca · Morrow Fields available · Makers Guild available",
    explanation: "3 observation days still required · 2 more viable demand days are required · observed demand does not cover expected wages and inputs with a margin buffer",
  });
});

test("historical and replacement firms receive distinct inspectable labels", () => {
  const firms = [
    { name: "Common Café", archetypeId: "cafe", instanceNumber: 1 },
    { name: "Common Café", archetypeId: "cafe", instanceNumber: 2 },
  ];

  assert.equal(firmInstanceLabel(firms[0], firms), "Common Café · instance 1");
  assert.equal(firmInstanceLabel(firms[1], firms), "Common Café · instance 2");
});
