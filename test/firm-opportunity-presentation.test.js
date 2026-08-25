import assert from "node:assert/strict";
import test from "node:test";
import { describeFirmOpportunity } from "../src/firm-opportunity-presentation.js";
import { TownSimulation } from "../src/simulation.js";

test("opportunity presentation explains an absent firm's evidence and blockers", () => {
  const town = new TownSimulation({ seed: 42, latentFirmNames: ["Common Café"] });
  const opportunity = town.firmOpportunities()[0];

  assert.deepEqual(describeFirmOpportunity(opportunity), {
    evidence: "0/7 days observed · 0 potential customers today · 0.0 expected daily revenue · 17.8 expected daily cost",
    resources: "2/2 workers available · founder Luca · Morrow Fields available · Makers Guild available",
    explanation: "7 observation days still required · observed demand does not cover expected wages and inputs with a margin buffer",
  });
});
