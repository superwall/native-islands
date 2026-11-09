import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

/**
 * Checks that the agent skills in this folder still match the code they
 * teach: the agentskills.io frontmatter, every relative link, every import
 * from `native-islands` in a code example, and every NativeIslands type a
 * Swift example names.
 */

export type Problem = { file: string; message: string };

export type CodeBlock = { lang: string; code: string };

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FRONTMATTER_KEYS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "allowed-tools",
  "metadata",
]);
export const MAX_NAME_LENGTH = 64;
export const MAX_DESCRIPTION_LENGTH = 1024;
export const MAX_SKILL_LINES = 500;

export const parseFrontmatter = (text: string) => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) return undefined;
  const fields = new Map<string, string>();
  for (const line of (match[1] ?? "").split("\n")) {
    const field = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!field) continue;
    const value = (field[2] ?? "").trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
    fields.set(field[1] ?? "", value);
  }
  return { fields, body: text.slice(match[0].length) };
};

export const checkFrontmatter = (folder: string, text: string): string[] => {
  const frontmatter = parseFrontmatter(text);
  if (!frontmatter) return ["has no frontmatter between --- lines"];
  const { fields } = frontmatter;
  const problems: string[] = [];
  for (const key of fields.keys()) {
    if (!FRONTMATTER_KEYS.has(key)) problems.push(`has an unknown frontmatter key "${key}"`);
  }
  const name = fields.get("name") ?? "";
  if (!NAME_PATTERN.test(name) || name.length > MAX_NAME_LENGTH) {
    problems.push(`name "${name}" is not lowercase words joined by hyphens, at most 64 characters`);
  }
  if (name !== folder) problems.push(`name "${name}" differs from its folder "${folder}"`);
  const description = fields.get("description") ?? "";
  if (description.length === 0 || /^[>|]/.test(description)) {
    problems.push("description is missing or not on one line");
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    problems.push(
      `description is ${description.length} characters, over ${MAX_DESCRIPTION_LENGTH}`,
    );
  }
  return problems;
};

export const codeBlocks = (markdown: string): CodeBlock[] =>
  [...markdown.matchAll(/^```([\w-]*)[^\n]*\n([\s\S]*?)^```$/gm)].map((match) => ({
    lang: match[1] ?? "",
    code: match[2] ?? "",
  }));

const withoutCode = (markdown: string) =>
  markdown.replace(/^```[\s\S]*?^```$/gm, "").replace(/`[^`\n]*`/g, "");

export const links = (markdown: string): string[] =>
  [...withoutCode(markdown).matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map(
    (match) => match[1] ?? "",
  );

export const slug = (heading: string) =>
  heading
    .replace(/`/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/ /g, "-");

export const anchors = (markdown: string) =>
  new Set(
    [...markdown.replace(/^```[\s\S]*?^```$/gm, "").matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) =>
      slug(match[1] ?? ""),
    ),
  );

const isExternal = (target: string) => /^[a-z][a-z0-9+.-]*:/i.test(target);

/** The relative links of one file that do not resolve inside the skill. */
export const checkLinks = (file: string, markdown: string, skillRoot: string): string[] => {
  const problems: string[] = [];
  for (const target of links(markdown)) {
    if (isExternal(target)) continue;
    const [path = "", anchor] = target.split("#");
    const destination = path === "" ? file : resolve(dirname(file), decodeURIComponent(path));
    const inside = relative(skillRoot, destination);
    if (inside.startsWith("..") || inside.startsWith(sep)) {
      problems.push(`links outside the skill, which an installed skill does not have: ${target}`);
      continue;
    }
    if (!existsSync(destination)) {
      problems.push(`links to a missing file: ${target}`);
      continue;
    }
    if (anchor && destination.endsWith(".md")) {
      if (!anchors(readFileSync(destination, "utf8")).has(anchor)) {
        problems.push(`links to a missing heading: ${target}`);
      }
    }
  }
  return problems;
};

/** The Markdown files under `root` that no chain of links from `SKILL.md` reaches. */
export const unreachable = (root: string): string[] => {
  const all = markdownFiles(root);
  const seen = new Set<string>();
  const queue = [join(root, "SKILL.md")];
  while (queue.length > 0) {
    const file = queue.pop() ?? "";
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    for (const target of links(readFileSync(file, "utf8"))) {
      const path = target.split("#")[0] ?? "";
      if (isExternal(target) || !path.endsWith(".md")) continue;
      queue.push(resolve(dirname(file), decodeURIComponent(path)));
    }
  }
  return all.filter((file) => !seen.has(file));
};

export const markdownFiles = (root: string): string[] =>
  readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return path.endsWith(".md") ? [path] : [];
  });

export type ImportStatement = { source: string; names: string[]; hasDefault: boolean };

export const jsImports = (code: string): ImportStatement[] => {
  const statements: ImportStatement[] = [];
  for (const match of code.matchAll(
    /^\s*import\s+(?:type\s+)?([^;"']*?)\s+from\s+["']([^"']+)["']/gm,
  )) {
    const clause = match[1] ?? "";
    const braces = /\{([\s\S]*)\}/.exec(clause)?.[1] ?? "";
    const names = braces
      .split(",")
      .map(
        (name) =>
          name
            .trim()
            .replace(/^type\s+/, "")
            .split(/\s+as\s+/)[0] ?? "",
      )
      .filter((name) => name.length > 0);
    const hasDefault = /^[A-Za-z_$][\w$]*(?:\s*,|$)/.test(clause.trim());
    statements.push({ source: match[2] ?? "", names, hasDefault });
  }
  for (const match of code.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) {
    statements.push({ source: match[1] ?? "", names: [], hasDefault: false });
  }
  return statements;
};

const sourceFile = (base: string) =>
  [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")].find(
    (path) => existsSync(path) && statSync(path).isFile(),
  );

/** Every name a TypeScript module exports, following `export … from` to its source. */
export const moduleExports = (file: string, seen = new Set<string>()): Set<string> => {
  const names = new Set<string>();
  if (seen.has(file)) return names;
  seen.add(file);
  const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const words = part
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/);
      const name = (words[1] ?? words[0] ?? "").trim();
      if (name) names.add(name);
    }
  }
  for (const match of source.matchAll(/export\s+\*\s+as\s+(\w+)/g)) names.add(match[1] ?? "");
  for (const match of source.matchAll(/export\s+\*\s+from\s+["']([^"']+)["']/g)) {
    const next = sourceFile(resolve(dirname(file), match[1] ?? ""));
    if (next) for (const name of moduleExports(next, seen)) names.add(name);
  }
  const declaration =
    /export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(?:const|let|var|function\*?|class|type|interface|enum)\s+(\w+)/g;
  for (const match of source.matchAll(declaration)) names.add(match[1] ?? "");
  if (/export\s+default\b/.test(source)) names.add("default");
  return names;
};

export type PackageEntry = { exports: Set<string> } | { stylesheet: true };

/** The entries of the web package, keyed by the specifier a page imports. */
export const packageEntries = (packageDir: string): Map<string, PackageEntry> => {
  const manifest: unknown = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
  const entries = new Map<string, PackageEntry>();
  if (typeof manifest !== "object" || manifest === null || !("exports" in manifest)) return entries;
  const { exports } = manifest;
  if (typeof exports !== "object" || exports === null) return entries;
  const name = "name" in manifest && typeof manifest.name === "string" ? manifest.name : "";
  for (const [key, value] of Object.entries(exports)) {
    if (typeof value !== "object" || value === null || !("source" in value)) continue;
    const { source } = value;
    if (typeof source !== "string") continue;
    const specifier = key === "." ? name : `${name}${key.slice(1)}`;
    const path = join(packageDir, source);
    entries.set(
      specifier,
      path.endsWith(".css") ? { stylesheet: true } : { exports: moduleExports(path) },
    );
  }
  return entries;
};

/** Imports from the web package that its entries do not have. */
export const checkImports = (
  blocks: CodeBlock[],
  entries: Map<string, PackageEntry>,
  packageName: string,
): string[] => {
  const problems: string[] = [];
  for (const block of blocks) {
    if (!["ts", "tsx", "js", "jsx", "typescript", "javascript"].includes(block.lang)) continue;
    for (const statement of jsImports(block.code)) {
      const { source } = statement;
      if (source !== packageName && !source.startsWith(`${packageName}/`)) continue;
      const entry = entries.get(source);
      if (!entry) {
        problems.push(`imports "${source}", which the package does not export`);
        continue;
      }
      const exported = "exports" in entry ? entry.exports : new Set<string>();
      if ("stylesheet" in entry && (statement.names.length > 0 || statement.hasDefault)) {
        problems.push(`imports names from the stylesheet "${source}"`);
      }
      if (statement.hasDefault && "exports" in entry && !exported.has("default")) {
        problems.push(`imports a default from "${source}", which has none`);
      }
      for (const name of statement.names) {
        if ("exports" in entry && !exported.has(name)) {
          problems.push(`imports ${name} from "${source}", which does not export it`);
        }
      }
    }
  }
  return problems;
};

const swiftFiles = (root: string): string[] =>
  readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) return swiftFiles(path);
    return path.endsWith(".swift") ? [path] : [];
  });

const DECLARATION = /\b(?:class|struct|enum|protocol|typealias|actor)\s+(\w+)/g;

export const swiftDeclarations = (code: string) =>
  new Set([...code.matchAll(DECLARATION)].map((match) => match[1] ?? ""));

/** The types the Swift libraries declare, and the libraries `Package.swift` ships. */
export const swiftSymbols = (repo: string) => {
  const types = new Set<string>();
  for (const file of swiftFiles(join(repo, "packages/swift/Sources"))) {
    for (const name of swiftDeclarations(readFileSync(file, "utf8"))) types.add(name);
  }
  const manifest = readFileSync(join(repo, "Package.swift"), "utf8");
  const modules = new Set(
    [...manifest.matchAll(/\.library\(name:\s*"(\w+)"/g)].map((match) => match[1] ?? ""),
  );
  return { types, modules };
};

/**
 * NativeIslands names in Swift examples that the libraries do not declare:
 * `import NativeIslands…` of a library that does not exist, and any type
 * starting with `Native` or `Island` that neither the libraries nor the
 * example itself declares.
 */
export const checkSwift = (
  blocks: CodeBlock[],
  symbols: { types: Set<string>; modules: Set<string> },
): string[] => {
  const problems: string[] = [];
  for (const block of blocks) {
    if (block.lang !== "swift") continue;
    const local = swiftDeclarations(block.code);
    for (const match of block.code.matchAll(/^\s*import\s+(\w+)/gm)) {
      const module = match[1] ?? "";
      if (module.startsWith("NativeIslands") && !symbols.modules.has(module)) {
        problems.push(`imports the Swift library ${module}, which Package.swift does not ship`);
      }
    }
    const code = block.code
      .replace(/^\s*import\s+\w+$/gm, "")
      .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
    for (const match of code.matchAll(/\b(?:Native|Island)[A-Z]\w*/g)) {
      const name = match[0];
      if (!symbols.types.has(name) && !local.has(name) && !symbols.modules.has(name)) {
        problems.push(`names the Swift type ${name}, which the libraries do not declare`);
      }
    }
  }
  return [...new Set(problems)];
};

/** Every problem with one skill folder. */
export const checkSkill = (skillRoot: string, repo: string): Problem[] => {
  const problems: Problem[] = [];
  const add = (file: string, messages: string[]) => {
    for (const message of messages) problems.push({ file: relative(repo, file), message });
  };
  const skillFile = join(skillRoot, "SKILL.md");
  if (!existsSync(skillFile))
    return [{ file: relative(repo, skillRoot), message: "has no SKILL.md" }];
  const skill = readFileSync(skillFile, "utf8");
  const folder = skillRoot.split(sep).at(-1) ?? "";
  add(skillFile, checkFrontmatter(folder, skill));
  const lines = skill.split("\n").length;
  if (lines > MAX_SKILL_LINES) {
    add(skillFile, [
      `is ${lines} lines; keep SKILL.md under ${MAX_SKILL_LINES} and move detail to references`,
    ]);
  }
  const webPackage = join(repo, "packages/web");
  const entries = packageEntries(webPackage);
  const symbols = swiftSymbols(repo);
  for (const file of markdownFiles(skillRoot)) {
    const markdown = readFileSync(file, "utf8");
    const blocks = codeBlocks(markdown);
    add(file, checkLinks(file, markdown, skillRoot));
    add(file, checkImports(blocks, entries, "native-islands"));
    add(file, checkSwift(blocks, symbols));
  }
  for (const file of unreachable(skillRoot)) {
    add(file, ["is not reachable by links from SKILL.md"]);
  }
  return problems;
};

/** The skill folders in `root`: every folder that is not a hidden one. */
export const skillFolders = (root: string) =>
  readdirSync(root)
    .filter((entry) => !entry.startsWith(".") && statSync(join(root, entry)).isDirectory())
    .map((entry) => join(root, entry));
