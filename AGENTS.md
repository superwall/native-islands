# AGENTS.md

Guidance for coding agents (and people) working in this repository.

## What this is

NativeIslands puts native views inside a `WKWebView` page. The page stays in
charge of layout: each island is a web element whose native twin the host draws
in WebKit's own scroll views, so it scrolls, slides and is covered exactly like
the web content around it. Anything the host cannot draw stays web.

It has two sides that speak one contract:

- **Host (Swift):** the `NativeIslands` package, iOS 15+ to build, iOS 26+ to
  draw. It works with any `WKWebView`; nothing in it knows about an app or a
  service.
- **Page (JS):** `@superwall/native-islands` in `js/`, with `/react` bindings.

## The contract is the source of truth

`contract/contract.json` holds every message in both directions and the
capability. The zod schemas in `js/src/` and the Swift models in
`Sources/NativeIslands/` both decode it in their tests, so a change to one side
that the other cannot read fails a test.

- Change the contract additively: add optional fields and new messages; never
  rename or repurpose one.
- `toHost` is what the page posts to the `nativeIslands` message handler;
  `toPage` is what the host delivers back.
- The host offers what it can draw in `window.__NATIVE_ISLANDS__`, injected at
  document start. A page without it renders web versions only.

## Layout

- `contract/` — the shared fixture.
- `js/` — the page package, tests in `test/`:
  - `src/schemas.ts`, `src/messages.ts` — the contract in zod.
  - `src/capability.ts` — reads `window.__NATIVE_ISLANDS__` leniently.
  - `src/islands.ts` — the island controller: mounts, per-frame batching,
    acks and stalls, state, requests and commands.
  - `src/transport.ts`, `src/connect.ts` — the WebKit transport (posts to
    `nativeIslands`, receives through `window.__nativeIslands.accept64`) and
    `connectNativeIslands`, which wires a controller to it.
  - `src/measure.ts`, `src/handoff.ts`, `src/watcher.ts` — where an island
    sits, when it must show its web version, and when to measure again.
  - `src/simulator.ts` (the `/simulator` entry) — the JS reference host, which
    draws islands as outlines in a browser. The Swift host mirrors it.
  - `src/attributes.ts` — the DOM attributes: pages set `data-island-phase`
    on content that is entering or leaving.
  - `src/react/` (the `/react` entry) — `NativeIslandsProvider`, `<Native>`,
    `defineNativeComponent`, the built-ins (`GlassButton`, `CloseButton`,
    `Toggle`, `SegmentedControl`, `SystemSymbol`), `useNativeSupport` and
    `useNativeIslandsReady`, which turns true once no island is still on its
    way to native. The provider adds the island style rules to the document.
- `Sources/NativeIslands/`, `Tests/NativeIslandsTests/` — the host package and
  its Swift Testing suites. It mirrors `js/src/simulator.ts`:
  - `NativeIslandsHost.swift` — attaches to any `WKWebView`: adds the
    capability and document-start scripts and the `nativeIslands` handler,
    delivers replies through `window.__nativeIslands.accept64`, and clears
    islands whenever a new document starts.
  - `IslandWebView.swift` — a `WKWebView` with a host that routes touches on
    islands to them (WebKit never hands them to views in its scroll views).
  - `NativeComponentRegistry.swift`, `NativeComponentContext.swift`,
    `NativeComponentProps.swift` — what apps register and what their views get:
    props, `emit`, `setState`, `request`, `onCommand`.
  - `NativeIslandManager*.swift`, `NativeIsland.swift`,
    `NativeHostSurface.swift` — draws islands on the page, the matching
    `WKChildScrollView` or above the page, with acks, sequences, fades, glass
    groups and reset.
  - `NativeBuiltIns.swift`, `NativeGlass.swift` — the built-ins and their glass.
  - `NativeFrameReporter.swift` — DEBUG only: the `nativeIslandsFrames`
    handler, and the `-NativeIslandsAlignmentLog YES` log of native frames
    beside DOM rects.
  - `Tests/.swiftlint.yml` relaxes a few rules for tests only.
- `pages/` — the local test pages (Vite + React): every scenario of the
  gallery, tagged `data-scenario` and `data-expect`, and the `flow-*` pages.
  `src/router.tsx` renders every page at once and parks the ones not showing
  off to the side, each at its own spot, so their islands are drawn before
  they slide in. `?native=simulate` installs the JS reference host.
- `Example/` — the xcodegen iOS app that bundles `pages/dist` (a pre-build
  script runs `bun run --cwd pages build`) and serves it from `islands://`.
  It registers the gallery's app components in `Example/Components/`.
- `.github/workflows/ci.yml` — CI.

## Commands

Run only what your change touches; never a whole suite by hand.

- JS tests: `bun run --cwd js test:run test/<file>`
- JS types: `bun run --cwd js typecheck`
- JS lint and format: `bunx oxlint js`, `bunx oxfmt --check js contract`
- Swift tests: `xcodebuild test -scheme NativeIslands -destination 'platform=iOS Simulator,name=iPhone 17' -quiet`
- SwiftLint: `swiftlint lint --quiet --strict Sources Tests Example`
- Pages: `bun run --cwd pages build`; in a browser `bun run --cwd pages dev`
- Example app: `cd Example && xcodegen -q && xcodebuild build -project Example.xcodeproj -scheme Example -destination 'generic/platform=iOS Simulator' -quiet`
- On a simulator, drive the web view with real touches (`axe tap --tap-style physical`): a synthetic simulator tap never reaches WebKit.

## Conventions

- No code comments explaining a change; put that in the pull request. Doc
  comments on types and public API are fine.
- JS: every optional field of a public type states its default. Tests keep
  `js/src` at 100% coverage.
- Swift: 2-space indentation, Swift Testing (not XCTest), `swiftlint --strict`
  clean.
- Never require browser storage on the page side.
- Never read "couldn't check" as "nothing there": when the page cannot tell
  whether an island can be shown, it shows the web version.
