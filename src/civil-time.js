export const WEEKDAYS = Object.freeze(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
export const WEEKDAY_SHORT_NAMES = Object.freeze(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
export const CIVIL_TIME_BLOCKS = Object.freeze(["Morning", "Workday", "Evening", "Overnight"]);
export const PROCESSING_PHASES = Object.freeze([
  "Planning",
  "Production",
  "Procurement",
  "Payroll",
  "Food",
  "Housing",
  "Personal time",
  "Settlement",
]);
export const PHASE_BLOCKS = Object.freeze({
  Planning: "Morning",
  Production: "Workday",
  Procurement: "Workday",
  Payroll: "Workday",
  Food: "Evening",
  Housing: "Evening",
  "Personal time": "Evening",
  Settlement: "Overnight",
});

const PHASE_ALIASES = Object.freeze({
  "Supply & procurement": "Procurement",
  "Food shopping": "Food",
  "Housing & bills": "Housing",
  "Housing and bills": "Housing",
});

export function calendarForDay(day) {
  if (!Number.isInteger(day) || day < 1) throw new Error("Civil day must be a positive integer");
  const weekdayIndex = (day - 1) % WEEKDAYS.length;
  return Object.freeze({
    day,
    week: Math.floor((day - 1) / WEEKDAYS.length) + 1,
    weekdayIndex,
    weekday: WEEKDAYS[weekdayIndex],
    weekdayShort: WEEKDAY_SHORT_NAMES[weekdayIndex],
    weekend: weekdayIndex >= 5,
  });
}

export function processingPhaseIdentity(phase) {
  if (Number.isInteger(phase)) return PROCESSING_PHASES[phase] ?? null;
  if (typeof phase !== "string") return null;
  const normalized = PHASE_ALIASES[phase] ?? phase;
  return PROCESSING_PHASES.includes(normalized) ? normalized : null;
}

export function temporalMetadata(day, phase) {
  calendarForDay(day);
  const processingPhase = processingPhaseIdentity(phase);
  if (!processingPhase) throw new Error(`Unknown processing phase: ${phase}`);
  return Object.freeze({
    block: PHASE_BLOCKS[processingPhase],
    processingPhase,
    phaseIndex: PROCESSING_PHASES.indexOf(processingPhase),
  });
}

function recordPhaseIndex(record) {
  if (Number.isInteger(record.phaseIndex)) return record.phaseIndex;
  const identity = processingPhaseIdentity(record.processingPhase ?? record.phaseName ?? record.phase);
  return identity ? PROCESSING_PHASES.indexOf(identity) : -1;
}

export function compareTemporalNewest(left, right) {
  return (right.day ?? 0) - (left.day ?? 0)
    || recordPhaseIndex(right) - recordPhaseIndex(left)
    || (right.sequence ?? 0) - (left.sequence ?? 0);
}

export function formatTemporalRecord(record) {
  const calendar = calendarForDay(record.day);
  const processingPhase = processingPhaseIdentity(record.processingPhase ?? record.phaseName ?? record.phase);
  const block = record.block ?? (processingPhase ? PHASE_BLOCKS[processingPhase] : null);
  return [`W${calendar.week} ${calendar.weekdayShort}`, block, processingPhase].filter(Boolean).join(" · ");
}
