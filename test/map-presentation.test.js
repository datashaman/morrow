import assert from "node:assert/strict";
import test from "node:test";
import { FIRMS } from "../src/config.js";
import {
  deceasedMarkerSegments,
  employeeOrbitTarget,
  firmLandmarkLayout,
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
