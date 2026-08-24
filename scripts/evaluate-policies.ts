import { evaluatePolicies, formatEvaluationSummary } from "../src/policy-evaluation.ts";

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function integerList(value: string) {
  const values = value.split(",").map((item) => Number(item.trim()));
  if (!values.length || values.some((item) => !Number.isInteger(item))) throw new Error("Seeds must be comma-separated integers");
  return values;
}

const seeds = integerList(option("--seeds") ?? "101,202,303,404,505");
const days = Number(option("--days") ?? 90);
const policies = (option("--policies") ?? "motivation").split(",").map((name) => name.trim()).filter(Boolean);
const baseline = option("--baseline") ?? "rule";
const report = evaluatePolicies({ seeds, days, policies, baseline });

if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else process.stdout.write(`${formatEvaluationSummary(report)}\n`);

if (report.status === "failed") process.exitCode = 1;
