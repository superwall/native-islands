import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compareBuilds,
  compareVersions,
  describe as describeDifference,
  diff,
  parseTree,
  report,
  run,
  summarize,
  type Difference,
  type TreeNode,
  type ViewTree,
} from "./webkit-tree-diff";

const node = (type: string, overrides: Partial<TreeNode> = {}): TreeNode => ({
  type,
  frame: [0, 0, 390, 844],
  hidden: false,
  children: [],
  ...overrides,
});

const list = (overrides: Partial<TreeNode> = {}) =>
  node("WKChildScrollView", {
    probe: "list",
    frame: [10, 20, 180, 160],
    scroll: [180, 1200, 0, 0],
    ...overrides,
  });

const tree = (system: string, ...children: TreeNode[]): ViewTree => ({
  system,
  userAgent: `iPhone OS ${system}`,
  viewport: [390, 844],
  root: node("WKWebView", { children: [node("WKScrollView", { children })] }),
});

describe("parseTree", () => {
  it("reads a tree the Swift probe writes", () => {
    const parsed = parseTree(JSON.parse(JSON.stringify(tree("27.0", list()))));
    expect(parsed.system).toBe("27.0");
    expect(parsed.root.children[0]?.children[0]?.probe).toBe("list");
    expect(parsed.root.children[0]?.children[0]?.scroll).toEqual([180, 1200, 0, 0]);
  });

  it("fills in what an older file leaves out", () => {
    const parsed = parseTree({ system: "17.5", root: { type: "WKWebView", frame: [0, 0, 1, 1] } });
    expect(parsed).toEqual({
      system: "17.5",
      userAgent: "",
      viewport: [],
      root: { type: "WKWebView", frame: [0, 0, 1, 1], hidden: false, children: [] },
    });
  });

  it("refuses a file that is not a tree", () => {
    expect(() => parseTree({ root: {} })).toThrow("needs the system");
    expect(() => parseTree({ system: "27.0", root: { type: "WKWebView" } })).toThrow(
      "root is not a view",
    );
    expect(() =>
      parseTree({
        system: "27.0",
        root: { type: "WKWebView", frame: [], children: [{ frame: [] }] },
      }),
    ).toThrow("root.children[0] is not a view");
  });
});

describe("summarize", () => {
  it("records each probe's type, ancestry and geometry, and counts view types", () => {
    const summary = summarize(tree("27.0", node("WKCompositingView", { children: [list()] })));
    expect(summary.probes.list).toEqual({
      type: "WKChildScrollView",
      path: "WKWebView/WKScrollView/WKCompositingView",
      frame: [10, 20, 180, 160],
      scroll: [180, 1200, 0, 0],
    });
    expect(summary.types).toEqual({
      WKWebView: 1,
      WKScrollView: 1,
      WKCompositingView: 1,
      WKChildScrollView: 1,
    });
  });

  it("leaves out the scroll of a view that does not scroll", () => {
    const summary = summarize(tree("27.0", node("WKCompositingView", { probe: "cover" })));
    expect(summary.probes.cover).toEqual({
      type: "WKCompositingView",
      path: "WKWebView/WKScrollView",
      frame: [0, 0, 390, 844],
    });
  });
});

describe("diff", () => {
  const base = summarize(tree("27.0", node("WKCompositingView", { children: [list()] })));

  it("finds nothing between identical trees or within a point", () => {
    const nudged = summarize(
      tree(
        "27.0",
        node("WKCompositingView", { children: [list({ frame: [10.5, 20, 180, 161] })] }),
      ),
    );
    expect(diff(base, nudged)).toEqual([]);
  });

  it("reports a probe with no view, and one only the other tree has", () => {
    expect(diff(base, summarize(tree("17.5", node("WKCompositingView"))))).toContainEqual({
      kind: "missing",
      probe: "list",
    });
    const extra = summarize(
      tree("17.5", node("WKCompositingView", { children: [list()] }), node("X", { probe: "new" })),
    );
    expect(diff(base, extra)).toContainEqual({ kind: "added", probe: "new" });
  });

  it("reports a new view type, a move, a new frame and new scroll geometry", () => {
    const moved = summarize(
      tree(
        "17.5",
        list({ type: "UIScrollView", frame: [10, 30, 180, 160], scroll: [180, 900, 0, 0] }),
      ),
    );
    expect(diff(base, moved)).toEqual([
      { kind: "type", probe: "list", base: "WKChildScrollView", actual: "UIScrollView" },
      {
        kind: "path",
        probe: "list",
        base: "WKWebView/WKScrollView/WKCompositingView",
        actual: "WKWebView/WKScrollView",
      },
      { kind: "frame", probe: "list", base: [10, 20, 180, 160], actual: [10, 30, 180, 160] },
      { kind: "scroll", probe: "list", base: [180, 1200, 0, 0], actual: [180, 900, 0, 0] },
      { kind: "viewType", type: "UIScrollView", base: 0, actual: 1 },
      { kind: "viewType", type: "WKChildScrollView", base: 1, actual: 0 },
      { kind: "viewType", type: "WKCompositingView", base: 1, actual: 0 },
    ]);
  });

  it("reports a view that stopped scrolling and frames of another length", () => {
    const flat = summarize(
      tree(
        "17.5",
        node("WKCompositingView", { children: [list({ scroll: undefined, frame: [10, 20] })] }),
      ),
    );
    expect(diff(base, flat)).toEqual([
      { kind: "frame", probe: "list", base: [10, 20, 180, 160], actual: [10, 20] },
      { kind: "scroll", probe: "list", base: [180, 1200, 0, 0], actual: undefined },
    ]);
  });
});

describe("compareVersions", () => {
  it("orders systems by number, not text", () => {
    expect(["27.0", "17.5", "26.10", "26.4", "26"].toSorted(compareVersions)).toEqual([
      "17.5",
      "26",
      "26.4",
      "26.10",
      "27.0",
    ]);
    expect(compareVersions("26.1", "26.1.0")).toBe(0);
  });
});

describe("describe", () => {
  it("says what changed in a line", () => {
    const lines = (
      [
        { kind: "missing", probe: "list" },
        { kind: "added", probe: "new" },
        { kind: "type", probe: "list", base: "A", actual: "B" },
        { kind: "path", probe: "fixed", base: "A/B/C", actual: "A/C" },
        { kind: "frame", probe: "list", base: [1, 2], actual: [3, 4] },
        { kind: "scroll", probe: "list", base: undefined, actual: [5] },
        { kind: "scroll", probe: "list", base: [5], actual: undefined },
        { kind: "viewType", type: "BackdropView", base: 1, actual: 0 },
      ] satisfies Difference[]
    ).map(describeDifference);
    expect(lines).toEqual([
      "list: no view",
      "new: has a view the base has not",
      "list: A became B",
      "fixed: moved from 3 deep, under B/C to 2 deep, under A/C",
      "list: frame [1, 2] became [3, 4]",
      "list: scroll [none] became [5]",
      "list: scroll [5] became [none]",
      "BackdropView: 1 view(s) became 0",
    ]);
  });
});

describe("summaries of one version", () => {
  it("tell runtimes apart by build and order them by it", () => {
    const seed = summarize({ ...tree("27.2", list()), build: "24B5110a" });
    const release = summarize({ ...tree("27.2", list()), build: "24B114" });
    expect(seed.name).toBe("27.2 (24B5110a)");
    expect(parseTree({ ...tree("27.2"), build: "24B114" }).build).toBe("24B114");
    expect(report([release, seed]).lines).toEqual([
      "Compared with iOS 27.2 (24B114):",
      "  iOS 27.2 (24B5110a): same",
    ]);
  });

  it("put a seed before its release, however its build number sorts", () => {
    expect(compareBuilds("24B91016s", "24B114")).toBeLessThan(0);
    expect(compareBuilds("24B114", "24B91016s")).toBeGreaterThan(0);
    expect(compareBuilds("24A5408d", "24A94425")).toBeLessThan(0);
    expect(compareBuilds("24B114", "24B114")).toBe(0);
    expect(compareBuilds("24B5110a", "24B91016s")).toBeLessThan(0);
  });
});

describe("report", () => {
  const newest = summarize(tree("27.0", list()));
  const same = summarize(tree("26.4", list()));
  const lost = summarize(tree("17.5"));

  it("compares every runtime with the newest and flags a lost probe as breaking", () => {
    const result = report([lost, newest, same]);
    expect(result.lines).toEqual([
      "Compared with iOS 27.0:",
      "  iOS 17.5: 2 difference(s)",
      "    BREAKS list: no view",
      "    WKChildScrollView: 1 view(s) became 0",
      "  iOS 26.4: same",
    ]);
    expect(result).toMatchObject({ breaking: true, changed: true });
  });

  it("compares with the base it is given", () => {
    expect(report([newest, same], "26.4")).toEqual({
      lines: ["Compared with iOS 26.4:", "  iOS 27.0: same"],
      breaking: false,
      changed: false,
    });
    expect(() => report([newest], "16.0")).toThrow("No tree for iOS 16.0");
    expect(() => report([])).toThrow("No tree for iOS (none)");
  });
});

describe("run", () => {
  let directory: string | undefined;
  afterEach(() => {
    if (directory) rmSync(directory, { recursive: true, force: true });
    directory = undefined;
  });

  const write = (trees: ViewTree[]) => {
    directory = mkdtempSync(join(tmpdir(), "webkit-trees-"));
    for (const entry of trees) {
      writeFileSync(join(directory, `ios-${entry.system}.json`), JSON.stringify(entry));
    }
    writeFileSync(join(directory, "notes.txt"), "not a tree");
    return directory;
  };

  it("prints usage without inputs", () => {
    expect(run([]).code).toBe(2);
    expect(run(["--strict"]).output[0]).toStartWith("usage:");
  });

  it("reads every tree in a folder and passes when nothing breaks", () => {
    const folder = write([tree("27.0", list()), tree("17.5", list({ frame: [10, 30, 180, 160] }))]);
    expect(run([folder])).toEqual({
      output: [
        "Compared with iOS 27.0:",
        "  iOS 17.5: 1 difference(s)",
        "    list: frame [10, 20, 180, 160] became [10, 30, 180, 160]",
      ],
      code: 0,
    });
    expect(run([folder, "--strict"]).code).toBe(1);
  });

  it("fails when a probe loses its view", () => {
    const folder = write([tree("27.0", list()), tree("17.5")]);
    expect(run([folder]).code).toBe(1);
  });

  it("takes files and a base file by name", () => {
    const folder = write([tree("27.0", list()), tree("26.4", list())]);
    const files = [join(folder, "ios-27.0.json"), join(folder, "ios-26.4.json")];
    expect(run([...files, "--base", "ios-26.4.json"]).output[0]).toBe("Compared with iOS 26.4:");
    expect(run([...files, "--base", "ios-15.0.json"])).toEqual({
      output: ["No tree file ios-15.0.json among the inputs."],
      code: 2,
    });
  });
});
