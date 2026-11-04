#!/usr/bin/env bash
# Packs packages/web the way `npm publish` would, installs the tarball into a fresh Vite app and a fresh Next.js app
# (App Router), and builds both with every entry point imported: types checked, bundled, and the Next.js page
# prerendered on the server. Run from the repository root; it needs the npm registry.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/native-islands-smoke.XXXXXX")"
[ -n "${KEEP_SMOKE:-}" ] && echo "keeping $work" || trap 'rm -rf "$work"' EXIT

(cd "$root/packages/web" && npm pack --silent --pack-destination "$work" >/dev/null)
tarball="$(ls "$work"/native-islands-*.tgz)"

contents="$(tar -tzf "$tarball" | sed 's|^package/||' | sort)"
unexpected="$(echo "$contents" | grep -vE '^(dist/.+|LICENSE|README\.md|package\.json)$' || true)"
if [ -n "$unexpected" ]; then
  echo "error: the tarball holds files it should not:"
  echo "$unexpected"
  exit 1
fi
for file in LICENSE README.md dist/index.js dist/index.d.ts dist/react.js dist/react.d.ts dist/simulator.js dist/simulator.d.ts; do
  echo "$contents" | grep -qx "$file" || { echo "error: the tarball is missing $file"; exit 1; }
done
head -c 13 <(tar -xzOf "$tarball" package/dist/react.js) | grep -q '"use client"' || {
  echo "error: dist/react.js does not start with \"use client\""
  exit 1
}

install() {
  npm install --silent --no-audit --no-fund "$@"
}

# A page that touches all three entry points, shared by both apps. The Vite app type-checks our `.d.ts` files too
# (`skipLibCheck: false`); the Next.js app keeps the tsconfig `create-next-app` writes.
write_islands() {
  cat >"$1" <<'TSX'
"use client";
import { NATIVE_PROTOCOL_VERSION, nativeSupport } from "native-islands";
import { defineNativeComponent, NativeIslandsProvider, useNativeSupport } from "native-islands/react";
import { installNativeSimulator, type NativeSimulator } from "native-islands/simulator";
import { useEffect, useState } from "react";

const Rating = defineNativeComponent<{
  props: { value: number };
  events: { change: { value: number } };
}>("rating", { version: 1 });

const Support = () => {
  const support = useNativeSupport("rating");
  return <p data-testid="support">{String(support)}</p>;
};

export const Islands = () => {
  const [value, setValue] = useState(3);
  useEffect(() => {
    const simulator: NativeSimulator = installNativeSimulator({ components: { rating: 1 } });
    return () => simulator.uninstall();
  }, []);
  return (
    <NativeIslandsProvider>
      <p>protocol {NATIVE_PROTOCOL_VERSION}</p>
      <p>{typeof nativeSupport}</p>
      <Support />
      <Rating value={value} onChange={({ value: next }) => setValue(next)}>
        <span>{value} of 5</span>
      </Rating>
    </NativeIslandsProvider>
  );
};
TSX
}

echo "Vite: fresh app with the packed tarball"
mkdir -p "$work/vite/src"
cd "$work/vite"
cat >package.json <<'JSON'
{ "name": "smoke-vite", "private": true, "type": "module" }
JSON
cat >tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": false,
    "noEmit": true
  },
  "include": ["src"]
}
JSON
cat >index.html <<'HTML'
<!doctype html>
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
HTML
write_islands src/Islands.tsx
cat >src/main.tsx <<'TSX'
import { createRoot } from "react-dom/client";
import { Islands } from "./Islands";

createRoot(document.getElementById("root")!).render(<Islands />);
TSX
install "$tarball" react@19 react-dom@19 vite@7 @vitejs/plugin-react@5 typescript@5.8 @types/react@19 @types/react-dom@19
cat >vite.config.ts <<'TS'
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [react()] });
TS
npx tsc -p tsconfig.json
npx vite build --logLevel warn

echo "Next.js: fresh App Router app with the packed tarball"
mkdir -p "$work/next/app"
cd "$work/next"
cat >package.json <<'JSON'
{ "name": "smoke-next", "private": true }
JSON
install "$tarball" next@16 react@19 react-dom@19 typescript@5.8 @types/react@19 @types/react-dom@19 @types/node
cat >tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "allowJs": false,
    "esModuleInterop": true,
    "isolatedModules": true,
    "incremental": false,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
JSON
cat >app/layout.tsx <<'TSX'
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
TSX
write_islands app/islands.tsx
# The page is a server component that renders the islands directly, so the build prerenders the provider and its
# islands with no `window`. The prerendered HTML must hold each island's web version.
cat >app/page.tsx <<'TSX'
import { NATIVE_PROTOCOL_VERSION } from "native-islands";
import { Islands } from "./islands";

export default function Page() {
  return (
    <main>
      <p>server protocol {NATIVE_PROTOCOL_VERSION}</p>
      <Islands />
    </main>
  );
}
TSX
check_prerendered() {
  html=".next/server/app/index.html"
  [ -f "$html" ] || { echo "error: next build did not prerender the page ($html is missing)"; exit 1; }
  for expected in 'data-island-mode="web"' ' of 5<' '>unavailable<'; do
    grep -qF "$expected" "$html" || { echo "error: the prerendered page lacks $expected"; exit 1; }
  done
}
# Webpack, the bundler most published packages still meet.
npx next build --webpack
check_prerendered
# Turbopack, Next.js's default.
rm -rf .next
npx next build
check_prerendered

echo "Both apps built from the packed tarball, and Next.js prerendered the islands on the server."
