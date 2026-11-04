import { readFile, writeFile } from "node:fs/promises";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    protocol: "src/protocol/index.ts",
    react: "src/react/index.ts",
    simulator: "src/simulator/index.ts",
  },
  format: ["esm"],
  target: "es2022",
  platform: "browser",
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Next.js App Router only lets a client component import `/react` when the module itself says so. esbuild drops
  // directives when it bundles, so it goes back on after the build, on the entry alone, and its source map moves
  // down the one line it adds.
  async onSuccess() {
    const file = "dist/react.js";
    const code = await readFile(file, "utf8");
    if (code.startsWith('"use client"')) return;
    await writeFile(file, `"use client";\n${code}`);
    const map = JSON.parse(await readFile(`${file}.map`, "utf8")) as { mappings: string };
    map.mappings = `;${map.mappings}`;
    await writeFile(`${file}.map`, JSON.stringify(map));
  },
});
