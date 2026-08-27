import assert from "node:assert/strict";
import test from "node:test";
import {
  citizenKnowledgeEvidence,
  firmKnowledgeEvidence,
  knowledgeEffectDescription,
} from "../src/knowledge-presentation.js";
import { createKnowledgeProfile } from "../src/knowledge.js";

test("citizen knowledge always shows general knowledge and only nonzero vocational domains", () => {
  assert.deepEqual(citizenKnowledgeEvidence({
    version: "knowledge-v2",
    general: 0.4,
    retailOperations: 0.2,
    inventoryHandling: 0,
    agriculture: 0.1,
  }), {
    general: 0.4,
    vocational: [
      { domain: "retailOperations", label: "Retail operations", value: 0.2 },
      { domain: "agriculture", label: "Agriculture", value: 0.1 },
    ],
  });
  assert.deepEqual(citizenKnowledgeEvidence({ general: 0.3 }).vocational, []);
});

test("firm knowledge evidence exposes configuration, workforce averages, and auditable effects", () => {
  const people = [
    { knowledgeProfile: { ...createKnowledgeProfile(), fabrication: 0.2 } },
    { knowledgeProfile: { ...createKnowledgeProfile(), fabrication: 0.6 } },
  ];
  const firm = {
    employees: [0, 1],
    knowledge: {
      domains: [{ id: "fabrication", label: "Fabrication", weight: 1, workplaceLearningRate: 0.003, learningRule: "attended-fabrication-shift-v1" }],
      effectType: "direct-yield",
      effectRule: "trade-direct-yield-v1",
      maxBonus: 0.15,
    },
    knowledgeEffectScalarToday: 8,
    knowledgeEffectGrossToday: 0.48,
    knowledgeCapacitySlotsToday: 0,
    knowledgeCapacityCarry: 0,
    knowledgeEffectUsedToday: 0.48,
  };

  assert.deepEqual(firmKnowledgeEvidence(firm, people), {
    domains: [{
      id: "fabrication",
      label: "Fabrication",
      weight: 1,
      workplaceLearningRate: 0.003,
      learningRule: "attended-fabrication-shift-v1",
      average: 0.4,
    }],
    workforceWeightedAverage: 0.4,
    effectType: "direct-yield",
    effectRule: "trade-direct-yield-v1",
    maxBonus: 0.15,
    scalarBaseline: 8,
    grossContribution: 0.48,
    releasedUnits: 0,
    carry: 0,
    usedUnits: 0.48,
  });
});

test("knowledge effect descriptions distinguish continuous and discrete evidence", () => {
  assert.match(knowledgeEffectDescription({ effectType: "direct-yield", grossContribution: 0.48, releasedUnits: 0, usedUnits: 0.48, carryAfter: 0 }), /0\.480 additional output/);
  assert.match(knowledgeEffectDescription({ effectType: "processing-capacity", grossContribution: 0.4, releasedUnits: 1, usedUnits: 1, carryAfter: 0.2 }), /1 whole unit released; 1\.000 used; 20\.0% carry/);
});
