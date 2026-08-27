const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export const COMMON_PARK = Object.freeze({ x: 0.5, y: 0.52, radiusX: 0.14, radiusY: 0.12 });

export function firmLandmarkLayout(firm, { width, height = 1, nameWidth = 0, metaWidth = 0 }) {
  const landmarkWidth = Math.max(120, Math.ceil(nameWidth + 24), Math.ceil(metaWidth + 24));
  const landmarkHeight = 52;
  const margin = 8;
  return {
    label: firm.name,
    width: landmarkWidth,
    height: landmarkHeight,
    centerX: clamp(firm.x * width, landmarkWidth / 2 + margin, width - landmarkWidth / 2 - margin),
    centerY: firm.y * height,
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

export function personMapTarget(person, { primaryTarget, homeTarget, graveTarget }) {
  if (!person.alive) return graveTarget;
  return primaryTarget ?? homeTarget;
}

export function deceasedMarkerSegments(x, y) {
  return [
    [x, y - 6, x, y + 6],
    [x - 4, y - 2, x + 4, y - 2],
    [x - 4, y + 6, x + 4, y + 6],
  ];
}

export function resolveCanvasColor(value, darkMode = false) {
  const match = value.trim().match(/^light-dark\(\s*([^,]+),\s*([^)]+)\s*\)$/);
  if (!match) return value.trim();
  return (darkMode ? match[2] : match[1]).trim();
}
