/** One measured run: the page with `islands` glass buttons. */
export type PerfRun = {
  islands: number;
  mountToVisibleMs: number;
  memoryPerIslandBytes: number;
  droppedFrames: number;
  layoutMs: number;
};

/** What `PerformanceUITests` writes, and what a baseline holds per device. */
export type PerfResult = { device: string; runs: PerfRun[] };

/** Baselines by device model, such as `iPhone18,3`. */
export type PerfBaselines = Record<string, PerfRun[]>;

type Metric = Exclude<keyof PerfRun, "islands">;

/**
 * How far each metric may rise over its baseline before the run fails: a
 * share of the baseline plus a fixed slack, since small numbers on a shared
 * simulator move by more than their share. Dropped frames move most: the same
 * run drops 4 or 26 frames at 50 islands, and a layout pass costs 5 or 10 ms,
 * so for those two only a large rise fails.
 */
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

/**
 * Compares `result` with the baseline recorded for its device. Returns the
 * regressions, or `undefined` when the device has no baseline yet.
 */
export const compare = (result: PerfResult, baselines: PerfBaselines): Regression[] | undefined => {
  const baseline = baselines[result.device];
  if (!baseline) return undefined;
  const regressions: Regression[] = [];
  for (const run of result.runs) {
    const before = baseline.find((entry) => entry.islands === run.islands);
    if (!before) continue;
    for (const metric of Object.keys(LIMITS) as Metric[]) {
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

/**
 * The island counts the run and the device's baseline don't share: a count
 * the run dropped, or one the baseline has never seen. `compare` only judges
 * the counts both have, so either gap would otherwise pass unseen. Empty when
 * the device has no baseline.
 */
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

/** Every run must have measured something: the app reports -1 when it could not. */
export const missingMeasurements = (result: PerfResult): string[] =>
  result.runs.flatMap((run) =>
    (Object.keys(LIMITS) as Metric[])
      .filter((metric) => !(run[metric] >= 0))
      .map((metric) => `${run.islands} islands: no ${metric}`),
  );

/** Writes `result` as its device's baseline. */
export const record = (result: PerfResult, baselines: PerfBaselines): PerfBaselines => ({
  ...baselines,
  [result.device]: result.runs,
});
