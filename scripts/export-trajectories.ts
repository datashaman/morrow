import { writeFile } from "node:fs/promises";
import { exportTrajectoryDataset } from "../src/trajectory-export.ts";

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const seeds = (option("--seeds") ?? "101,202,303,404,505").split(",").map((value) => Number(value.trim()));
if (!seeds.length || seeds.some((seed) => !Number.isInteger(seed))) throw new Error("Seeds must be comma-separated integers");
const days = Number(option("--days") ?? 90);
const output = option("--output") ?? "morrow-trajectories.json";
const dataset = exportTrajectoryDataset({ seeds, days });
const json = `${JSON.stringify(dataset, null, 2)}\n`;

if (output === "-") process.stdout.write(json);
else {
  await writeFile(output, json, "utf8");
  process.stdout.write(`Wrote ${dataset.samples.length} synthetic decisions to ${output}\n`);
}
