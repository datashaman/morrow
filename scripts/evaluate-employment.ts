import {
  DEFAULT_EMPLOYMENT_EVALUATION_SEEDS,
  evaluateEmploymentIntervention,
  formatEmploymentEvaluation,
} from "../src/employment-evaluation.ts";

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function integerList(value: string) {
  const values = value.split(",").map((item) => Number(item.trim()));
  if (!values.length || values.some((item) => !Number.isInteger(item))) throw new Error("Seeds must be comma-separated integers");
  return values;
}

const seeds = integerList(option("--seeds") ?? DEFAULT_EMPLOYMENT_EVALUATION_SEEDS.join(","));
const days = Number(option("--days") ?? 60);
const report = evaluateEmploymentIntervention({ seeds, days });

if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else process.stdout.write(`${formatEmploymentEvaluation(report)}\n`);
