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
  learningGoods: { name: "Learning tools", unit: "item" },
  cafeService: { name: "Prepared café service", unit: "visit" },
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

export const NAMES = [
  "Amina", "Jonah", "Thandi", "Leo", "Maya", "Kwame", "Sofia", "Noah",
  "Zuri", "Eli", "Naledi", "Mateo", "Imani", "Lucas", "Aya", "Sam",
  "Lebo", "Nora", "Dineo", "Theo", "Amara", "Ben", "Mila", "Kofi",
  "Lina", "Adam", "Tara", "Yusuf", "Nia", "Max", "Ravi", "Ella",
  "Sizwe", "Ana", "Omar", "Luca", "Priya", "Kai", "Mara", "Tumi",
];

export const FIRMS = [
  { name: "Harvest Foods", sector: "food", vital: true, sells: "budgetFood", input: "produce", source: "Morrow Fields", production: "sourced", sourceDescription: "retail staff turn farm produce into everyday meals", x: 0.17, y: 0.28, price: 1.8, quality: 0.55, wage: 6.2, productivity: 0, transactionsPerWorker: 8, inventory: 22, initialStaff: 3, maxStaff: 6 },
  { name: "Green Basket", sector: "food", sells: "premiumFood", input: "produce", source: "Morrow Fields", production: "sourced", sourceDescription: "retail staff select higher-grade farm produce", x: 0.48, y: 0.22, price: 2, quality: 0.85, wage: 6.5, productivity: 0, transactionsPerWorker: 8, inventory: 14, initialStaff: 2, maxStaff: 5 },
  { name: "HomeWorks", sector: "housing", vital: true, sells: "housing", input: null, source: null, production: "fixed-service", sourceDescription: "housing staff operate the town's current dwelling service", x: 0.80, y: 0.29, price: 6, wage: 7.2, productivity: 0, transactionsPerWorker: 10, inventory: 0, initialStaff: 4, maxStaff: 6 },
  { name: "Makers Guild", sector: "goods", sells: "learningGoods", input: null, source: null, production: "direct", sourceDescription: "guild workers make learning tools locally", x: 0.25, y: 0.73, price: 6, wage: 7.8, productivity: 2.1, transactionsPerWorker: 3, inventory: 18, initialStaff: 3, maxStaff: 6 },
  { name: "Common Café", sector: "service", sells: "cafeService", input: "produce", source: "Morrow Fields", production: "sourced", sourceDescription: "café staff prepare visits using farm produce", x: 0.69, y: 0.73, price: 2.2, wage: 6.4, productivity: 0, transactionsPerWorker: 4, inventory: 6, initialStaff: 2, maxStaff: 4 },
  { name: "Morrow Fields", sector: "agriculture", vital: true, sells: "produce", input: null, source: null, production: "direct", sourceDescription: "farm workers grow produce locally", x: 0.08, y: 0.68, price: 1.1, wage: 5.8, productivity: 9, transactionsPerWorker: 8, inventory: 36, initialStaff: 7, maxStaff: 12 },
];

export const SUPPLY_CONTRACTS = [
  { supplier: "Morrow Fields", buyer: "Harvest Foods", product: "produce", output: "budgetFood", dailyQuantity: 22, unitPrice: 1.1 },
  { supplier: "Morrow Fields", buyer: "Green Basket", product: "produce", output: "premiumFood", dailyQuantity: 14, unitPrice: 1.25 },
  { supplier: "Morrow Fields", buyer: "Common Café", product: "produce", output: "cafeService", dailyQuantity: 3, unitPrice: 1.1 },
];

export const DEFAULT_POLICY = {
  minimumWage: 5,
  taxRate: 12,
  supportRate: 35,
  discretionaryDemand: 50,
  shockRisk: 20,
};
