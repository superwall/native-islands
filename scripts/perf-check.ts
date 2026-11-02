// Compares a performance run with perf/baseline.json and fails on a regression.
//   bun scripts/perf-check.ts <result.json>            # compare
//   bun scripts/perf-check.ts <result.json> --record   # write it as the device's baseline
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  compare,
  missingMeasurements,
  record,
  unmatchedRuns,
  type PerfBaselines,
  type PerfResult,
} from "./perf-compare";

const [path, flag] = process.argv.slice(2);
if (!path) {
  console.error("usage: bun scripts/perf-check.ts <result.json> [--record]");
  process.exit(2);
}
const baselinePath = new URL("../perf/baseline.json", import.meta.url).pathname;
const result = JSON.parse(readFileSync(path, "utf8")) as PerfResult;
const baselines = (
  existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {}
) as PerfBaselines;

const missing = missingMeasurements(result);
if (missing.length > 0) {
  console.error(`The run measured nothing for: ${missing.join("; ")}`);
  process.exit(1);
}
for (const run of result.runs) {
  console.log(
    `${result.device} ${run.islands} islands: visible after ${run.mountToVisibleMs.toFixed(0)} ms, ` +
      `${(run.memoryPerIslandBytes / 1024).toFixed(0)} KB per island, ${run.droppedFrames} dropped frames, ` +
      `${run.layoutMs.toFixed(2)} ms JS per layout pass`,
  );
}
if (flag === "--record") {
  writeFileSync(baselinePath, `${JSON.stringify(record(result, baselines), null, 2)}\n`);
  console.log(`Recorded the baseline for ${result.device}.`);
  process.exit(0);
}
const regressions = compare(result, baselines);
if (!regressions) {
  console.error(`No baseline for ${result.device}. Record one with scripts/perf.sh --record.`);
  process.exit(1);
}
const unmatched = unmatchedRuns(result, baselines);
for (const gap of unmatched) {
  console.error(
    `${gap}. Run every count, or record the baseline again with scripts/perf.sh --record.`,
  );
}
for (const regression of regressions) {
  console.error(
    `Regression at ${regression.islands} islands: ${regression.metric} ${regression.actual.toFixed(2)} ` +
      `> ${regression.limit.toFixed(2)} (baseline ${regression.baseline.toFixed(2)})`,
  );
}
process.exit(regressions.length > 0 || unmatched.length > 0 ? 1 : 0);
