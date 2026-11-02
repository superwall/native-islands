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
- **Page (JS):** `@superwall/native-islands` in `packages/web/`, with `/react` bindings.

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
packages/web/           @superwall/native-islands (page side)
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
examples/pages/         local test pages (Vite + React)
examples/ios/           the iOS example app and its UI tests; its
                        Components/Defaults/ holds ready-made glass views
performance/            run.sh, check.ts, compare.ts and baseline.json
scripts/                simulator helpers and parallel UI test runs
```

The Swift host mirrors `packages/web/src/simulator/host.ts`. WebKit never
hands touches to views in its scroll views, so `IslandWebView` routes them.
`examples/pages/src/router.tsx` renders every page at once and parks the ones
not showing off to the side, each at its own spot, so their islands are drawn
before they slide in. `?native=simulate` installs the JS reference host.

## Commands

Run only what your change touches; never a whole suite by hand.

- JS tests: `bun run --cwd packages/web test:run test/<file>`
- JS types: `bun run --cwd packages/web typecheck`
- JS lint and format: `bunx oxlint --deny-warnings packages/web examples/pages performance`, `bunx oxfmt --check packages/web examples/pages tests performance`
- Swift tests: `xcodebuild test -scheme NativeIslands -destination 'platform=iOS Simulator,name=iPhone 17' -quiet`
- SwiftLint: `swiftlint lint --quiet --strict packages/swift examples/ios`
- Pages: `bun run --cwd examples/pages build`; in a browser `bun run --cwd examples/pages dev`
- Example app: `cd examples/ios && xcodegen -q && xcodebuild build -project Example.xcodeproj -scheme Example -destination 'generic/platform=iOS Simulator' -quiet`
- UI tests on several simulators: `scripts/ui-tests.sh`; record screenshots with `--record` only after a deliberate visual change
- Performance: `performance/run.sh`; its comparison: `bun test performance`
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
