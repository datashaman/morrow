export const PHASES = [
  "Production",
  "Supply & procurement",
  "Payroll",
  "Food shopping",
  "Housing & bills",
  "Personal time",
  "Settlement",
];

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
export const INITIAL_FRIENDSHIP_STRENGTH = 0.6;
export const FRIENDSHIP_CONTACT_GAIN = 0.18;
export const FRIENDSHIP_DECAY_GRACE_DAYS = 5;
export const FRIENDSHIP_DAILY_DECAY = 0.015;
export const FRIENDSHIP_END_THRESHOLD = 0.2;
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
export const TRANSPORT_LOAD_BY_PRODUCT = Object.freeze({ produce: 1, learningGoods: 1.5, medicine: 0.5, constructionMaterials: 4 });
export const ESSENTIAL_REENTRY_COOLDOWN_DAYS = 14;
export const ESSENTIAL_REENTRY_COST = 90;
export const ESSENTIAL_REENTRY_STAFF = 2;
export const PRICE_REVIEW_DAYS = 7;
export const PRICE_FLOOR_MULTIPLIER = 0.7;
export const PRICE_CEILING_MULTIPLIER = 1.4;
export const PRICE_ADJUSTMENT_RATE = 0.05;
export const SUPPORT_RUNWAY_TARGET_DAYS = 4;
export const OPPORTUNITY_OBSERVATION_DAYS = 7;
export const OPPORTUNITY_STARTUP_CAPITAL = 40;
export const OPPORTUNITY_PROTECTED_RUNWAY_DAYS = 10;
export const OPPORTUNITY_DEMAND_CAPTURE_RATE = 0.5;
export const OPPORTUNITY_MARGIN_BUFFER = 1.08;
export const PRIVATE_REENTRY_COOLDOWN_DAYS = 21;
export const PRIVATE_FORMATION_ARCHETYPE_IDS = Object.freeze(["cafe", "premium-grocer", "apothecary", "school", "materials-yard", "clinic", "builder"]);
export const HEALTH_TREATMENT_THRESHOLD = 0.68;
export const HEALTH_TREATMENT_RECOVERY = 0.08;
export const HEALTH_TREATMENT_RESERVE_DAYS = 2;
export const EDUCATION_SKILL_THRESHOLD = 0.72;
export const EDUCATION_SKILL_GAIN = 0.01;
export const EDUCATION_RESERVE_DAYS = 3;
export const KNOWLEDGE_SCHEMA_VERSION = "knowledge-v1";
export const RETAIL_WORK_LEARNING_RATE = 0.004;
export const INVENTORY_WORK_LEARNING_RATE = 0.002;
export const GROCERY_KNOWLEDGE_CAPACITY_BONUS = 0.15;
export const CLINIC_TREATMENT_THRESHOLD = 0.38;
export const CLINIC_TREATMENT_RECOVERY = 0.18;
export const CLINIC_TREATMENT_RESERVE_DAYS = 1;
export const DEFAULT_LATENT_FIRM_NAMES = Object.freeze(["Common Café", "Green Basket", "Morrow Apothecary", "Morrow School", "Morrow Materials", "Morrow Clinic", "Morrow Builders"]);

export const NAMES = [
  "Amina", "Jonah", "Thandi", "Leo", "Maya", "Kwame", "Sofia", "Noah",
  "Zuri", "Eli", "Naledi", "Mateo", "Imani", "Lucas", "Aya", "Sam",
  "Lebo", "Nora", "Dineo", "Theo", "Amara", "Ben", "Mila", "Kofi",
  "Lina", "Adam", "Tara", "Yusuf", "Nia", "Max", "Ravi", "Ella",
  "Sizwe", "Ana", "Omar", "Luca", "Priya", "Kai", "Mara", "Tumi",
];

export const FIRMS = [
  { archetypeId: "everyday-grocer", name: "Harvest Foods", sector: "food", vital: true, sells: "budgetFood", input: "produce", source: "Morrow Fields", production: "sourced", sourceDescription: "retail staff turn farm produce into everyday meals", x: 0.17, y: 0.28, price: 2.15, quality: 0.55, wage: 6.2, productivity: 0, transactionsPerWorker: 14, inventory: 40, initialStaff: 3, maxStaff: 6 },
  { archetypeId: "premium-grocer", name: "Green Basket", sector: "food", sells: "premiumFood", input: "produce", source: "Morrow Fields", production: "sourced", sourceDescription: "retail staff select higher-grade farm produce", x: 0.48, y: 0.22, price: 2.55, quality: 0.85, wage: 6.5, productivity: 0, transactionsPerWorker: 8, inventory: 14, initialStaff: 2, formationStaff: 1, maxStaff: 5 },
  { archetypeId: "housing-provider", name: "HomeWorks", sector: "housing", vital: true, sells: "housing", input: null, source: null, production: "fixed-service", sourceDescription: "housing staff operate the town's current dwelling service", x: 0.80, y: 0.29, price: 6, wage: 7.2, productivity: 0, transactionsPerWorker: 10, inventory: 0, initialStaff: 4, maxStaff: 6 },
  { archetypeId: "toolmaker", name: "Makers Guild", sector: "goods", sells: "learningGoods", input: null, source: null, production: "direct", sourceDescription: "guild workers make tools and repair kits locally", x: 0.25, y: 0.73, price: 6, wage: 7.8, productivity: 2.1, transactionsPerWorker: 3, inventory: 18, initialStaff: 3, maxStaff: 6 },
  { archetypeId: "cafe", name: "Common Café", sector: "service", sells: "cafeService", input: "produce", source: "Morrow Fields", production: "sourced", sourceDescription: "café staff prepare visits using farm produce", x: 0.69, y: 0.73, price: 2.2, wage: 6.4, productivity: 0, transactionsPerWorker: 4, inventory: 6, initialStaff: 2, maxStaff: 4 },
  { archetypeId: "apothecary", name: "Morrow Apothecary", sector: "health", sells: "medicine", input: "produce", source: "Morrow Fields", production: "sourced", sourceDescription: "apothecary workers compound farm produce into medicine", x: 0.35, y: 0.88, price: 3.6, wage: 6.8, productivity: 0, transactionsPerWorker: 6, inventory: 8, initialStaff: 2, formationStaff: 1, maxStaff: 4, defaultLatent: true },
  { archetypeId: "school", name: "Morrow School", sector: "education", sells: "education", input: null, source: null, production: "direct", sourceDescription: "teachers provide finite lessons that gradually improve worker skill", x: 0.86, y: 0.46, price: 4.5, wage: 7, productivity: 4, transactionsPerWorker: 5, inventory: 8, initialStaff: 2, formationStaff: 1, maxStaff: 5, defaultLatent: true },
  { archetypeId: "materials-yard", name: "Morrow Materials", sector: "construction", sells: "constructionMaterials", input: "learningGoods", source: "Makers Guild", production: "sourced", sourceDescription: "yard workers assemble guild-made kits into construction bundles", x: 0.12, y: 0.12, price: 16, wage: 7.4, productivity: 0, transactionsPerWorker: 4, inventory: 4, initialStaff: 2, formationStaff: 1, maxStaff: 4, defaultLatent: true },
  { archetypeId: "clinic", name: "Morrow Clinic", sector: "health", sells: "clinicalCare", input: "medicine", source: "Morrow Apothecary", production: "sourced", sourceDescription: "clinical staff use apothecary medicine for stronger treatment", x: 0.82, y: 0.08, price: 7.5, wage: 8, productivity: 0, transactionsPerWorker: 4, inventory: 4, initialStaff: 2, formationStaff: 1, maxStaff: 5, defaultLatent: true },
  { archetypeId: "builder", name: "Morrow Builders", sector: "construction", sells: "constructionService", input: "constructionMaterials", source: "Morrow Materials", production: "sourced", sourceDescription: "builders turn material bundles into housing expansion and repair projects", x: 0.64, y: 0.88, price: 28, wage: 8, productivity: 0, transactionsPerWorker: 3, inventory: 2, initialStaff: 2, formationStaff: 1, maxStaff: 5, defaultLatent: true },
  { archetypeId: "haulage", name: "Morrow Haulage", sector: "transport", vital: true, sells: "haulage", input: null, source: null, production: "fixed-service", sourceDescription: "transport workers carry physical goods between local firms", x: 0.45, y: 0.05, price: 0.45, wage: 5, productivity: 0, transactionsPerWorker: 1, inventory: 0, initialStaff: 2, maxStaff: 6, defaultLatent: true },
  { archetypeId: "farm", name: "Morrow Fields", sector: "agriculture", vital: true, sells: "produce", input: null, source: null, production: "direct", sourceDescription: "farm workers grow produce locally", x: 0.08, y: 0.54, price: 1.1, wage: 5.8, productivity: 9, transactionsPerWorker: 8, inventory: 36, initialStaff: 7, maxStaff: 12 },
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
