import { PROCESSING_PHASES } from "./civil-time.js";

export const PHASES = PROCESSING_PHASES;

export const PRODUCTS = {
  produce: { name: "Farm produce", unit: "crate" },
  budgetFood: { name: "Everyday food", unit: "meal" },
  premiumFood: { name: "High-quality food", unit: "meal" },
  housing: { name: "Weekly housing", unit: "tenancy-week" },
  learningGoods: { name: "Tools and repair kits", unit: "kit" },
  cafeService: { name: "Prepared café service", unit: "visit" },
  medicine: { name: "Self-care medicine", unit: "dose" },
  education: { name: "Worker education", unit: "lesson" },
  constructionMaterials: { name: "Construction materials", unit: "bundle" },
  clinicalCare: { name: "Clinical treatment", unit: "appointment" },
  constructionService: { name: "Building project", unit: "project" },
  haulage: { name: "Freight delivery", unit: "delivered unit" },
};

export const RENT_INTERVAL_DAYS = 7;
export const FOOD_HEALTH_RECOVERY = 0.006;
export const FOOD_QUALITY_DECAY_PER_DAY = 0.12;
export const MIN_FOOD_QUALITY = 0.2;
export const PERISHABLE_SHELF_LIFE = Object.freeze({ produce: 3, budgetFood: 3, premiumFood: 3, cafeService: 1 });
export const INITIAL_FRIENDSHIP_STRENGTH = 0.6;
export const FRIENDSHIP_CONTACT_GAIN = 0.18;
export const FRIENDSHIP_DECAY_GRACE_DAYS = 5;
export const FRIENDSHIP_DAILY_DECAY = 0.015;
export const FRIENDSHIP_END_THRESHOLD = 0.2;
export const COOPERATION_MODES = Object.freeze(["legacy", "public-social", "mutual-aid"]);
export const WELFARE_MODES = Object.freeze(["none", "legacy-cash", "direct-only", "combined"]);
export const LIFECYCLE_STAGES = Object.freeze(["infant", "child", "student", "adult"]);
export const LIFECYCLE_STAGE_START_DAYS = Object.freeze({ infant: 0, child: 28, student: 84, adult: 168 });
export const WELFARE_PROGRAMMES = Object.freeze({
  food: Object.freeze({ id: "food-assistance", name: "Food Assistance", ruleVersion: "food-assistance-v1" }),
  rent: Object.freeze({ id: "rent-assistance", name: "Rent Assistance", ruleVersion: "rent-assistance-v1" }),
  cash: Object.freeze({ id: "emergency-cash-relief", name: "Emergency Cash Relief", ruleVersion: "emergency-cash-relief-v1" }),
});
export const CLOSE_FRIENDSHIP_THRESHOLD = 0.75;
export const FOOD_PANTRY_CAPACITY = 3;
export const STAFFING_REVENUE_BUFFER = 1.08;
export const FIRM_DISTRESS_DAYS = 3;
export const FIRM_INSOLVENCY_DAYS = 6;
export const VITAL_RESCUE_RUNWAY_DAYS = 3;
export const VITAL_RESCUE_CAP = 90;
export const MAINTENANCE_INTERVAL_DAYS = 3;
export const MISSED_MAINTENANCE_CAPACITY = 0.65;
export const HOUSING_RECEIVERSHIP_GRACE_DAYS = 7;
export const HOUSING_RESTART_COST = 90;
export const HOUSING_DISPLACEMENT_RATE = 0.2;
export const HOUSING_REPLACEMENT_STAFF = 2;
export const INITIAL_DWELLING_CAPACITY = 40;
export const HOUSING_PROJECT_CAPACITY_GAIN = 2;
export const HOUSING_REPAIR_INTERVAL_DAYS = 14;
export const HOUSING_REPAIR_GRACE_DAYS = 7;
export const TRANSPORT_CAPACITY_PER_WORKER = 45;
export const SCHEDULED_TRANSPORT_CAPACITY_PER_WORKER = 60;
export const TRANSPORT_LOAD_BY_PRODUCT = Object.freeze({ produce: 1, learningGoods: 1.5, medicine: 0.5, constructionMaterials: 4 });
export const SCHEDULED_MAINTENANCE_UNIT_PRICE = 8;
export const ESSENTIAL_REENTRY_COOLDOWN_DAYS = 14;
export const ESSENTIAL_FOOD_EMERGENCY_REENTRY_DAYS = 1;
export const ESSENTIAL_REENTRY_COST = 90;
export const ESSENTIAL_REENTRY_STAFF = 2;
export const PRICE_REVIEW_DAYS = 7;
export const PRICE_FLOOR_MULTIPLIER = 0.7;
export const PRICE_CEILING_MULTIPLIER = 1.4;
export const PRICE_ADJUSTMENT_RATE = 0.05;
export const SUPPORT_RUNWAY_TARGET_DAYS = 4;
export const OPPORTUNITY_OBSERVATION_DAYS = 3;
export const OPPORTUNITY_REQUIRED_VIABLE_DAYS = 2;
export const LEGACY_OPPORTUNITY_OBSERVATION_DAYS = 7;
export const OPPORTUNITY_STARTUP_CAPITAL = 40;
export const OPPORTUNITY_PROTECTED_RUNWAY_DAYS = 6;
export const LEGACY_OPPORTUNITY_PROTECTED_RUNWAY_DAYS = 10;
export const OPPORTUNITY_DEMAND_CAPTURE_RATE = 0.5;
export const OPPORTUNITY_MARGIN_BUFFER = 1.08;
export const PRIVATE_REENTRY_COOLDOWN_DAYS = 21;
export const INVESTMENT_DEMAND_WINDOW_DAYS = 3;
export const INVESTMENT_DEMAND_REQUIRED_DAYS = 2;
export const INVESTMENT_DEMAND_CAPTURE_RATE = 0.5;
export const INVESTMENT_RECRUITMENT_DAYS = 3;
export const INVESTMENT_EVALUATION_DAYS = 7;
export const INVESTMENT_WAGE_RESERVE_DAYS = 6;
export const PRIVATE_FORMATION_ARCHETYPE_IDS = Object.freeze(["cafe", "premium-grocer", "apothecary", "school", "materials-yard", "clinic", "builder"]);
export const HEALTH_TREATMENT_THRESHOLD = 0.68;
export const HEALTH_TREATMENT_RECOVERY = 0.08;
export const HEALTH_TREATMENT_RESERVE_DAYS = 2;
export const EDUCATION_SKILL_THRESHOLD = 0.72;
export const EDUCATION_SKILL_GAIN = 0.01;
export const EDUCATION_RESERVE_DAYS = 3;
export const LEGACY_KNOWLEDGE_SCHEMA_VERSION = "knowledge-v1";
export const KNOWLEDGE_SCHEMA_VERSION = "knowledge-v2";
export const KNOWLEDGE_VOCATIONAL_DOMAINS = Object.freeze([
  "retailOperations",
  "inventoryHandling",
  "propertyOperations",
  "fabrication",
  "foodService",
  "compounding",
  "teaching",
  "clinicalCare",
  "construction",
  "logistics",
  "agriculture",
]);
export const KNOWLEDGE_DOMAIN_LABELS = Object.freeze({
  retailOperations: "Retail operations",
  inventoryHandling: "Inventory handling",
  propertyOperations: "Property operations",
  fabrication: "Fabrication",
  foodService: "Food service",
  compounding: "Compounding",
  teaching: "Teaching",
  clinicalCare: "Clinical care",
  construction: "Construction",
  logistics: "Logistics",
  agriculture: "Agriculture",
});
export const RETAIL_WORK_LEARNING_RATE = 0.004;
export const INVENTORY_WORK_LEARNING_RATE = 0.002;
export const DEFAULT_TRADE_WORK_LEARNING_RATE = 0.003;
export const RETAIL_COURSE_LEARNING_RATE = 0.04;
export const RETAIL_COURSE_INVENTORY_TRANSFER_RATE = 0.01;
export const GROCERY_KNOWLEDGE_CAPACITY_BONUS = 0.15;
export const TRADE_KNOWLEDGE_MAX_BONUS = 0.15;
export const CLINIC_TREATMENT_THRESHOLD = 0.38;
export const CLINIC_TREATMENT_RECOVERY = 0.18;
export const CLINIC_TREATMENT_RESERVE_DAYS = 1;
export const DEFAULT_LATENT_FIRM_NAMES = Object.freeze(["Common Café", "Green Basket", "Morrow Apothecary", "Morrow School", "Morrow Materials", "Morrow Clinic", "Morrow Builders"]);
export const FIRM_OPEN_WEEKDAYS = Object.freeze({
  "housing-provider": Object.freeze([0, 1, 2, 3, 4]),
  toolmaker: Object.freeze([0, 1, 2, 3, 4]),
  school: Object.freeze([0, 1, 2, 3, 4]),
  "materials-yard": Object.freeze([0, 1, 2, 3, 4]),
  builder: Object.freeze([0, 1, 2, 3, 4]),
  "everyday-grocer": Object.freeze([0, 1, 2, 3, 4, 5]),
  "premium-grocer": Object.freeze([0, 1, 2, 3, 4, 5]),
  apothecary: Object.freeze([0, 1, 2, 3, 4, 5]),
  haulage: Object.freeze([0, 1, 2, 3, 4, 5]),
  farm: Object.freeze([0, 1, 2, 3, 4, 5]),
  cafe: Object.freeze([2, 3, 4, 5, 6]),
  clinic: Object.freeze([0, 1, 2, 3, 4, 5, 6]),
});
export const FIRM_SERVICE_WINDOWS = Object.freeze({
  school: "Workday",
  clinic: "Workday",
  "everyday-grocer": "Evening",
  "premium-grocer": "Evening",
  "housing-provider": "Evening",
  cafe: "Evening",
  apothecary: "Evening",
  toolmaker: "Workday",
  "materials-yard": "Workday",
  builder: "Workday",
  haulage: "Workday",
  farm: "Workday",
});

export const NAMES = [
  "Amina", "Jonah", "Thandi", "Leo", "Maya", "Kwame", "Sofia", "Noah",
  "Zuri", "Eli", "Naledi", "Mateo", "Imani", "Lucas", "Aya", "Sam",
  "Lebo", "Nora", "Dineo", "Theo", "Amara", "Ben", "Mila", "Kofi",
  "Lina", "Adam", "Tara", "Yusuf", "Nia", "Max", "Ravi", "Ella",
  "Sizwe", "Ana", "Omar", "Luca", "Priya", "Kai", "Mara", "Tumi",
];

const tradeDomain = (id, weight, workplaceLearningRate, learningRule) => Object.freeze({
  id,
  label: KNOWLEDGE_DOMAIN_LABELS[id],
  weight,
  workplaceLearningRate,
  learningRule,
});

const tradeKnowledge = (domains, effectType, effectRule) => Object.freeze({
  domains: Object.freeze(domains),
  effectType,
  maxBonus: TRADE_KNOWLEDGE_MAX_BONUS,
  effectRule,
});

const retailKnowledge = () => tradeKnowledge([
  tradeDomain("retailOperations", 0.5, RETAIL_WORK_LEARNING_RATE, "attended-grocery-shift-retail-v1"),
  tradeDomain("inventoryHandling", 0.5, INVENTORY_WORK_LEARNING_RATE, "attended-grocery-shift-inventory-v1"),
], "transaction-capacity", "grocery-knowledge-capacity-v1");

const singleDomainKnowledge = (id, effectType, effectRule) => tradeKnowledge([
  tradeDomain(id, 1, DEFAULT_TRADE_WORK_LEARNING_RATE, `attended-${id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-shift-v1`),
], effectType, effectRule);

export const FIRM_KNOWLEDGE_CONFIGS = Object.freeze({
  "everyday-grocer": retailKnowledge(),
  "premium-grocer": retailKnowledge(),
  "housing-provider": singleDomainKnowledge("propertyOperations", "transaction-capacity", "trade-transaction-capacity-v1"),
  toolmaker: singleDomainKnowledge("fabrication", "direct-yield", "trade-direct-yield-v1"),
  cafe: singleDomainKnowledge("foodService", "transaction-capacity", "trade-transaction-capacity-v1"),
  apothecary: singleDomainKnowledge("compounding", "transaction-capacity", "trade-transaction-capacity-v1"),
  school: singleDomainKnowledge("teaching", "direct-yield", "trade-direct-yield-v1"),
  "materials-yard": singleDomainKnowledge("fabrication", "processing-capacity", "trade-processing-capacity-v1"),
  clinic: singleDomainKnowledge("clinicalCare", "transaction-capacity", "trade-transaction-capacity-v1"),
  builder: singleDomainKnowledge("construction", "processing-capacity", "trade-processing-capacity-v1"),
  haulage: singleDomainKnowledge("logistics", "haulage-capacity", "trade-haulage-capacity-v1"),
  farm: singleDomainKnowledge("agriculture", "direct-yield", "trade-direct-yield-v1"),
});

export const FIRMS = [
  { archetypeId: "everyday-grocer", name: "Harvest Foods", sector: "food", vital: true, sells: "budgetFood", input: "produce", source: "Morrow Fields", production: "sourced", sourceDescription: "retail staff turn farm produce into everyday meals", x: 0.17, y: 0.28, price: 2.15, quality: 0.55, wage: 6.2, productivity: 0, transactionsPerWorker: 14, inventory: 40, initialStaff: 3, maxStaff: 6, knowledge: FIRM_KNOWLEDGE_CONFIGS["everyday-grocer"] },
  { archetypeId: "premium-grocer", name: "Green Basket", sector: "food", sells: "premiumFood", input: "produce", source: "Morrow Fields", production: "sourced", sourceDescription: "retail staff select higher-grade farm produce", x: 0.48, y: 0.22, price: 2.55, quality: 0.85, wage: 6.5, productivity: 0, transactionsPerWorker: 8, inventory: 14, initialStaff: 2, formationStaff: 1, maxStaff: 5, knowledge: FIRM_KNOWLEDGE_CONFIGS["premium-grocer"] },
  { archetypeId: "housing-provider", name: "HomeWorks", sector: "housing", vital: true, sells: "housing", input: null, source: null, production: "fixed-service", sourceDescription: "housing staff operate the town's current dwelling service", x: 0.80, y: 0.29, price: 6, wage: 7.2, productivity: 0, transactionsPerWorker: 10, inventory: 0, initialStaff: 4, maxStaff: 6, knowledge: FIRM_KNOWLEDGE_CONFIGS["housing-provider"] },
  { archetypeId: "toolmaker", name: "Makers Guild", sector: "goods", sells: "learningGoods", input: null, source: null, production: "direct", sourceDescription: "guild workers make tools and repair kits locally", x: 0.25, y: 0.73, price: 6, wage: 7.8, productivity: 2.1, transactionsPerWorker: 3, inventory: 18, initialStaff: 3, maxStaff: 6, knowledge: FIRM_KNOWLEDGE_CONFIGS.toolmaker },
  { archetypeId: "cafe", name: "Common Café", sector: "service", sells: "cafeService", input: "produce", source: "Morrow Fields", production: "sourced", sourceDescription: "café staff prepare visits using farm produce", x: 0.69, y: 0.73, price: 2.2, wage: 6.4, productivity: 0, transactionsPerWorker: 4, inventory: 6, initialStaff: 2, maxStaff: 4, knowledge: FIRM_KNOWLEDGE_CONFIGS.cafe },
  { archetypeId: "apothecary", name: "Morrow Apothecary", sector: "health", sells: "medicine", input: "produce", source: "Morrow Fields", production: "sourced", sourceDescription: "apothecary workers compound farm produce into medicine", x: 0.35, y: 0.88, price: 3.6, wage: 6.8, productivity: 0, transactionsPerWorker: 6, inventory: 8, initialStaff: 2, formationStaff: 1, maxStaff: 4, defaultLatent: true, knowledge: FIRM_KNOWLEDGE_CONFIGS.apothecary },
  { archetypeId: "school", name: "Morrow School", sector: "education", sells: "education", input: null, source: null, production: "direct", sourceDescription: "teachers provide finite lessons that gradually improve worker skill", x: 0.86, y: 0.46, price: 4.5, wage: 7, productivity: 4, transactionsPerWorker: 5, inventory: 8, initialStaff: 2, formationStaff: 1, maxStaff: 5, defaultLatent: true, knowledge: FIRM_KNOWLEDGE_CONFIGS.school },
  { archetypeId: "materials-yard", name: "Morrow Materials", sector: "construction", sells: "constructionMaterials", input: "learningGoods", source: "Makers Guild", production: "sourced", sourceDescription: "yard workers assemble guild-made kits into construction bundles", x: 0.12, y: 0.12, price: 16, wage: 7.4, productivity: 0, processingPerWorker: 1, transactionsPerWorker: 4, inventory: 4, initialStaff: 2, formationStaff: 1, maxStaff: 4, defaultLatent: true, knowledge: FIRM_KNOWLEDGE_CONFIGS["materials-yard"] },
  { archetypeId: "clinic", name: "Morrow Clinic", sector: "health", sells: "clinicalCare", input: "medicine", source: "Morrow Apothecary", production: "sourced", sourceDescription: "clinical staff use apothecary medicine for stronger treatment", x: 0.82, y: 0.08, price: 7.5, wage: 8, productivity: 0, transactionsPerWorker: 4, inventory: 4, initialStaff: 2, formationStaff: 1, maxStaff: 5, defaultLatent: true, knowledge: FIRM_KNOWLEDGE_CONFIGS.clinic },
  { archetypeId: "builder", name: "Morrow Builders", sector: "construction", sells: "constructionService", input: "constructionMaterials", source: "Morrow Materials", production: "sourced", sourceDescription: "builders turn material bundles into housing expansion and repair projects", x: 0.64, y: 0.88, price: 28, wage: 8, productivity: 0, processingPerWorker: 1, transactionsPerWorker: 3, inventory: 2, initialStaff: 2, formationStaff: 1, maxStaff: 5, defaultLatent: true, knowledge: FIRM_KNOWLEDGE_CONFIGS.builder },
  { archetypeId: "haulage", name: "Morrow Haulage", sector: "transport", vital: true, sells: "haulage", input: null, source: null, production: "fixed-service", sourceDescription: "transport workers carry physical goods between local firms", x: 0.45, y: 0.05, price: 0.45, wage: 5, productivity: 0, transactionsPerWorker: 1, inventory: 0, initialStaff: 2, scheduledInitialStaff: 3, maxStaff: 6, defaultLatent: true, knowledge: FIRM_KNOWLEDGE_CONFIGS.haulage },
  { archetypeId: "farm", name: "Morrow Fields", sector: "agriculture", vital: true, sells: "produce", input: null, source: null, production: "direct", sourceDescription: "farm workers grow produce locally", x: 0.08, y: 0.54, price: 1.1, wage: 5.8, productivity: 9, transactionsPerWorker: 8, inventory: 36, initialStaff: 7, maxStaff: 12, knowledge: FIRM_KNOWLEDGE_CONFIGS.farm },
];

export const SUPPLY_CONTRACTS = [
  { supplier: "Morrow Fields", buyer: "Harvest Foods", product: "produce", output: "budgetFood", dailyQuantity: 40, unitPrice: 1.45 },
  { supplier: "Morrow Fields", buyer: "Green Basket", product: "produce", output: "premiumFood", dailyQuantity: 14, unitPrice: 1.65 },
  { supplier: "Morrow Fields", buyer: "Common Café", product: "produce", output: "cafeService", dailyQuantity: 3, unitPrice: 1.1 },
  { supplier: "Morrow Fields", buyer: "Morrow Apothecary", product: "produce", output: "medicine", dailyQuantity: 6, unitPrice: 1.1 },
  { supplier: "Makers Guild", buyer: "Harvest Foods", product: "learningGoods", output: "budgetFood", use: "operations", targetStock: 1, dailyQuantity: 1, unitPrice: 5 },
  { supplier: "Makers Guild", buyer: "Green Basket", product: "learningGoods", output: "premiumFood", use: "operations", targetStock: 1, dailyQuantity: 1, unitPrice: 5 },
  { supplier: "Makers Guild", buyer: "HomeWorks", product: "learningGoods", output: "housing", use: "operations", targetStock: 1, dailyQuantity: 1, unitPrice: 5 },
  { supplier: "Makers Guild", buyer: "Common Café", product: "learningGoods", output: "cafeService", use: "operations", targetStock: 1, dailyQuantity: 1, unitPrice: 5 },
  { supplier: "Makers Guild", buyer: "Morrow Apothecary", product: "learningGoods", output: "medicine", use: "operations", targetStock: 1, dailyQuantity: 1, unitPrice: 5 },
  { supplier: "Makers Guild", buyer: "Morrow School", product: "learningGoods", output: "education", use: "operations", targetStock: 1, dailyQuantity: 1, unitPrice: 5 },
  { supplier: "Makers Guild", buyer: "Morrow Materials", product: "learningGoods", output: "constructionMaterials", dailyQuantity: 1, unitPrice: 5 },
  { supplier: "Makers Guild", buyer: "Morrow Materials", product: "learningGoods", output: "constructionMaterials", use: "operations", targetStock: 1, dailyQuantity: 1, unitPrice: 5 },
  { supplier: "Morrow Apothecary", buyer: "Morrow Clinic", product: "medicine", output: "clinicalCare", dailyQuantity: 4, unitPrice: 3.6 },
  { supplier: "Makers Guild", buyer: "Morrow Clinic", product: "learningGoods", output: "clinicalCare", use: "operations", targetStock: 1, dailyQuantity: 1, unitPrice: 5 },
  { supplier: "Morrow Materials", buyer: "Morrow Builders", product: "constructionMaterials", output: "constructionService", dailyQuantity: 1, unitPrice: 16 },
  { supplier: "Makers Guild", buyer: "Morrow Builders", product: "learningGoods", output: "constructionService", use: "operations", targetStock: 1, dailyQuantity: 1, unitPrice: 5 },
  { supplier: "Morrow Builders", buyer: "HomeWorks", product: "constructionService", output: "housing", use: "construction-project", dailyQuantity: 1, unitPrice: 28 },
  { supplier: "Makers Guild", buyer: "Morrow Haulage", product: "learningGoods", output: "haulage", use: "operations", targetStock: 1, dailyQuantity: 1, unitPrice: 5 },
  { supplier: "Makers Guild", buyer: "Morrow Fields", product: "learningGoods", output: "produce", use: "operations", targetStock: 1, dailyQuantity: 1, unitPrice: 5 },
];

export const DEFAULT_POLICY = {
  minimumWage: 5,
  taxRate: 12,
  supportRate: 35,
  discretionaryDemand: 50,
  shockRisk: 20,
};
