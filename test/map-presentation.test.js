import assert from "node:assert/strict";
import test from "node:test";
import { FIRMS } from "../src/config.js";
import {
  applicantFirmId,
  applicantOrbitTarget,
  COMMON_PARK,
  deceasedMarkerSegments,
  employeeOrbitTarget,
  firmLandmarkLayout,
  landmarkClearsPark,
  parkVisitorTarget,
  personMapTarget,
  resolveCanvasColor,
} from "../src/map-presentation.js";

test("firm landmarks retain the full name and stay inside the canvas", () => {
  const firm = { name: "Morrow Fields", x: 0.02, y: 0.68 };
  const layout = firmLandmarkLayout(firm, { width: 600, nameWidth: 96 });

  assert.equal(layout.label, "Morrow Fields");
  assert.ok(layout.width >= 120);
  assert.ok(layout.centerX - layout.width / 2 >= 8);
});

test("employee orbit targets remain outside their workplace plaque", () => {
  const firm = { x: 0.48, y: 0.22 };
  const viewport = { width: 900, height: 520 };
  const landmark = { centerX: firm.x * viewport.width, centerY: firm.y * viewport.height, width: 124, height: 52 };
  const targets = Array.from({ length: 7 }, (_, index) => employeeOrbitTarget(index, 7, landmark, viewport));

  targets.forEach((target) => {
    const xDistance = Math.abs(target.x * viewport.width - landmark.centerX);
    const yDistance = Math.abs(target.y * viewport.height - landmark.centerY);
    assert.ok(xDistance > landmark.width / 2 || yDistance > landmark.height / 2);
  });
  assert.equal(new Set(targets.map(({ x, y }) => `${x.toFixed(4)},${y.toFixed(4)}`)).size, targets.length);
});

test("unemployed citizens apply only to active firms with approved vacancies", () => {
  const firms = [
    { id: 0, active: true, targetStaff: 3, employees: [0, 1] },
    { id: 1, active: false, targetStaff: 4, employees: [] },
    { id: 2, active: true, targetStaff: 2, employees: [2, 3] },
    { id: 3, active: true, targetStaff: 4, employees: [4, 5] },
  ];

  assert.equal(applicantFirmId({ jobApplicationFirm: 0 }, firms), 0);
  assert.equal(applicantFirmId({ jobApplicationFirm: 3 }, firms), 3);
  assert.equal(applicantFirmId({ jobApplicationFirm: 1 }, firms), null);
  assert.equal(applicantFirmId({ jobApplicationFirm: 2 }, firms), null);
  assert.equal(applicantFirmId({ jobApplicationFirm: -1 }, firms), null);
  assert.equal(applicantFirmId({ jobApplicationFirm: 0 }, firms.map((firm) => ({ ...firm, targetStaff: firm.employees.length }))), null);
});

test("applicants wait outside the firm plaque", () => {
  const viewport = { width: 900, height: 520 };
  const landmark = { centerX: 450, centerY: 220, width: 124, height: 52 };
  const target = applicantOrbitTarget(1, 4, landmark, viewport);
  const xDistance = Math.abs(target.x * viewport.width - landmark.centerX);
  const yDistance = Math.abs(target.y * viewport.height - landmark.centerY);

  assert.ok(xDistance > landmark.width / 2 || yDistance > landmark.height / 2);
});

test("park visitors mill deterministically within the Common Park", () => {
  const park = { x: 0.5, y: 0.52, radiusX: 0.14, radiusY: 0.12 };
  const first = parkVisitorTarget(7, park, 12_000);
  const repeated = parkVisitorTarget(7, park, 12_000);
  const later = parkVisitorTarget(7, park, 24_000);
  const ellipticalDistance = ((first.x - park.x) / park.radiusX) ** 2 + ((first.y - park.y) / park.radiusY) ** 2;

  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first, later);
  assert.ok(ellipticalDistance < 1);
});

test("map targets prioritize death, employment, applications, then the park", () => {
  const parkTarget = { x: 0.5, y: 0.5 };
  const applicationTarget = { x: 0.2, y: 0.2 };
  const employeeTarget = { x: 0.8, y: 0.2 };
  const graveTarget = { x: 0.9, y: 0.8 };

  assert.deepEqual(personMapTarget({ alive: false, employer: -1 }, { parkTarget, applicationTarget, employeeTarget, graveTarget }), graveTarget);
  assert.deepEqual(personMapTarget({ alive: true, employer: 2 }, { parkTarget, applicationTarget, employeeTarget, graveTarget }), employeeTarget);
  assert.deepEqual(personMapTarget({ alive: true, employer: -1 }, { parkTarget, applicationTarget, employeeTarget, graveTarget }), applicationTarget);
  assert.deepEqual(personMapTarget({ alive: true, employer: -1 }, { parkTarget, applicationTarget: null, employeeTarget, graveTarget }), parkTarget);
});

test("the deceased marker is a cross-and-base silhouette rather than a living circle", () => {
  assert.deepEqual(deceasedMarkerSegments(20, 30), [
    [20, 24, 20, 36],
    [16, 28, 24, 28],
    [16, 36, 24, 36],
  ]);
});

test("canvas colors resolve the browser light-dark token before drawing", () => {
  assert.equal(resolveCanvasColor("light-dark(#e9e7df, #181a18)"), "#e9e7df");
  assert.equal(resolveCanvasColor("light-dark(#e9e7df, #181a18)", true), "#181a18");
  assert.equal(resolveCanvasColor("rgb(1, 2, 3)"), "rgb(1, 2, 3)");
});

test("firm landmarks do not overlap at the narrow map width", () => {
  const layouts = FIRMS.map((firm) => firmLandmarkLayout(firm, {
    width: 550,
    height: 390,
    nameWidth: firm.name.length * 8,
    metaWidth: 122,
  }));

  layouts.forEach((layout, index) => layouts.slice(index + 1).forEach((other) => {
    const separatedHorizontally = Math.abs(layout.centerX - other.centerX) >= (layout.width + other.width) / 2 + 4;
    const separatedVertically = Math.abs(layout.centerY - other.centerY) >= (layout.height + other.height) / 2 + 4;
    assert.ok(separatedHorizontally || separatedVertically, `${layout.label} overlaps ${other.label}`);
  }));
});

test("firm landmarks remain outside the Common Park at supported map sizes", () => {
  [{ width: 550, height: 390 }, { width: 1200, height: 520 }].forEach((viewport) => {
    FIRMS.forEach((firm) => {
      const landmark = firmLandmarkLayout(firm, {
        ...viewport,
        nameWidth: firm.name.length * 8,
        metaWidth: 122,
      });
      assert.equal(landmarkClearsPark(landmark, viewport, COMMON_PARK), true, `${firm.name} overlaps the Common Park at ${viewport.width}×${viewport.height}`);
    });
  });
});
