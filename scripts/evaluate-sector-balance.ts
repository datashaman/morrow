import { evaluateSectorBalance, formatSectorBalance } from "../src/sector-balance.ts";

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
const report = evaluateSectorBalance({ seeds, days });

if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else process.stdout.write(`${formatSectorBalance(report)}\n`);
