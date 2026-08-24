import { writeFile } from "node:fs/promises";
import { evaluatePersonalTimeActivationGate } from "../src/neural-activation-evaluation.ts";
import { BUNDLED_NEURAL_WEIGHTS } from "../src/neural-runtime.ts";

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const seeds = (option("--seeds") ?? "101,202,303,404,505").split(",").map((value) => Number(value.trim()));
if (!seeds.length || seeds.some((seed) => !Number.isInteger(seed))) throw new Error("Seeds must be comma-separated integers");
const days = Number(option("--days") ?? 30);
const output = option("--output");
const result = evaluatePersonalTimeActivationGate({ weights: BUNDLED_NEURAL_WEIGHTS, seeds, days });
const json = `${JSON.stringify(result, null, 2)}\n`;

if (output) {
  await writeFile(output, json, "utf8");
  process.stdout.write(`Wrote ${result.gate.passed ? "passed" : "failed"} activation gate to ${output}\n`);
} else process.stdout.write(json);

if (!result.gate.passed) process.exitCode = 1;
