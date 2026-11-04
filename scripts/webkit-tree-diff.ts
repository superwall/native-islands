// Compares the WebKit view trees `WebKitLayoutTests` writes, one per iOS
// runtime, against one of them: where each probed element's view sits, its
// type, frame and scroll geometry, and which view types WebKit builds at all.
//
//   bun scripts/webkit-tree-diff.ts build/webkit-trees
//   bun scripts/webkit-tree-diff.ts build/webkit-trees --base ios-27.0.json --strict
//
// It exits 1 when a probe has no view or a view of another type on some
// runtime, and with --strict on any difference.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

export type TreeNode = {
  type: string;
  frame: number[];
  probe?: string;
  scroll?: number[];
  hidden: boolean;
  children: TreeNode[];
};

export type ViewTree = {
  system: string;
  build?: string;
  userAgent: string;
  viewport: number[];
  root: TreeNode;
};

export type ProbedView = { type: string; path: string; frame: number[]; scroll?: number[] };

export type Summary = {
  system: string;
  /** The system and, when known, its build: "27.2 (24B114)". */
  name: string;
  build: string;
  userAgent: string;
  probes: Record<string, ProbedView>;
  types: Record<string, number>;
};

export type Difference =
  | { kind: "missing"; probe: string }
  | { kind: "added"; probe: string }
  | { kind: "type"; probe: string; base: string; actual: string }
  | { kind: "path"; probe: string; base: string; actual: string }
  | { kind: "frame"; probe: string; base: number[]; actual: number[] }
  | { kind: "scroll"; probe: string; base: number[] | undefined; actual: number[] | undefined }
  | { kind: "viewType"; type: string; base: number; actual: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNumbers = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "number");

const parseNode = (value: unknown, at: string): TreeNode => {
  if (!isRecord(value) || typeof value.type !== "string" || !isNumbers(value.frame)) {
    throw new Error(`${at} is not a view: it needs a type and a frame.`);
  }
  const children = Array.isArray(value.children) ? value.children : [];
  const node: TreeNode = {
    type: value.type,
    frame: value.frame,
    hidden: value.hidden === true,
    children: children.map((child, index) => parseNode(child, `${at}.children[${index}]`)),
  };
  if (typeof value.probe === "string") node.probe = value.probe;
  if (isNumbers(value.scroll)) node.scroll = value.scroll;
  return node;
};

export const parseTree = (value: unknown): ViewTree => {
  if (!isRecord(value) || typeof value.system !== "string") {
    throw new Error("The file is not a WebKit view tree: it needs the system it ran on.");
  }
  return {
    system: value.system,
    ...(typeof value.build === "string" ? { build: value.build } : {}),
    userAgent: typeof value.userAgent === "string" ? value.userAgent : "",
    viewport: isNumbers(value.viewport) ? value.viewport : [],
    root: parseNode(value.root, "root"),
  };
};

export const summarize = (tree: ViewTree): Summary => {
  const probes: Record<string, ProbedView> = {};
  const types: Record<string, number> = {};
  const walk = (node: TreeNode, ancestors: string[]) => {
    types[node.type] = (types[node.type] ?? 0) + 1;
    if (node.probe !== undefined) {
      probes[node.probe] = {
        type: node.type,
        path: ancestors.join("/"),
        frame: node.frame,
        ...(node.scroll ? { scroll: node.scroll } : {}),
      };
    }
    for (const child of node.children) walk(child, [...ancestors, node.type]);
  };
  walk(tree.root, []);
  const build = tree.build ?? "";
  const name = build ? `${tree.system} (${build})` : tree.system;
  return { system: tree.system, name, build, userAgent: tree.userAgent, probes, types };
};

const sameNumbers = (left: number[] | undefined, right: number[] | undefined, tolerance = 1) =>
  left === undefined || right === undefined
    ? left === right
    : left.length === right.length &&
      left.every((value, index) => Math.abs(value - (right[index] ?? Number.NaN)) <= tolerance);

export const diff = (base: Summary, actual: Summary): Difference[] => {
  const differences: Difference[] = [];
  const ids = [...new Set([...Object.keys(base.probes), ...Object.keys(actual.probes)])].toSorted();
  for (const probe of ids) {
    const before = base.probes[probe];
    const after = actual.probes[probe];
    if (!after) {
      differences.push({ kind: "missing", probe });
      continue;
    }
    if (!before) {
      differences.push({ kind: "added", probe });
      continue;
    }
    if (before.type !== after.type) {
      differences.push({ kind: "type", probe, base: before.type, actual: after.type });
    }
    if (before.path !== after.path) {
      differences.push({ kind: "path", probe, base: before.path, actual: after.path });
    }
    if (!sameNumbers(before.frame, after.frame)) {
      differences.push({ kind: "frame", probe, base: before.frame, actual: after.frame });
    }
    if (!sameNumbers(before.scroll, after.scroll)) {
      differences.push({ kind: "scroll", probe, base: before.scroll, actual: after.scroll });
    }
  }
  const types = [...new Set([...Object.keys(base.types), ...Object.keys(actual.types)])].toSorted();
  for (const type of types) {
    const before = base.types[type] ?? 0;
    const after = actual.types[type] ?? 0;
    if (before !== after) differences.push({ kind: "viewType", type, base: before, actual: after });
  }
  return differences;
};

export const isBreaking = (difference: Difference): boolean =>
  difference.kind === "missing" || difference.kind === "type";

const versionOf = (system: string): number[] =>
  system.split(".").map((part) => Number.parseInt(part, 10) || 0);

export const compareVersions = (left: string, right: string): number => {
  const a = versionOf(left);
  const b = versionOf(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
};

const ancestry = (path: string) => {
  const parts = path.split("/");
  return `${parts.length} deep, under ${parts.slice(-2).join("/")}`;
};

export const describe = (difference: Difference): string => {
  switch (difference.kind) {
    case "missing":
      return `${difference.probe}: no view`;
    case "added":
      return `${difference.probe}: has a view the base has not`;
    case "type":
      return `${difference.probe}: ${difference.base} became ${difference.actual}`;
    case "path":
      return `${difference.probe}: moved from ${ancestry(difference.base)} to ${ancestry(difference.actual)}`;
    case "frame":
      return `${difference.probe}: frame [${difference.base.join(", ")}] became [${difference.actual.join(", ")}]`;
    case "scroll":
      return `${difference.probe}: scroll [${difference.base?.join(", ") ?? "none"}] became [${difference.actual?.join(", ") ?? "none"}]`;
    case "viewType":
      return `${difference.type}: ${difference.base} view(s) became ${difference.actual}`;
  }
};

export type Report = { lines: string[]; breaking: boolean; changed: boolean };

/**
 * Orders two builds of one version: a seed, such as 24B91016s or 24B5110a,
 * ends in a letter and comes before the release, such as 24B114.
 */
export const compareBuilds = (left: string, right: string): number =>
  isRelease(left) - isRelease(right) || left.localeCompare(right, undefined, { numeric: true });

const isRelease = (build: string): number => (/[a-z]$/.test(build) ? 0 : 1);

/** Compares every summary with the one named `base`, the newest without it. */
export const report = (summaries: Summary[], base?: string): Report => {
  const sorted = summaries.toSorted(
    (left, right) =>
      compareVersions(left.system, right.system) || compareBuilds(left.build, right.build),
  );
  const reference = base ? sorted.find((summary) => summary.name === base) : sorted.at(-1);
  if (!reference) throw new Error(`No tree for iOS ${base ?? "(none)"} to compare against.`);
  const lines = [`Compared with iOS ${reference.name}:`];
  let breaking = false;
  let changed = false;
  for (const summary of sorted) {
    if (summary === reference) continue;
    const differences = diff(reference, summary);
    breaking ||= differences.some(isBreaking);
    changed ||= differences.length > 0;
    if (differences.length === 0) {
      lines.push(`  iOS ${summary.name}: same`);
      continue;
    }
    lines.push(`  iOS ${summary.name}: ${differences.length} difference(s)`);
    for (const difference of differences) {
      lines.push(`    ${isBreaking(difference) ? "BREAKS " : ""}${describe(difference)}`);
    }
  }
  return { lines, breaking, changed };
};

const treeFiles = (paths: string[]): string[] =>
  paths.flatMap((path) =>
    statSync(path).isDirectory()
      ? readdirSync(path)
          .filter((name) => name.endsWith(".json"))
          .toSorted()
          .map((name) => join(path, name))
      : [path],
  );

export const run = (args: string[]): { output: string[]; code: number } => {
  const strict = args.includes("--strict");
  const baseIndex = args.indexOf("--base");
  const baseFile = baseIndex >= 0 ? args[baseIndex + 1] : undefined;
  const paths = args.filter(
    (arg, index) =>
      arg !== "--strict" && (baseIndex < 0 || (index !== baseIndex && index !== baseIndex + 1)),
  );
  if (paths.length === 0) {
    return {
      output: [
        "usage: bun scripts/webkit-tree-diff.ts <dir or files> [--base ios-27.0.json] [--strict]",
      ],
      code: 2,
    };
  }
  const files = treeFiles(paths);
  const summaries = files.map((file) =>
    summarize(parseTree(JSON.parse(readFileSync(file, "utf8")))),
  );
  const base = baseFile
    ? summaries[files.findIndex((file) => basename(file) === basename(baseFile))]?.name
    : undefined;
  if (baseFile && !base) return { output: [`No tree file ${baseFile} among the inputs.`], code: 2 };
  const result = report(summaries, base);
  return { output: result.lines, code: result.breaking || (strict && result.changed) ? 1 : 0 };
};

if (import.meta.main) {
  const { output, code } = run(process.argv.slice(2));
  process.stdout.write(`${output.join("\n")}\n`);
  process.exit(code);
}
