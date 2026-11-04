# AGENTS.md

Guidance for coding agents (and people) working in this repository.

## What this is

NativeIslands puts native views inside a `WKWebView` page. The page stays in
charge of layout: each island is a web element whose native twin the host draws
in WebKit's own scroll views, so it scrolls, slides and is covered exactly like
the web content around it. Anything the host cannot draw stays web.

It has two sides that speak one contract:

- **Host (Swift):** the `NativeIslands` package, iOS 15+, with no version cap on
  drawing: every registered component is offered on every iOS it builds for. Before iOS 26 glass falls back to a material (or its tint) in the same
  shape, the way UIKit's own controls do. It works with any `WKWebView`; nothing in it knows about an app or a
  service.
- **Page (JS):** `native-islands` in `packages/web/`, with `/react` bindings.

## The contract is the source of truth

`tests/fixtures/messages.json` is a test fixture shared by both packages: one
example of every message in both directions, and of the capability. The zod schemas in `packages/web/src/protocol/` and the Swift models in
`packages/swift/Sources/NativeIslands/Protocol/` both decode it in their tests, so a change to one side
that the other cannot read fails a test.

- Change the contract additively: add optional fields and new messages; never
  rename or repurpose one.
- `toHost` is what the page posts to the `nativeIslands` message handler;
  `toPage` is what the host delivers back.
- The host offers what it can draw in `window.__NATIVE_ISLANDS__`, injected at
  document start. A page without it renders web versions only.

## Layout

```
tests/fixtures/         messages.json: one example of every wire message,
                        decoded by the tests of both packages
packages/web/           native-islands (page side)
  src/protocol/         zod schemas, message types, capability reader
  src/bridge/           WebKit transport and connectNativeIslands
  src/islands/          the island controller: batching, acks, state,
                        requests, commands
  src/layout/           measuring, hand-off to web, the layout watcher,
                        DOM attributes
  src/simulator/        the JS reference host (the /simulator entry)
  src/react/            the /react entry: components/, hooks/, provider/,
                        dom/ (props, accessibility, style rules)
  test/                 mirrors src/; shared helpers in test/support/
packages/swift/         NativeIslands (host side); Package.swift is at the root
  Sources/NativeIslands/
    Host/               NativeIslandsHost, IslandWebView, router, surface
    Protocol/           contract models, decoding, replies, capability
    Islands/            the island manager and the island view
    Components/         registry, context, props, glass, accessibility
    Debug/              frame reporter and alignment
    Extensions/, Support/
  Tests/NativeIslandsTests/  mirrors Sources/
tests/pages/            the scenario gallery: regression pages (Vite + React)
tests/ios/              TestHost, the app that bundles the gallery, with its
                        UI tests and screenshot baselines
examples/showcase/      Islands, the example app's web side (Vite + React):
                        src/app/ the shell, navigation, search and preferences;
                        src/tabs/ one file per demo section; src/ui/ each
                        island with its web version; src/styles/live.css
examples/ios/           Islands' iOS host; Components/ has one SwiftUI view per
                        island, registered in ShowcaseComponents.swift, and
                        Components/Defaults/ the glass views TestHost shares
performance/            run.sh, check.ts, compare.ts and baseline.json
scripts/                simulator helpers, parallel UI test runs and the
                        iOS runtime matrix with its WebKit view-tree diff
docs/                   compatibility.md, what each iOS was proven on;
                        performance.md, device numbers and how to measure
                        them; host-features.md, the feature names, reuse
                        limits and test thresholds; assets/ the images
                        the README shows
LICENSE                 FSL-1.1-MIT; CONTRIBUTING.md is the guide for people
```

The Swift host mirrors `packages/web/src/simulator/host.ts`. WebKit never
hands touches to views in its scroll views, so `IslandWebView` routes them.
`tests/pages/src/router.tsx` renders every page at once and parks the ones
not showing off to the side, each at its own spot, so their islands are drawn
before they slide in. `?native=simulate` installs the JS reference host.

The showcase's `src/app/Shell.tsx` mounts a screen the first time it is pushed
or opened, then keeps it parked the same way, so a demo that holds a device
(camera, video) checks `useScreenShowing()` and lets go while hidden. A new island needs its name in both
`src/islands/definitions.ts` and `ShowcaseComponents.swift`, a web version that
behaves the same, and an entry in `main.tsx`'s simulator list. A new demo is a
row in its section's `demoScreens(...)` with `keywords` for Search, and its
symbol needs a web drawing in `src/ui/icons.tsx` (a test checks).

## Commands

Run only what your change touches; never a whole suite by hand.

- JS tests: `bun run --cwd packages/web test:run test/<file>`
- JS types: `bun run --cwd packages/web typecheck`
- JS lint and format: `bunx oxlint --deny-warnings packages/web tests/pages examples/showcase performance`, `bunx oxfmt --check packages/web tests examples performance`
- Swift tests: `xcodebuild test -scheme NativeIslands -destination 'platform=iOS Simulator,name=iPhone 17' -quiet`
- SwiftLint: `swiftlint lint --quiet --strict packages/swift tests/ios examples/ios`
- Pages: `bun run --cwd tests/pages build`; in a browser `bun run --cwd tests/pages dev`
- Test host app: `cd tests/ios && xcodegen -q && xcodebuild build -project TestHost.xcodeproj -scheme TestHost -destination 'generic/platform=iOS Simulator' -quiet`
- Showcase: `bun run --cwd examples/showcase build`, its tests `cd examples/showcase && bun test test`; in a browser `bun run --cwd examples/showcase dev`
- Islands app: `cd examples/ios && xcodegen -q && xcodebuild build -project Islands.xcodeproj -scheme Islands -destination 'generic/platform=iOS Simulator' -quiet`
- UI tests on several simulators: `scripts/ui-tests.sh`, on every iOS major with `--runtimes 17.5,18.6,26.5,27.2`; record screenshots with `--record` only after a deliberate visual change (baselines are per iOS major)
- Every installed iOS runtime: `scripts/compat-matrix.sh` (`--list` shows them); it runs `WebKitLayoutTests` on each and diffs WebKit's view trees with `scripts/webkit-tree-diff.ts`, tested by `bun test scripts`. What each iOS was proven on, and how versions differ, is in `docs/compatibility.md`
- Performance: `performance/run.sh`; its comparison: `bun test performance`. Numbers for people come from a device, as `docs/performance.md` describes, never a simulator
- On a simulator, drive the web view with real touches (`axe tap --tap-style physical`): a synthetic simulator tap never reaches WebKit.

## Conventions

- Comments only where Apple would leave one: a non-obvious requirement on a
  public API, or why code works around platform behaviour. No comments that
  restate a name or a signature, and none explaining a change.
- JS: `tsconfig.base.json` is strict, with `noUncheckedIndexedAccess`,
  `noImplicitReturns`, `noImplicitOverride` and `verbatimModuleSyntax`; oxlint
  runs with `--deny-warnings`. No `any`, no non-null assertions, and no `as`
  casts outside tests: narrow with a type guard, destructuring or a schema.
- JS: zod 4. Tests keep `packages/web/src` at 100% coverage.
- Swift: 2-space indentation, Swift Testing (not XCTest), `swiftlint --strict`
  clean.
- Never require browser storage on the page side.
- Never read "couldn't check" as "nothing there": when the page cannot tell
  whether an island can be shown, it shows the web version.
