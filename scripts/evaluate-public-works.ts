import {
  DEFAULT_PUBLIC_WORKS_EVALUATION_DAYS,
  DEFAULT_PUBLIC_WORKS_EVALUATION_SEEDS,
  evaluatePublicWorks,
  formatPublicWorksEvaluation,
} from "../src/public-works-evaluation.ts";

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function integerList(value: string) {
  const values = value.split(",").map((item) => Number(item.trim()));
  if (!values.length || values.some((item) => !Number.isInteger(item))) throw new Error("Seeds must be comma-separated integers");
  return values;
}

const seeds = option("--seeds") ? integerList(option("--seeds") as string) : [...DEFAULT_PUBLIC_WORKS_EVALUATION_SEEDS];
const days = Number(option("--days") ?? DEFAULT_PUBLIC_WORKS_EVALUATION_DAYS);
const report = evaluatePublicWorks({ seeds, days, replay: !process.argv.includes("--no-replay") });

if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else process.stdout.write(`${formatPublicWorksEvaluation(report)}\n`);
