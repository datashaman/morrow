import assert from "node:assert/strict";
import test from "node:test";
import { COOPERATION_EVALUATION_MODES, evaluateCooperation, formatCooperationEvaluation } from "../src/cooperation-evaluation.ts";

const config = { seeds: [59], days: 7 };

test("cooperation evaluation replays three isolated modes deterministically", () => {
  const report = evaluateCooperation(config);

  assert.doesNotThrow(() => JSON.parse(JSON.stringify(report)));
  assert.equal(report.status, "passed");
  assert.deepEqual(report.metadata.modes, [...COOPERATION_EVALUATION_MODES]);
  assert.equal(report.runs[0].deterministicReplay, true);
  assert.deepEqual(report.runs[0].modes.map((mode) => mode.mode), ["legacy", "public-social", "mutual-aid"]);
  assert.equal(report.runs[0].modes[0].mutualAid.eligibleOptions, 0);
  assert.equal(report.runs[0].modes[1].mutualAid.eligibleOptions, 0);
  assert.ok(report.runs[0].modes.every((mode) => Object.values(mode.hardChecks).every(Boolean)));
});

test("cooperation report includes social, aid, hardship, concentration, and invariant evidence", () => {
  const report = evaluateCooperation(config);
  report.runs[0].modes.forEach((mode) => {
    assert.deepEqual(Object.keys(mode), ["mode", "completedDays", "trajectory", "social", "mutualAid", "hardship", "hardChecks"]);
    assert.ok("givingConcentration" in mode.mutualAid);
    assert.ok("treasurySupportAmount" in mode.hardship);
  });
  assert.match(formatCooperationEvaluation(report), /3 modes × 7 days · PASSED/);
  assert.match(report.metadata.interpretation, /observations—not pass criteria/);
});

test("cooperation evaluation rejects invalid configurations", () => {
  assert.throws(() => evaluateCooperation({ seeds: [], days: 7 }), /integer seed/);
  assert.throws(() => evaluateCooperation({ seeds: [59], days: 0 }), /positive integer/);
});
