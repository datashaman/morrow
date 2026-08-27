const ACTION_LABELS = Object.freeze({
  shift: "working a scheduled shift",
  clinic: "attending the clinic",
  school: "attending a lesson",
  rest: "resting",
  "daytime-rest": "resting",
  "self-study": "self-studying",
  "park-social": "socializing in the Common Park",
  "social-visit": "visiting the café",
  "buy-comfort": "taking comfort at the café",
  "buy-learning-tools": "using learning tools",
  sleep: "sleeping",
  "late-self-study": "studying late",
});

export function citizenScheduleEvidence({ person, employer, day, block, scheduledToday, nextShiftDay, daysUntilRent }) {
  const current = person.currentPrimaryActivity?.day === day && person.currentPrimaryActivity.block === block
    ? person.currentPrimaryActivity
    : null;
  const workday = person.dailyPlan?.day === day ? person.dailyPlan.workday : null;
  return Object.freeze({
    currentActivity: current ? ACTION_LABELS[current.action] ?? current.action : block === "Morning" ? "reviewing today's plan" : "between primary activities",
    workStatus: !person.alive
      ? "no future schedule"
      : employer
        ? scheduledToday
          ? `scheduled at ${employer.name}${workday ? `; ${workday.activity} ${workday.status}` : ""}`
          : `off rota from ${employer.name} today`
        : "not employed",
    nextShift: nextShiftDay === null ? "no next shift" : nextShiftDay === day ? "next shift today" : `next shift D${nextShiftDay}`,
    nextRent: daysUntilRent === 0 ? "rent due today" : `next rent in ${daysUntilRent} day${daysUntilRent === 1 ? "" : "s"}`,
    sleep: `sleep debt ${Math.round(person.sleepDebt * 100)}% · ${person.lastSleepQuality === null ? "no completed sleep yet" : `last sleep quality ${Math.round(person.lastSleepQuality * 100)}%`}`,
  });
}
