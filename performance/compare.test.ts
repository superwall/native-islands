import { describe, expect, it } from "bun:test";
import {
  compare,
  LIMITS,
  missingMeasurements,
  parseBaselines,
  parseResult,
  record,
  unmatchedRuns,
  type PerfRun,
} from "./compare";

const run = (islands: number, overrides: Partial<PerfRun> = {}): PerfRun => ({
  islands,
  mountToVisibleMs: 400,
  memoryPerIslandBytes: 200_000,
  droppedFrames: 2,
  layoutMs: 1,
  ...overrides,
});

describe("compare", () => {
  const baselines = { "iPhone18,3": [run(10), run(50)] };

  it("passes a run within its limits", () => {
    expect(
      compare({ device: "iPhone18,3", runs: [run(10, { mountToVisibleMs: 640 })] }, baselines),
    ).toEqual([]);
  });

  it("flags each metric that rises past its share plus slack", () => {
    const limit = 400 * (1 + LIMITS.mountToVisibleMs.share) + LIMITS.mountToVisibleMs.slack;
    const regressions = compare(
      { device: "iPhone18,3", runs: [run(50, { mountToVisibleMs: limit + 1, droppedFrames: 40 })] },
      baselines,
    );
    expect(regressions?.map((entry) => [entry.islands, entry.metric])).toEqual([
      [50, "mountToVisibleMs"],
      [50, "droppedFrames"],
    ]);
  });

  it("treats a missing number as a regression rather than a pass", () => {
    const regressions = compare(
      { device: "iPhone18,3", runs: [run(10, { layoutMs: Number.NaN })] },
      baselines,
    );
    expect(regressions?.map((entry) => entry.metric)).toEqual(["layoutMs"]);
  });

  it("skips counts the baseline has no entry for", () => {
    expect(
      compare({ device: "iPhone18,3", runs: [run(100, { droppedFrames: 99 })] }, baselines),
    ).toEqual([]);
  });

  it("says there is no baseline for an unknown device", () => {
    expect(compare({ device: "iPhone19,1", runs: [run(10)] }, baselines)).toBeUndefined();
  });
});

describe("unmatchedRuns", () => {
  const baselines = { "iPhone18,3": [run(10), run(50), run(100)] };

  it("is empty when the run measured exactly the baseline's counts", () => {
    expect(
      unmatchedRuns({ device: "iPhone18,3", runs: [run(10), run(50), run(100)] }, baselines),
    ).toEqual([]);
  });

  it("names a count the run dropped and one the baseline lacks", () => {
    expect(
      unmatchedRuns({ device: "iPhone18,3", runs: [run(10), run(50), run(200)] }, baselines),
    ).toEqual([
      "100 islands: in the baseline but not measured",
      "200 islands: measured but not in the baseline",
    ]);
  });

  it("leaves a device with no baseline to compare", () => {
    expect(unmatchedRuns({ device: "iPhone19,1", runs: [run(10)] }, baselines)).toEqual([]);
  });
});

describe("missingMeasurements", () => {
  it("lists the metrics the app could not measure", () => {
    expect(missingMeasurements({ device: "x", runs: [run(10, { layoutMs: -1 })] })).toEqual([
      "10 islands: no layoutMs",
    ]);
  });
});

describe("record", () => {
  it("replaces only the device's own baseline", () => {
    const next = record({ device: "b", runs: [run(10)] }, { a: [run(50)] });
    expect(Object.keys(next)).toEqual(["a", "b"]);
    expect(next.b).toEqual([run(10)]);
  });
});

describe("parseResult", () => {
  it("reads a run the UI test wrote", () => {
    const result = { device: "iPhone18,3", runs: [run(10), run(50)] };
    expect(parseResult(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });

  it.each([
    ["a list", []],
    ["a run with no device", { runs: [run(10)] }],
    ["a run with a missing number", { device: "a", runs: [{ islands: 10 }] }],
    ["runs that are not a list", { device: "a", runs: {} }],
  ])("refuses %s", (_, value) => {
    expect(() => parseResult(value)).toThrow("not a performance run");
  });
});

describe("parseBaselines", () => {
  it("reads every device's runs", () => {
    expect(parseBaselines({ a: [run(10)], b: [] })).toEqual({ a: [run(10)], b: [] });
  });

  it("refuses something that is not an object, and a device that holds no runs", () => {
    expect(() => parseBaselines(null)).toThrow("not an object of devices");
    expect(() => parseBaselines({ a: "x" })).toThrow("The baseline for a is not a list of runs.");
  });
});
