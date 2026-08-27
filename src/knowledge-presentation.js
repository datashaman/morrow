import { KNOWLEDGE_DOMAIN_LABELS } from "./config.js";
import { weightedVocationalKnowledge } from "./knowledge.js";

const roundSix = (value) => Math.round(value * 1_000_000) / 1_000_000;

export function domainLabel(domain) {
  return domain === "general" ? "General" : KNOWLEDGE_DOMAIN_LABELS[domain] ?? domain;
}

export function citizenKnowledgeEvidence(profile) {
  return {
    general: profile.general,
    vocational: Object.keys(KNOWLEDGE_DOMAIN_LABELS)
      .filter((domain) => (profile[domain] ?? 0) > 0)
      .map((domain) => ({ domain, label: domainLabel(domain), value: profile[domain] })),
  };
}

export function firmKnowledgeEvidence(firm, people) {
  const workers = firm.employees.map((id) => people[id]).filter((person) => person?.alive && person.attended);
  const domains = firm.knowledge.domains.map((domain) => ({
    ...domain,
    average: workers.length
      ? roundSix(workers.reduce((total, person) => total + (person.knowledgeProfile[domain.id] ?? 0), 0) / workers.length)
      : 0,
  }));
  const workforceWeightedAverage = workers.length
    ? roundSix(workers.reduce((total, person) => total + weightedVocationalKnowledge(person.knowledgeProfile, firm.knowledge), 0) / workers.length)
    : 0;
  return {
    domains,
    workforceWeightedAverage,
    effectType: firm.knowledge.effectType,
    effectRule: firm.knowledge.effectRule,
    maxBonus: firm.knowledge.maxBonus,
    scalarBaseline: firm.knowledgeEffectScalarToday,
    grossContribution: firm.knowledgeEffectGrossToday,
    releasedUnits: firm.knowledgeCapacitySlotsToday,
    carry: firm.knowledgeCapacityCarry,
    usedUnits: firm.knowledgeEffectUsedToday,
  };
}

export function knowledgeEffectDescription(entry) {
  const effect = {
    "transaction-capacity": "transaction capacity",
    "direct-yield": "direct output",
    "processing-capacity": "processing capacity",
    "haulage-capacity": "haulage capacity",
  }[entry.effectType] ?? entry.effectType;
  const released = entry.effectType === "direct-yield"
    ? `${entry.grossContribution.toFixed(3)} additional output`
    : `${entry.releasedUnits} whole unit${entry.releasedUnits === 1 ? "" : "s"} released`;
  return `Knowledge affected ${effect}: ${released}; ${entry.usedUnits.toFixed(3)} used; ${(entry.carryAfter * 100).toFixed(1)}% carry remains`;
}
