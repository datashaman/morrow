import { writeFile } from "node:fs/promises";
import { evaluatePersonalizationResearch } from "../src/personalization-evaluation.ts";
import { BUNDLED_NEURAL_ARTIFACT, BUNDLED_NEURAL_WEIGHTS } from "../src/neural-runtime.ts";

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function seeds(value: string) {
  const parsed = value.split(",").map((item) => Number(item.trim()));
  if (!parsed.length || parsed.some((item) => !Number.isInteger(item))) throw new Error("Seeds must be comma-separated integers");
  return parsed;
}

const report = evaluatePersonalizationResearch({
  weights: BUNDLED_NEURAL_WEIGHTS,
  baseTrainingSamples: Number(BUNDLED_NEURAL_ARTIFACT.training.samples ?? 0),
  trainingSeeds: seeds(option("--training-seeds") ?? "11,22,33,44,55"),
  trainingDays: Number(option("--training-days") ?? 15),
  evaluationSeeds: seeds(option("--evaluation-seeds") ?? "101,202,303,404,505"),
  evaluationDays: Number(option("--evaluation-days") ?? 30),
});
const output = option("--output");
const json = `${JSON.stringify(report, null, 2)}\n`;
if (output) {
  await writeFile(output, json, "utf8");
  process.stdout.write(`Wrote ${report.status} personalization research report to ${output}\n`);
} else process.stdout.write(json);
if (report.status !== "passed") process.exitCode = 1;
