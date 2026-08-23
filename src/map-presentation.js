const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

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

export function employeeOrbitTarget(index, count, landmark, viewport) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, count);
  const clearance = 18;
  const x = landmark.centerX + Math.cos(angle) * (landmark.width / 2 + clearance);
  const y = landmark.centerY + Math.sin(angle) * (landmark.height / 2 + clearance);
  return {
    x: clamp(x / viewport.width, 6 / viewport.width, 1 - 6 / viewport.width),
    y: clamp(y / viewport.height, 6 / viewport.height, 1 - 6 / viewport.height),
  };
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
