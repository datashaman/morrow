import {
  KNOWLEDGE_DOMAIN_LABELS,
  KNOWLEDGE_SCHEMA_VERSION,
  KNOWLEDGE_VOCATIONAL_DOMAINS,
  LEGACY_KNOWLEDGE_SCHEMA_VERSION,
} from "./config.js";

const EFFECT_TYPES = Object.freeze([
  "transaction-capacity",
  "direct-yield",
  "processing-capacity",
  "haulage-capacity",
]);

const roundKnowledge = (value) => Math.round(value * 1_000_000) / 1_000_000;

function boundedValue(value, field) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`Invalid knowledge value for ${field}`);
  return roundKnowledge(value);
}

export function createKnowledgeProfile(general = 0) {
  return {
    version: KNOWLEDGE_SCHEMA_VERSION,
    general: boundedValue(general, "general"),
    ...Object.fromEntries(KNOWLEDGE_VOCATIONAL_DOMAINS.map((domain) => [domain, 0])),
  };
}

export function migrateKnowledgeProfile(profile) {
  if (!profile || typeof profile !== "object") throw new Error("Knowledge profile must be an object");
  if (profile.version === LEGACY_KNOWLEDGE_SCHEMA_VERSION) {
    return {
      ...createKnowledgeProfile(profile.general),
      retailOperations: boundedValue(profile.retail, "retail"),
      inventoryHandling: boundedValue(profile.inventory, "inventory"),
    };
  }
  if (profile.version !== KNOWLEDGE_SCHEMA_VERSION) throw new Error(`Unsupported knowledge profile version: ${profile.version ?? "missing"}`);
  const migrated = createKnowledgeProfile(profile.general);
  KNOWLEDGE_VOCATIONAL_DOMAINS.forEach((domain) => {
    migrated[domain] = boundedValue(profile[domain], domain);
  });
  return migrated;
}

function expectedEffectType(archetype) {
  if (archetype.archetypeId === "haulage") return "haulage-capacity";
  if (archetype.processingPerWorker) return "processing-capacity";
  if (archetype.production === "direct") return "direct-yield";
  if (archetype.transactionsPerWorker) return "transaction-capacity";
  return null;
}

export function validateFirmKnowledgeConfig(archetype) {
  const config = archetype?.knowledge;
  const context = archetype?.archetypeId ?? "unknown archetype";
  if (!config || typeof config !== "object") throw new Error(`Missing knowledge configuration for ${context}`);
  if (!Array.isArray(config.domains) || !config.domains.length) throw new Error(`Missing knowledge domains for ${context}`);
  const domainIds = new Set();
  let weightTotal = 0;
  config.domains.forEach((domain, index) => {
    if (!domain || typeof domain !== "object") throw new Error(`Invalid knowledge domain ${index} for ${context}`);
    if (!KNOWLEDGE_VOCATIONAL_DOMAINS.includes(domain.id)) throw new Error(`Unknown knowledge domain ${domain.id} for ${context}`);
    if (domainIds.has(domain.id)) throw new Error(`Duplicate knowledge domain ${domain.id} for ${context}`);
    domainIds.add(domain.id);
    if (domain.label !== KNOWLEDGE_DOMAIN_LABELS[domain.id]) throw new Error(`Invalid knowledge label for ${domain.id} on ${context}`);
    if (!Number.isFinite(domain.weight) || domain.weight <= 0 || domain.weight > 1) throw new Error(`Invalid knowledge weight for ${domain.id} on ${context}`);
    if (!Number.isFinite(domain.workplaceLearningRate) || domain.workplaceLearningRate <= 0 || domain.workplaceLearningRate > 1) throw new Error(`Invalid workplace learning rate for ${domain.id} on ${context}`);
    if (typeof domain.learningRule !== "string" || !domain.learningRule.endsWith("-v1")) throw new Error(`Invalid learning rule for ${domain.id} on ${context}`);
    weightTotal += domain.weight;
  });
  if (Math.abs(weightTotal - 1) > 1e-9) throw new Error(`Knowledge weights must sum to one for ${context}`);
  if (!EFFECT_TYPES.includes(config.effectType)) throw new Error(`Unknown knowledge effect type ${config.effectType} for ${context}`);
  const compatibleEffect = expectedEffectType(archetype);
  if (config.effectType !== compatibleEffect) throw new Error(`Knowledge effect ${config.effectType} is incompatible with ${context}; expected ${compatibleEffect}`);
  if (!Number.isFinite(config.maxBonus) || config.maxBonus <= 0 || config.maxBonus > 1) throw new Error(`Invalid knowledge maximum bonus for ${context}`);
  if (typeof config.effectRule !== "string" || !config.effectRule.endsWith("-v1")) throw new Error(`Invalid knowledge effect rule for ${context}`);
  return true;
}

export function validateFirmKnowledgeConfigs(archetypes) {
  if (!Array.isArray(archetypes) || !archetypes.length) throw new Error("Firm archetypes are required for knowledge validation");
  const ids = new Set();
  archetypes.forEach((archetype) => {
    if (ids.has(archetype.archetypeId)) throw new Error(`Duplicate firm archetype ${archetype.archetypeId}`);
    ids.add(archetype.archetypeId);
    validateFirmKnowledgeConfig(archetype);
  });
  return true;
}

export function weightedVocationalKnowledge(profile, config) {
  const migrated = migrateKnowledgeProfile(profile);
  return roundKnowledge(config.domains.reduce((total, domain) => total + migrated[domain.id] * domain.weight, 0));
}

