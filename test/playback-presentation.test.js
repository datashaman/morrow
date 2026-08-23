import assert from "node:assert/strict";
import test from "node:test";
import { playbackPresentation } from "../src/playback-presentation.js";

test("zero living citizens produces a terminal playback presentation", () => {
  assert.deepEqual(playbackPresentation(0, false), {
    ended: true,
    paused: true,
    pauseDisabled: true,
    stepDisabled: true,
    resetDisabled: false,
    pauseLabel: "Town ended",
    clockSuffix: " · Town ended",
  });
});

test("a reset living town restores ordinary playback presentation", () => {
  assert.deepEqual(playbackPresentation(40, false), {
    ended: false,
    paused: false,
    pauseDisabled: false,
    stepDisabled: false,
    resetDisabled: false,
    pauseLabel: "Pause",
    clockSuffix: "",
  });
});
