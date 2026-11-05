import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  // `source` points `native-islands` at its TypeScript, so the page builds without building the package first.
  resolve: { conditions: ["source", ...defaultClientConditions] },
  build: { outDir: "dist", emptyOutDir: true, target: "safari16" },
  server: { host: true },
});
