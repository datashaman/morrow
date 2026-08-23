export const PHASES = [
  "Production",
  "Payroll",
  "Food shopping",
  "Housing & bills",
  "Personal time",
  "Settlement",
];

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

export const NAMES = [
  "Amina", "Jonah", "Thandi", "Leo", "Maya", "Kwame", "Sofia", "Noah",
  "Zuri", "Eli", "Naledi", "Mateo", "Imani", "Lucas", "Aya", "Sam",
  "Lebo", "Nora", "Dineo", "Theo", "Amara", "Ben", "Mila", "Kofi",
  "Lina", "Adam", "Tara", "Yusuf", "Nia", "Max", "Ravi", "Ella",
  "Sizwe", "Ana", "Omar", "Luca", "Priya", "Kai", "Mara", "Tumi",
];

export const FIRMS = [
  { name: "Harvest Foods", sector: "food", x: 0.17, y: 0.28, price: 1.8, quality: 0.55, wage: 6.2, productivity: 5.4, transactionsPerWorker: 4, inventory: 58, initialStaff: 6, maxStaff: 9 },
  { name: "Green Basket", sector: "food", x: 0.48, y: 0.22, price: 2, quality: 0.85, wage: 6.5, productivity: 5.1, transactionsPerWorker: 4, inventory: 48, initialStaff: 6, maxStaff: 9 },
  { name: "HomeWorks", sector: "housing", x: 0.80, y: 0.29, price: 6, wage: 7.2, productivity: 0.2, transactionsPerWorker: 10, inventory: 0, initialStaff: 4, maxStaff: 6 },
  { name: "Makers Guild", sector: "goods", x: 0.25, y: 0.73, price: 6, wage: 7.8, productivity: 2.1, transactionsPerWorker: 3, inventory: 18, initialStaff: 4, maxStaff: 6 },
  { name: "Common Café", sector: "service", x: 0.69, y: 0.73, price: 2.2, wage: 6.4, productivity: 2.2, transactionsPerWorker: 4, inventory: 20, initialStaff: 4, maxStaff: 6 },
];

export const DEFAULT_POLICY = {
  minimumWage: 5,
  taxRate: 12,
  supportRate: 35,
  discretionaryDemand: 50,
  shockRisk: 20,
};
