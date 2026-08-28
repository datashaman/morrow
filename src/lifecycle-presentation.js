import { LIFECYCLE_STAGE_START_DAYS, PARTNERSHIP_COOLDOWN_DAYS } from "./config.js";

const STAGE_LABELS = Object.freeze({ infant: "Infant", child: "Child", student: "Student", adult: "Adult" });

export function lifecycleStageLabel(stage) {
  return STAGE_LABELS[stage] ?? stage;
}

export function lifecycleEventLabel(type) {
  return type.split("-").map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" ");
}

export function nextLifecycleTransition(person, day) {
  if (person.birthDay === null) return Object.freeze({ ageDays: null, nextStage: null, transitionDay: null, daysRemaining: null });
  const ageDays = Math.max(0, day - person.birthDay);
  const nextStage = person.lifecycleStage === "infant" ? "child" : person.lifecycleStage === "child" ? "student" : person.lifecycleStage === "student" ? "adult" : null;
  if (!nextStage) return Object.freeze({ ageDays, nextStage: null, transitionDay: null, daysRemaining: null });
  const transitionDay = person.birthDay + LIFECYCLE_STAGE_START_DAYS[nextStage];
  return Object.freeze({ ageDays, nextStage, transitionDay, daysRemaining: Math.max(0, transitionDay - day) });
}

const namesFor = (ids, people) => ids.map((id) => people[id]?.name).filter(Boolean);

export function citizenLifecycleEvidence(person, { people, gestations, day }) {
  const transition = nextLifecycleTransition(person, day);
  const children = people.filter((candidate) => candidate.parentIds.includes(person.id));
  const currentDependents = people.filter((candidate) => candidate.alive && candidate.isDependent && candidate.guardianIds.includes(person.id));
  const activeGestation = gestations.find((gestation) => gestation.status === "active" && gestation.parentIds.includes(person.id)) ?? null;
  const cooldownEndDay = person.lastPartnershipEndDay === null ? null : person.lastPartnershipEndDay + PARTNERSHIP_COOLDOWN_DAYS;
  const scheduledLessons = person.schoolHistory.filter((record) => record.scheduled).slice(0, 5);
  const latestLesson = scheduledLessons[0] ?? null;
  return Object.freeze({
    stage: person.lifecycleStage,
    stageLabel: lifecycleStageLabel(person.lifecycleStage),
    ...transition,
    parentNames: namesFor(person.parentIds, people),
    guardianNames: namesFor(person.guardianIds, people),
    formerGuardianNames: namesFor(person.formerGuardianIds, people),
    residentialGuardianName: person.residentialGuardianId === null ? null : people[person.residentialGuardianId]?.name ?? null,
    partnerName: person.partnerId === null ? null : people[person.partnerId]?.name ?? null,
    childNames: children.map((child) => child.name),
    dependentNames: currentDependents.map((dependent) => dependent.name),
    activeGestationDueDay: activeGestation?.dueDay ?? null,
    cooldownEndDay: cooldownEndDay !== null && cooldownEndDay > day ? cooldownEndDay : null,
    latestLesson,
    missedLessons: scheduledLessons.filter((record) => record.outcome !== "attended").length,
    scheduledLessonCount: scheduledLessons.length,
    treasuryGuardian: person.treasuryGuardian,
  });
}

export function citizenSelectorOptions(people) {
  return people.map((person) => Object.freeze({
    value: person.id,
    label: `${person.name} · ${person.alive ? lifecycleStageLabel(person.lifecycleStage) : `Died D${person.deathDay}`}`,
  }));
}
