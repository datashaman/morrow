export const PHASES = [
  "Production",
  "Payroll",
  "Food shopping",
  "Housing & bills",
  "Personal time",
  "Settlement",
];

export const NAMES = [
  "Amina", "Jonah", "Thandi", "Leo", "Maya", "Kwame", "Sofia", "Noah",
  "Zuri", "Eli", "Naledi", "Mateo", "Imani", "Lucas", "Aya", "Sam",
  "Lebo", "Nora", "Dineo", "Theo", "Amara", "Ben", "Mila", "Kofi",
  "Lina", "Adam", "Tara", "Yusuf", "Nia", "Max", "Ravi", "Ella",
  "Sizwe", "Ana", "Omar", "Luca", "Priya", "Kai", "Mara", "Tumi",
];

export const FIRMS = [
  { name: "Harvest Foods", sector: "food", x: 0.17, y: 0.28, price: 2.6, wage: 6.2, productivity: 3.1, transactionsPerWorker: 4, inventory: 58, initialStaff: 6, maxStaff: 9, demand: 20 },
  { name: "Green Basket", sector: "food", x: 0.48, y: 0.22, price: 2.8, wage: 6.5, productivity: 2.9, transactionsPerWorker: 4, inventory: 48, initialStaff: 6, maxStaff: 9, demand: 18 },
  { name: "HomeWorks", sector: "housing", x: 0.80, y: 0.29, price: 4.8, wage: 7.2, productivity: 0.2, transactionsPerWorker: 10, inventory: 0, initialStaff: 4, maxStaff: 6, demand: 36 },
  { name: "Makers Guild", sector: "goods", x: 0.25, y: 0.73, price: 8.5, wage: 7.8, productivity: 2.1, transactionsPerWorker: 3, inventory: 18, initialStaff: 4, maxStaff: 6, demand: 6 },
  { name: "Common Café", sector: "service", x: 0.69, y: 0.73, price: 4.4, wage: 6.4, productivity: 2.2, transactionsPerWorker: 4, inventory: 20, initialStaff: 4, maxStaff: 6, demand: 7 },
];

export const DEFAULT_POLICY = {
  minimumWage: 5,
  taxRate: 12,
  supportRate: 35,
  discretionaryDemand: 50,
  shockRisk: 20,
};
