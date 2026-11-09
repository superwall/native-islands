import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import {
  checkCatalogue,
  checkFrontmatter,
  checkImports,
  checkLinks,
  checkSkill,
  checkInlineSymbols,
  checkSwift,
  codeBlocks,
  codeNames,
  inlineCode,
  jsImports,
  links,
  moduleExports,
  packageEntries,
  parseFrontmatter,
  skillFolders,
  slug,
  swiftComponentNames,
  swiftSymbols,
  unreachable,
  valueExports,
  type PackageEntry,
} from "./check";

const repo = resolve(import.meta.dir, "..");
const skillsRoot = import.meta.dir;

const fence = (lang: string, code: string) => `\`\`\`${lang}\n${code}\n\`\`\`\n`;

const skill = (description = "Does a thing. Use when the thing is needed.", name = "demo") =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# Demo\n`;

let temporary: string[] = [];

const folder = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), "skills-"));
  temporary.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};

afterEach(() => {
  for (const root of temporary) rmSync(root, { recursive: true, force: true });
  temporary = [];
});

describe("the skills in this repository", () => {
  const folders = skillFolders(skillsRoot);

  it("include native-islands", () => {
    expect(folders.map((path) => path.split("/").at(-1))).toContain("native-islands");
  });

  for (const path of folders) {
    it(`${path.split("/").at(-1)} matches the code it teaches`, () => {
      expect(checkSkill(path, repo)).toEqual([]);
    });
  }

  it("native-islands lists every ready-made island in its catalogue", () => {
    const catalogue = readFileSync(
      join(skillsRoot, "native-islands/references/components.md"),
      "utf8",
    );
    expect(
      checkCatalogue(
        catalogue,
        swiftComponentNames(repo),
        valueExports(join(repo, "packages/web/src/components/index.ts")),
      ),
    ).toEqual([]);
  });
});

describe("the catalogue", () => {
  it("reads every Swift island, the map and the chart included", () => {
    const names = swiftComponentNames(repo);
    expect(names).toContain("glassButton");
    expect(names).toContain("material");
    expect(names.slice(-2).toSorted()).toEqual(["chart", "map"]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("reads component libraries by their name and skips ones without one", () => {
    const root = folder({
      "packages/swift/Sources/NativeIslandsComponents/NativeIslandsComponents.swift": [
        "public enum NativeIslandsComponents {",
        "  public enum Component: String {",
        "    case toggle",
        "    // Lists",
        "    case list",
        "",
        "    /// The name pages mount it by.",
        "    public var name: String { rawValue }",
        "  }",
        "}",
      ].join("\n"),
      "packages/swift/Sources/NativeIslandsMaps/NativeIslandsMaps.swift":
        'public enum NativeIslandsMaps { public static let name = "map" }',
      "packages/swift/Sources/NativeIslandsKit/Other.swift": "struct Other {}",
      "packages/swift/Sources/NativeIslandsCore/NativeIslandsCore.swift": "enum Core {}",
      "packages/swift/Sources/Helpers/Helpers.swift": 'let name = "helper"',
    });
    expect(swiftComponentNames(root)).toEqual(["toggle", "list", "map"]);
  });

  it("reads the values an entry exports, leaving out types", () => {
    const root = folder({
      "index.ts": [
        'export { A, type B, c as D } from "./a";',
        "/* export { Hidden } */",
        "export const E = 1;",
        "export function f() {}",
        "export type G = string;",
      ].join("\n"),
    });
    expect(valueExports(join(root, "index.ts"))).toEqual(["A", "D", "E", "f"]);
  });

  it("reads names from inline code and code blocks, not prose", () => {
    const markdown = `Use \`<Toggle>\`, \`useSheet()\` and \`glassButton\`, not Slider.\n${fence("tsx", "<List sections={rows} />")}`;
    expect(inlineCode(markdown)).toEqual(["<Toggle>", "useSheet()", "glassButton"]);
    expect([...codeNames(markdown)].toSorted()).toEqual(
      ["List", "Toggle", "glassButton", "rows", "sections", "useSheet"].toSorted(),
    );
  });

  it("fails an island or an export it does not list", () => {
    const markdown = `| \`Toggle\` | \`toggle\` |\n${fence("tsx", "const s = useSheet();")}`;
    expect(
      checkCatalogue(markdown, ["toggle", "slider"], ["Toggle", "useSheet", "Slider"]),
    ).toEqual([
      "does not list the Swift island `slider`",
      "does not list `Slider` from native-islands/components",
    ]);
  });

  it("fails inline NativeIslands names neither package declares, once each", () => {
    const markdown =
      "`NativeHandle`, `NativeGone`, `NativeGone`, `IslandWebView`, `Native()`, `Other`";
    expect(checkInlineSymbols(markdown, new Set(["NativeHandle", "IslandWebView"]))).toEqual([
      "names NativeGone, which neither package declares",
    ]);
  });
});

describe("frontmatter", () => {
  it("accepts a name that matches the folder and a one-line description", () => {
    expect(checkFrontmatter("demo", skill())).toEqual([]);
    expect(
      parseFrontmatter(`---\nname: "demo"\ndescription: 'x'\n---\nBody`)?.fields.get("name"),
    ).toBe("demo");
  });

  it("fails without frontmatter", () => {
    expect(checkFrontmatter("demo", "# Demo\n")).toEqual(["has no frontmatter between --- lines"]);
  });

  it("fails a name that is not kebab case or not the folder", () => {
    expect(checkFrontmatter("demo", skill(undefined, "Demo_Skill"))).toEqual([
      'name "Demo_Skill" is not lowercase words joined by hyphens, at most 64 characters',
      'name "Demo_Skill" differs from its folder "demo"',
    ]);
    expect(checkFrontmatter("demo", skill(undefined, "a".repeat(65)))[0]).toContain("at most 64");
  });

  it("fails a missing, folded or long description and unknown keys", () => {
    expect(checkFrontmatter("demo", "---\nname: demo\n---\n")).toEqual([
      "description is missing or not on one line",
    ]);
    expect(checkFrontmatter("demo", skill(">"))).toEqual([
      "description is missing or not on one line",
    ]);
    expect(checkFrontmatter("demo", skill("x".repeat(1025)))).toEqual([
      "description is 1025 characters, over 1024",
    ]);
    expect(checkFrontmatter("demo", `---\nname: demo\ndescription: x\nauthor: me\n---\n`)).toEqual([
      'has an unknown frontmatter key "author"',
    ]);
  });
});

describe("links", () => {
  it("ignores links in code and reads titles off", () => {
    const markdown = `[a](a.md "A") \`[b](b.md)\`\n${fence("md", "[c](c.md)")}`;
    expect(links(markdown)).toEqual(["a.md"]);
  });

  it("slugs headings the way GitHub does", () => {
    expect(slug("The `Sheet` island: [detents](x.md)!")).toBe("the-sheet-island-detents");
  });

  it("passes files, anchors and external links that resolve", () => {
    const root = folder({
      "SKILL.md":
        "[page](references/page.md#the-provider) [web](https://example.com) [top](#demo)\n# Demo\n",
      "references/page.md": "# The provider\n",
    });
    expect(
      checkLinks(
        join(root, "SKILL.md"),
        "[page](references/page.md#the-provider) [web](https://example.com) [top](#demo)\n# Demo\n",
        root,
      ),
    ).toEqual([]);
  });

  it("fails missing files, missing headings and links that leave the skill", () => {
    const root = folder({ "SKILL.md": "", "references/page.md": "# The provider\n" });
    const markdown = "[a](references/gone.md) [b](references/page.md#nope) [c](../README.md)";
    expect(checkLinks(join(root, "SKILL.md"), markdown, root)).toEqual([
      "links to a missing file: references/gone.md",
      "links to a missing heading: references/page.md#nope",
      "links outside the skill, which an installed skill does not have: ../README.md",
    ]);
  });

  it("finds files no chain of links from SKILL.md reaches", () => {
    const root = folder({
      "SKILL.md": "[a](references/a.md) [gone](references/gone.md) [site](https://example.com)",
      "references/a.md": "[b](../workflows/b.md#x) [self](#top)",
      "workflows/b.md": "# X\n",
      "references/orphan.md": "# Orphan\n",
    });
    expect(unreachable(root)).toEqual([join(root, "references/orphan.md")]);
  });
});

describe("imports", () => {
  it("reads named, typed, renamed, default and side-effect imports", () => {
    const code = [
      'import { A, type B, C as D } from "native-islands/react";',
      'import type { E } from "native-islands";',
      'import React, { useState } from "react";',
      'import "native-islands/components.css";',
    ].join("\n");
    expect(jsImports(code)).toEqual([
      { source: "native-islands/react", names: ["A", "B", "C"], hasDefault: false },
      { source: "native-islands", names: ["E"], hasDefault: false },
      { source: "react", names: ["useState"], hasDefault: true },
      { source: "native-islands/components.css", names: [], hasDefault: false },
    ]);
  });

  it("follows re-exports through to the declarations", () => {
    const root = folder({
      "index.ts": [
        'export { a, type B, c as d } from "./one";',
        'export * from "./two";',
        'export * as three from "./three";',
        "/* export const commented = 1; */",
        "export default function main() {}",
      ].join("\n"),
      "two/index.ts": 'export const e = 1;\nexport interface F {}\nexport * from "../index";',
    });
    expect([...moduleExports(join(root, "index.ts"))].toSorted()).toEqual(
      ["B", "F", "a", "d", "default", "e", "main", "three"].toSorted(),
    );
  });

  it("reads the web package's entries, stylesheet included", () => {
    const entries = packageEntries(join(repo, "packages/web"));
    expect([...entries.keys()]).toContain("native-islands/components.css");
    const react = entries.get("native-islands/react");
    expect(react && "exports" in react && react.exports.has("defineNativeComponent")).toBe(true);
  });

  it("ignores a manifest without exports", () => {
    const root = folder({
      "package.json": JSON.stringify({ name: "x", exports: { ".": "./a.js" } }),
    });
    expect(packageEntries(root).size).toBe(0);
    const bare = folder({ "package.json": "{}" });
    expect(packageEntries(bare).size).toBe(0);
  });

  it("fails names, entries, defaults and stylesheet imports the package does not have", () => {
    const entries = new Map<string, PackageEntry>([
      ["native-islands/react", { exports: new Set(["Native"]) }],
      ["native-islands/components.css", { stylesheet: true }],
    ]);
    const code = [
      'import { Native, Gone } from "native-islands/react";',
      'import Default from "native-islands/react";',
      'import { x } from "native-islands/components.css";',
      'import { y } from "native-islands/deep/path";',
      'import { z } from "react";',
    ].join("\n");
    expect(
      checkImports(
        [
          { lang: "tsx", code },
          { lang: "swift", code },
        ],
        entries,
        "native-islands",
      ),
    ).toEqual([
      'imports Gone from "native-islands/react", which does not export it',
      'imports a default from "native-islands/react", which has none',
      'imports names from the stylesheet "native-islands/components.css"',
      'imports "native-islands/deep/path", which the package does not export',
    ]);
  });
});

describe("Swift examples", () => {
  const symbols = swiftSymbols(repo);

  it("reads the libraries' types and products", () => {
    expect(symbols.modules).toEqual(
      new Set([
        "NativeIslands",
        "NativeIslandsComponents",
        "NativeIslandsMaps",
        "NativeIslandsCharts",
      ]),
    );
    expect(symbols.types.has("IslandWebView")).toBe(true);
    expect(symbols.types.has("NativeComponentContext")).toBe(true);
  });

  it("passes declared types, strings and the example's own types", () => {
    const code = [
      "import NativeIslands",
      "import SwiftUI",
      'struct NativeRating: View { var body: some View { Text("NativeNothing") } }',
      'NativeComponentRegistry.shared.register("rating") { _ in NativeRating() }',
    ].join("\n");
    expect(checkSwift([{ lang: "swift", code }], symbols)).toEqual([]);
  });

  it("fails libraries and types that do not exist, once each", () => {
    const code = "import NativeIslandsKit\nlet a = NativeGone()\nlet b = NativeGone()\n";
    expect(
      checkSwift(
        [
          { lang: "swift", code },
          { lang: "ts", code },
        ],
        symbols,
      ),
    ).toEqual([
      "imports the Swift library NativeIslandsKit, which Package.swift does not ship",
      "names the Swift type NativeGone, which the libraries do not declare",
    ]);
  });
});

describe("a whole skill", () => {
  it("reports every problem with the file it is in", () => {
    const body = `${"line\n".repeat(500)}[orphan](references/gone.md) \`NativeGone\`\n${fence("ts", 'import { Gone } from "native-islands";')}${fence("swift", "let x = NativeGone()")}`;
    const root = folder({
      "demo/SKILL.md": `${skill()}${body}`,
      "demo/references/orphan.md": "# Orphan\n",
    });
    const problems = checkSkill(join(root, "demo"), repo).map(({ message }) => message);
    expect(problems).toEqual([
      "is 514 lines; keep SKILL.md under 500 and move detail to references",
      "links to a missing file: references/gone.md",
      'imports Gone from "native-islands", which does not export it',
      "names the Swift type NativeGone, which the libraries do not declare",
      "names NativeGone, which neither package declares",
      "is not reachable by links from SKILL.md",
    ]);
  });

  it("fails a folder without SKILL.md", () => {
    const root = folder({ "demo/README.md": "# Demo\n" });
    expect(checkSkill(join(root, "demo"), repo)).toEqual([
      { file: relative(repo, join(root, "demo")), message: "has no SKILL.md" },
    ]);
  });

  it("finds code blocks with their language", () => {
    expect(codeBlocks(`${fence("tsx", "a")}${fence("", "b")}${fence("bash run", "c")}`)).toEqual([
      { lang: "tsx", code: "a\n" },
      { lang: "", code: "b\n" },
      { lang: "bash", code: "c\n" },
    ]);
  });
});
