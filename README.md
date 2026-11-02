# NativeIslands

Native views inside `WKWebView` pages. Write the page in React, mark the few
elements that should be native, and the app draws them as real UIKit or SwiftUI
views (Liquid Glass buttons, switches, your own components) right where the web
element sits. Everywhere else, and on any host without NativeIslands, the web
version shows.

Private while it takes shape.

## Packages

| Side       | Package                                 | Where                   |
| ---------- | --------------------------------------- | ----------------------- |
| Host (iOS) | `NativeIslands` (Swift Package Manager) | `Sources/NativeIslands` |
| Page       | `@superwall/native-islands`             | `js/`                   |

Both sides speak the contract in `contract/contract.json`.

## Use it on the page

```tsx
import { GlassButton, NativeIslandsProvider } from "@superwall/native-islands/react";

<NativeIslandsProvider>
  <GlassButton title="Continue" prominence="prominent" onPress={purchase}>
    <button>Continue</button>
  </GlassButton>
</NativeIslandsProvider>;
```

The children are the web version. The host draws the native button over them
when it offers `glassButton`, and the children show everywhere else.

## Use it in the app

```swift
import NativeIslands

let webView = IslandWebView(frame: .zero)
webView.load(URLRequest(url: pageURL))
```

`IslandWebView` is a `WKWebView` with a `NativeIslandsHost` attached. It offers
the built-ins and anything you register on `NativeComponentRegistry.shared`
before it loads a page:

```swift
NativeComponentRegistry.shared.register("rating") { component in
  RatingView(value: component.props.int("value") ?? 0) {
    component.setState(["value": $0])
  }
}
```

With a web view of your own, attach `NativeIslandsHost(webView:)` before the
first load and call its `hitTest(_:with:webHit:)` from your `hitTest(_:with:)`,
so islands in inner scrolling areas take their taps.

## No web flash

The host keeps each new document hidden until the page says its islands are
drawn, so a native element never shows its web copy first. The provider sends
that signal once every island of the first frame is drawn (or settled on its
web version); a page without React calls `islands.announceReady()` itself. A
page that never announces is shown after the timeout, two seconds by default:

```swift
let host = NativeIslandsHost(webView: webView, reveal: .whenIslandsReady(timeout: 2))
host.onReady = { reason in present() } // .ready or .timedOut
```

Pass `.immediately` for web views that load pages without the library.

Pages that are rendered but not showing yet, such as the next screen of a
flow, keep their islands placed when the host draws islands inside the page's
scrolling areas (the `layered` feature). Mark such a page with
`data-island-phase` or `inert` and lay it out (off screen or underneath),
rather than `display: none`: its islands mount right away, ride along when it
slides in, and need no swap to native when it arrives.

## Try it

`pages/` is a set of local test pages covering every scenario, plus a
three-page flow that shows islands sliding in with their page.
`Example/` is an iOS 26+ app that bundles them; it needs no account or network.

```bash
bun install
bun run --cwd pages dev        # http://localhost:5173/?native=simulate in a browser
cd Example && xcodegen && open Example.xcodeproj
```

In a browser, `?native=simulate` draws each native view as a magenta outline,
and `?route=<name>` opens one page directly (`buttons`, `controls`,
`scrolling`, `motion`, `overlays`, `stress`, `state`, `flow-plans`).
The app takes the same page as `-route <name>`, loads a dev server with
`-pagesURL http://<mac>:5173/`, and logs native frames beside DOM rects with
`-NativeIslandsAlignmentLog YES`.

The pages keep every page rendered at once. The page on top shows, and the
others wait off to the side, each at its own spot: the host tells scrolling
areas apart by size and position, so two pages of the same size must not wait
in the same place.

## Automated runs

```bash
scripts/ui-tests.sh                     # alignment and screenshots, iPhone 17 and iPhone Air at once
scripts/ui-tests.sh --devices "iPhone 17,iPhone 17e,iPhone Air"
scripts/ui-tests.sh --record            # rewrite Example/Baselines after a deliberate visual change
scripts/perf.sh                         # 10, 50 and 100 islands against perf/baseline.json
scripts/perf.sh --device "iPhone Air" --record
```

- **Alignment** (`Example/ExampleUITests/AlignmentUITests.swift`) opens every
  page and fails when a drawn island is more than 0.5 pt from its web element,
  when an island has no web element, or when a scenario that expects native
  still shows its web version. It also scrolls, and pushes and pops the flow.
- **Screenshots** (`ScreenshotUITests.swift`) compare each still page with
  `Example/Baselines/<model>-<width>x<height>/`. A pixel counts as different
  when a channel moves by more than 24 of 255; a page fails above 0.2%.
- **Performance** (`PerformanceUITests.swift`) records, for 10, 50 and 100
  islands: the time until the page is shown with its islands drawn, the memory
  per island, frames dropped while the page scrolls top to bottom and back,
  and the JS time of one layout pass. `scripts/perf-check.ts` fails when one
  rises past its baseline by more than a share plus a fixed slack
  (`scripts/perf-compare.ts`), and when one could not be measured. On a
  shared simulator dropped frames and layout cost swing a lot between
  identical runs, so those gates only catch large rises; measure scrolling on a device for anything finer.

Simulators are slimmed with `simslim` when it is installed, booted in light
mode and given a fixed status bar. Failing screenshots are attached to the
result bundle in `build/ui-tests/results.xcresult`.

## Known issues

- After a fast fling, the buttons in the carousel nested inside a list (S19)
  can sit about 0.52 pt above their web elements until the next layout pass.
  The alignment test marks this one case as an expected failure.
- WebKit builds an inner scrolling area's scroll view a few frames after the
  page lays it out. The host holds a mount for such a scroller for up to a
  second (20 tries) before answering `anchor_not_found`.

## Develop

```bash
bun install
bun run --cwd js test:run
bun run --cwd js typecheck
bun run --cwd pages build
xcodebuild test -scheme NativeIslands -destination 'platform=iOS Simulator,name=iPhone 17'
```
