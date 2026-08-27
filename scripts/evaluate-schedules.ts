import { DEFAULT_SCHEDULE_EVALUATION_SEEDS, evaluateSchedules, formatScheduleEvaluation } from "../src/schedule-evaluation.ts";

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function integerList(value: string) {
  const values = value.split(",").map((item) => Number(item.trim()));
  if (!values.length || values.some((item) => !Number.isInteger(item))) throw new Error("Seeds must be comma-separated integers");
  return values;
}

const seeds = option("--seeds") ? integerList(option("--seeds") as string) : [...DEFAULT_SCHEDULE_EVALUATION_SEEDS];
const days = Number(option("--days") ?? 56);
const report = evaluateSchedules({ seeds, days });

if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else process.stdout.write(`${formatScheduleEvaluation(report)}\n`);
