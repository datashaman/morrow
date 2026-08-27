import { WEEKDAY_SHORT_NAMES, calendarForDay } from "./civil-time.js";

export function describeOpeningPattern(firm) {
  return firm.openWeekdays.map((weekday) => WEEKDAY_SHORT_NAMES[weekday]).join(", ");
}

export function firmScheduleEvidence({ firm, people, day, open, nextOpeningDay, shiftWage }) {
  const weekdayIndex = calendarForDay(day).weekdayIndex;
  const scheduled = firm.employees.filter((id) => people[id]?.rota?.firmId === firm.id && people[id].rota.weekdayIndices.includes(weekdayIndex));
  const attendees = scheduled.filter((id) => people[id]?.attended);
  return Object.freeze({
    openingPattern: describeOpeningPattern(firm),
    serviceWindow: firm.serviceWindow,
    currentState: open ? "Open" : "Closed",
    nextOpening: open ? null : nextOpeningDay,
    scheduledWorkers: scheduled.length,
    attendees: attendees.length,
    shiftWage,
    weeklyGross: shiftWage * 5,
  });
}
