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
- **Page (JS):** `native-islands` in `packages/web/`, with `/react` bindings and a
  `/protocol` entry for the wire schemas.

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
  src/protocol/         zod schemas, message types, capability reader;
                        index.ts is the /protocol entry
  src/bridge/           WebKit transport and connectNativeIslands
  src/islands/          the island controller: batching, acks, state,
                        requests, commands
  src/layout/           measuring, hand-off to web, the layout watcher,
                        DOM attributes
  src/simulator/        the JS reference host (the /simulator entry)
  src/react/            the /react entry: components/, hooks/, provider/,
                        dom/ (props, accessibility, style rules)
  src/components/       the /components entry: the ready-made controls with
                        their web versions, and components.css
  test/                 mirrors src/; shared helpers in test/support/
packages/swift/         NativeIslands (host side); Package.swift is at the root
  Sources/NativeIslands/
    Host/               NativeIslandsHost, IslandWebView, router, surface;
                        WebViewForwarding adds hitTest and didMoveToWindow
                        to the class of a web view attach(to:) is given
    Protocol/           contract models, decoding, replies, capability
    Islands/            the island manager and the island view
    Components/         registry, context, props, glass, accessibility
    Debug/              frame reporter and alignment
    Extensions/, Support/
  Sources/NativeIslandsComponents/
                        the ready-made controls, presentations, app chrome,
                        lists, media and system islands, their glass and the
                        iOS 15–25 fallbacks; NativeIslandsComponents.register()
  Sources/NativeIslandsMaps/, NativeIslandsCharts/
                        the map and the chart, apart so an app links MapKit
                        and Swift Charts only when it uses them
  Tests/NativeIslandsTests/, Tests/NativeIslandsComponentsTests/  mirror Sources/
                        (the second covers all three component libraries)
tests/pages/            the scenario gallery: regression pages (Vite + React)
tests/ios/              TestHost, the app that bundles the gallery, with its
                        UI tests and screenshot baselines
examples/showcase/      Islands, the example app's web side (Vite + React):
                        src/app/ the shell, navigation, search and preferences;
                        src/tabs/ one file per demo section; src/ui/ each
                        island with its web version; src/styles/live.css
examples/ios/           Islands' iOS host; Components/ has the app's own chrome
                        (tab bar, navigation bar, search), registered with
                        every ready-made island in ShowcaseComponents.swift
performance/            run.sh, check.ts, compare.ts and baseline.json
scripts/                simulator helpers, parallel UI test runs and the
                        iOS runtime matrix with its WebKit view-tree diff;
                        release-check.sh, the versions a tag must match
docs/                   compatibility.md, what each iOS was proven on;
                        performance.md, device numbers and how to measure
                        them; host-features.md, the feature names, reuse
                        limits and test thresholds; assets/ the images
                        the README shows
skills/native-islands/  the agent skill for people using the library:
                        SKILL.md, references/ and workflows/; check.ts and
                        skills.test.ts keep it in step with the code
LICENSE                 FSL-1.1-MIT; CONTRIBUTING.md is the guide for people
```

The Swift host mirrors `packages/web/src/simulator/host.ts`. WebKit never
hands touches to views in its scroll views, so `IslandWebView` routes them,
and `NativeIslandsHost.attach(to:)` does the same for a web view the app
doesn't subclass (an SDK's, such as Superwall's paywall web view) by adding
the two overrides to its class at runtime. Nothing in the package names an SDK;
the SDK only hands the app its web view.
`tests/pages/src/router.tsx` renders every page at once and parks the ones
not showing off to the side, each at its own spot, so their islands are drawn
before they slide in. `?native=simulate` installs the JS reference host.

The showcase's `src/app/Shell.tsx` mounts a screen the first time it is pushed
or opened, then keeps it parked the same way, so a demo that holds a device
(camera, video) checks `useScreenShowing()` and lets go while hidden. The showcase has no islands of its own: every
one comes from the package, so a new one goes in the package (see below) and,
to show in the browser simulator, in `main.tsx`'s simulator list. `?page=` loads
the pages that presentations show (`src/pages/`). A new demo is a
row in its section's `demoScreens(...)` with `keywords` for Search, and its
symbol needs a web drawing in `src/ui/icons.tsx` (a test checks).

A ready-made island lives in both halves at once: its view in
`Sources/NativeIslandsComponents/` with a case in
`NativeIslandsComponents.Component`, and its spec, web version and styles in
`packages/web/src/components/`, under the same name. A test reads the Swift
names and fails when the web names drift. Its web version must keep the
native control's size and shape, so a change there is a change to TestHost's
screenshot baselines too. Every item an island draws (a tab, a bar item, a
row, a button) is a prop, so a page adds one without an app update. Islands
draw above the page, so nothing on the page can draw on one: what sits on an
island is a prop the native view draws. Numbers from the page arrive as
`Double`; read nested ones through `NSNumber`, never `as? Int`. An island that needs an Info.plist key notes it in
the README's table. A large, rarely needed framework (MapKit, Swift Charts)
goes in a library of its own, as `NativeIslandsMaps` does, with its podspec
and its `public static let name` read by that test. Shared Swift helpers use
`package` access; every component podspec passes `-package-name NativeIslands`.
App chrome (tab bar, navigation bar, search) stays in the showcase.

`skills/native-islands/` teaches agents to use the library, so a change to
what people use (a prop, an export, a Swift API, a behaviour the rules
describe) updates the skill in the same change. `bun test skills` fails when a
name it uses no longer exists or a ready-made island is missing from
`references/components.md`, but only you can tell when its prose is wrong.
Every example in it must obey every rule in it: agents copy examples.

## Commands

Run only what your change touches; never a whole suite by hand.

- JS tests: `bun run --cwd packages/web test:run test/<file>`
- JS types: `bun run --cwd packages/web typecheck`
- Web package build: `bun run --cwd packages/web build` (tsup, to `packages/web/dist`). Its exports point at `dist`; each also has a `source` condition that the workspace apps (Vite `resolve.conditions`, TS `customConditions`, `bun test --conditions source`) use to read `src`, so developing them needs no build. The `types` condition nests its own `source` too: TS takes the first condition that matches and oxfmt sorts `types` first, so a `source` beside it would never reach TS
- Package checks: `bunx publint packages/web --strict`, `cd packages/web && bunx @arethetypeswrong/cli --pack . --profile esm-only`; the packed tarball in fresh Vite and Next.js apps: `scripts/pack-smoke.sh` (needs the npm registry)
- JS lint and format: `bunx oxlint --deny-warnings packages/web tests/pages examples/showcase performance`, `bunx oxfmt --check packages/web tests examples performance`
- Swift tests: `xcodebuild test -scheme NativeIslands-Package -destination 'platform=iOS Simulator,name=iPhone 17' -quiet`
- Swift build on Xcode 26: the package has to compile with the oldest Xcode 26 the runners can build with (26.2) as well as Xcode 27, which accepts some type conversions Xcode 26 rejects. The `swift-xcode26` job in `ci.yml` runs `xcodebuild build-for-testing -scheme NativeIslands-Package -destination 'generic/platform=iOS Simulator' -quiet` with Xcode 26.2 and 26.6 on every pull request
- SwiftLint: `swiftlint lint --quiet --strict packages/swift tests/ios examples/ios`
- Podspecs: `pod lib lint NativeIslands.podspec --platforms=ios --fail-fast` and `pod lib lint NativeIslandsComponents.podspec --include-podspecs=NativeIslands.podspec --platforms=ios --fail-fast`, then `NativeIslandsMaps` and `NativeIslandsCharts` with `--include-podspecs='{NativeIslands,NativeIslandsComponents}.podspec'`; they mirror the products in `Package.swift`, so change them together
- Release: `scripts/release-check.sh v<version>` fails unless `packages/web/package.json` and the four podspecs carry that version. Pushing a `v*` tag runs `.github/workflows/release.yml`, which publishes npm, the pods and the GitHub release; never publish by hand. CONTRIBUTING.md has the steps.
- Pages: `bun run --cwd tests/pages build`; in a browser `bun run --cwd tests/pages dev`
- Test host app: `cd tests/ios && xcodegen -q && xcodebuild build -project TestHost.xcodeproj -scheme TestHost -destination 'generic/platform=iOS Simulator' -quiet`
- Showcase: `bun run --cwd examples/showcase build`, its tests `cd examples/showcase && bun test --conditions source test`; in a browser `bun run --cwd examples/showcase dev`
- Islands app: `cd examples/ios && xcodegen -q && xcodebuild build -project Islands.xcodeproj -scheme Islands -destination 'generic/platform=iOS Simulator' -quiet`
- UI tests on several simulators: `scripts/ui-tests.sh`, on every iOS major with `--runtimes 17.5,18.6,26.5,27.2`; record screenshots with `--record` only after a deliberate visual change (baselines are per iOS major)
- Every installed iOS runtime: `scripts/compat-matrix.sh` (`--list` shows them); it runs `WebKitLayoutTests` on each and diffs WebKit's view trees with `scripts/webkit-tree-diff.ts`, tested by `bun test scripts`. What each iOS was proven on, and how versions differ, is in `docs/compatibility.md`
- Performance: `performance/run.sh`; its comparison: `bun test performance`. Numbers for people come from a device, as `docs/performance.md` describes, never a simulator
- Skill: `bun test skills`, `bunx oxlint --deny-warnings skills`, `bunx oxfmt --check skills`
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
