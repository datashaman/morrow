import {
  evaluateKnowledgeTracer,
  formatKnowledgeEvaluation,
  KNOWLEDGE_WHOLE_TOWN_DAYS,
  KNOWLEDGE_WHOLE_TOWN_SEEDS,
} from "../src/knowledge-evaluation.ts";

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function integerList(value: string) {
  const values = value.split(",").map((item) => Number(item.trim()));
  if (!values.length || values.some((item) => !Number.isInteger(item))) throw new Error("Seeds must be comma-separated integers");
  return values;
}

const seeds = integerList(option("--seeds") ?? KNOWLEDGE_WHOLE_TOWN_SEEDS.join(","));
const days = Number(option("--days") ?? KNOWLEDGE_WHOLE_TOWN_DAYS);
const report = evaluateKnowledgeTracer({ seeds, days });

if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else process.stdout.write(`${formatKnowledgeEvaluation(report)}\n`);
if (report.status === "failed") process.exitCode = 1;
