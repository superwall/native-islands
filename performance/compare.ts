export type PerfRun = {
  islands: number;
  mountToVisibleMs: number;
  memoryPerIslandBytes: number;
  droppedFrames: number;
  layoutMs: number;
};

export type PerfResult = { device: string; runs: PerfRun[] };

export type PerfBaselines = Record<string, PerfRun[]>;

const METRICS = [
  "mountToVisibleMs",
  "memoryPerIslandBytes",
  "droppedFrames",
  "layoutMs",
] as const satisfies readonly Exclude<keyof PerfRun, "islands">[];

type Metric = (typeof METRICS)[number];

export const LIMITS: Readonly<Record<Metric, { share: number; slack: number }>> = {
  mountToVisibleMs: { share: 0.25, slack: 150 },
  memoryPerIslandBytes: { share: 0.3, slack: 64 * 1024 },
  droppedFrames: { share: 1, slack: 30 },
  layoutMs: { share: 1, slack: 5 },
};

export type Regression = {
  islands: number;
  metric: Metric;
  baseline: number;
  actual: number;
  limit: number;
};

export const compare = (result: PerfResult, baselines: PerfBaselines): Regression[] | undefined => {
  const baseline = baselines[result.device];
  if (!baseline) return undefined;
  const regressions: Regression[] = [];
  for (const run of result.runs) {
    const before = baseline.find((entry) => entry.islands === run.islands);
    if (!before) continue;
    for (const metric of METRICS) {
      const { share, slack } = LIMITS[metric];
      const limit = before[metric] * (1 + share) + slack;
      if (!(run[metric] <= limit)) {
        regressions.push({
          islands: run.islands,
          metric,
          baseline: before[metric],
          actual: run[metric],
          limit,
        });
      }
    }
  }
  return regressions;
};

export const unmatchedRuns = (result: PerfResult, baselines: PerfBaselines): string[] => {
  const baseline = baselines[result.device];
  if (!baseline) return [];
  const measured = new Set(result.runs.map((run) => run.islands));
  const recorded = new Set(baseline.map((run) => run.islands));
  return [
    ...[...recorded]
      .filter((islands) => !measured.has(islands))
      .map((islands) => `${islands} islands: in the baseline but not measured`),
    ...[...measured]
      .filter((islands) => !recorded.has(islands))
      .map((islands) => `${islands} islands: measured but not in the baseline`),
  ];
};

export const missingMeasurements = (result: PerfResult): string[] =>
  result.runs.flatMap((run) =>
    METRICS.filter((metric) => !(run[metric] >= 0)).map(
      (metric) => `${run.islands} islands: no ${metric}`,
    ),
  );

export const record = (result: PerfResult, baselines: PerfBaselines): PerfBaselines => ({
  ...baselines,
  [result.device]: result.runs,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const runOf = (value: unknown): PerfRun | undefined => {
  if (!isRecord(value)) return undefined;
  const { islands, mountToVisibleMs, memoryPerIslandBytes, droppedFrames, layoutMs } = value;
  return typeof islands === "number" &&
    typeof mountToVisibleMs === "number" &&
    typeof memoryPerIslandBytes === "number" &&
    typeof droppedFrames === "number" &&
    typeof layoutMs === "number"
    ? { islands, mountToVisibleMs, memoryPerIslandBytes, droppedFrames, layoutMs }
    : undefined;
};

const runsOf = (value: unknown): PerfRun[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const runs: PerfRun[] = [];
  for (const entry of value) {
    const run = runOf(entry);
    if (!run) return undefined;
    runs.push(run);
  }
  return runs;
};

export const parseResult = (value: unknown): PerfResult => {
  const runs = isRecord(value) ? runsOf(value.runs) : undefined;
  if (!isRecord(value) || typeof value.device !== "string" || !runs) {
    throw new Error("The result is not a performance run: it needs a device and its runs.");
  }
  return { device: value.device, runs };
};

export const parseBaselines = (value: unknown): PerfBaselines => {
  if (!isRecord(value)) throw new Error("The baseline is not an object of devices.");
  const baselines: PerfBaselines = {};
  for (const [device, entry] of Object.entries(value)) {
    const runs = runsOf(entry);
    if (!runs) throw new Error(`The baseline for ${device} is not a list of runs.`);
    baselines[device] = runs;
  }
  return baselines;
};
