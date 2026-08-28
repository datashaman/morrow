const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export const COMMON_PARK = Object.freeze({ x: 0.5, y: 0.52, radiusX: 0.14, radiusY: 0.12 });
export const CEMETERY = Object.freeze({ x: 0.88, y: 0.82, widthRatio: 0.16, maxWidth: 120, height: 90 });

export function firmLandmarkLayout(firm, { width, height = 1, nameWidth = 0, metaWidth = 0 }) {
  const landmarkWidth = Math.max(120, Math.ceil(nameWidth + 24), Math.ceil(metaWidth + 24));
  const landmarkHeight = 52;
  const margin = 8;
  return {
    label: firm.name,
    width: landmarkWidth,
    height: landmarkHeight,
    centerX: clamp((firm.mapX ?? firm.x) * width, landmarkWidth / 2 + margin, width - landmarkWidth / 2 - margin),
    centerY: (firm.mapY ?? firm.y) * height,
  };
}

export function landmarkClearsPark(landmark, viewport, park = COMMON_PARK, clearance = 8) {
  const parkX = park.x * viewport.width;
  const parkY = park.y * viewport.height;
  const xDistance = Math.max(0, Math.abs(landmark.centerX - parkX) - landmark.width / 2 - clearance);
  const yDistance = Math.max(0, Math.abs(landmark.centerY - parkY) - landmark.height / 2 - clearance);
  return (xDistance / (park.radiusX * viewport.width)) ** 2
    + (yDistance / (park.radiusY * viewport.height)) ** 2 > 1;
}

export function employeeOrbitTarget(index, count, landmark, viewport) {
  return firmOrbitTarget(index, count, landmark, viewport, 18);
}

export function applicantOrbitTarget(index, count, landmark, viewport) {
  return firmOrbitTarget(index, count, landmark, viewport, 34);
}

function firmOrbitTarget(index, count, landmark, viewport, clearance) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, count);
  const x = landmark.centerX + Math.cos(angle) * (landmark.width / 2 + clearance);
  const y = landmark.centerY + Math.sin(angle) * (landmark.height / 2 + clearance);
  return {
    x: clamp(x / viewport.width, 6 / viewport.width, 1 - 6 / viewport.width),
    y: clamp(y / viewport.height, 6 / viewport.height, 1 - 6 / viewport.height),
  };
}

export function applicantFirmId(person, firms) {
  const firm = firms.find((candidate) => candidate.id === person.jobApplicationFirm);
  return firm?.active && firm.targetStaff > firm.employees.length ? firm.id : null;
}

function homeActivityReason(action, place) {
  if (action === "sleep") return `Sleeping ${place}`;
  if (["self-study", "late-self-study"].includes(action)) return `Studying ${place}`;
  if (action === "rest") return `Resting ${place}`;
  return `Spending time ${place}`;
}

function firmActivityReason(action, firmName) {
  if (action === "shift") return `Working at ${firmName}`;
  if (["clinic", "dependent-clinic"].includes(action)) return `Receiving care at ${firmName}`;
  if (["school", "dependent-school"].includes(action)) return `Studying at ${firmName}`;
  if (action === "buy-learning-tools") return `Using learning tools at ${firmName}`;
  return `Visiting ${firmName}`;
}

export function personMapPresence(person, { activity = null, activityFirm = null, applicantFirm = null } = {}) {
  if (!person.alive) return Object.freeze({ kind: "cemetery", firmId: null, reason: "Interred in the cemetery" });
  if (activity?.action === "park-social") return Object.freeze({ kind: "park", firmId: null, reason: "Socialising in the Common Park" });
  if (activityFirm) return Object.freeze({ kind: "firm", firmId: activityFirm.id, reason: firmActivityReason(activity.action, activityFirm.name) });
  if (activity) {
    const atHome = person.housed ? "at home" : "in the Common Park while unhoused";
    return Object.freeze({ kind: person.housed ? "home" : "park", firmId: null, reason: homeActivityReason(activity.action, atHome) });
  }
  if (!person.isDependent && person.employer < 0) {
    if (applicantFirm) return Object.freeze({ kind: "applicant", firmId: applicantFirm.id, reason: `Applying at ${applicantFirm.name}` });
    return Object.freeze({ kind: "park", firmId: null, reason: "Seeking work in the Common Park; no current application" });
  }
  if (!person.housed) return Object.freeze({ kind: "park", firmId: null, reason: "In the Common Park while unhoused" });
  return Object.freeze({ kind: "home", firmId: null, reason: "At home between primary activities" });
}

export function parkVisitorTarget(personId, park, elapsedMs = 0) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const direction = personId % 2 === 0 ? 1 : -1;
  const angle = personId * goldenAngle + direction * elapsedMs / 24_000;
  const ring = 0.38 + (personId % 4) * 0.12;
  return {
    x: park.x + Math.cos(angle) * park.radiusX * ring,
    y: park.y + Math.sin(angle) * park.radiusY * ring,
  };
}

export function personMapTarget(presence, { firmTarget, applicantTarget, parkTarget, homeTarget, graveTarget }) {
  if (presence.kind === "cemetery") return graveTarget;
  if (presence.kind === "firm") return firmTarget;
  if (presence.kind === "applicant") return applicantTarget;
  if (presence.kind === "park") return parkTarget;
  return homeTarget;
}

export function deceasedMarkerSegments(x, y) {
  return [
    [x, y - 6, x, y + 6],
    [x - 4, y - 2, x + 4, y - 2],
    [x - 4, y + 6, x + 4, y + 6],
  ];
}

export function livingMarkerPresentation(person, selected = false) {
  if (!person.alive) return Object.freeze({ kind: "deceased", radius: 0, selectedRadius: selected ? 9 : null });
  if (!person.isDependent) return Object.freeze({ kind: "adult", radius: selected ? 7 : 5, selectedRadius: selected ? 9 : null });
  const radius = person.lifecycleStage === "infant" ? 4 : person.lifecycleStage === "child" ? 5 : 6;
  return Object.freeze({ kind: "dependent", radius, selectedRadius: selected ? radius + 3 : null });
}

export function resolveCanvasColor(value, darkMode = false) {
  const match = value.trim().match(/^light-dark\(\s*([^,]+),\s*([^)]+)\s*\)$/);
  if (!match) return value.trim();
  return (darkMode ? match[2] : match[1]).trim();
}
