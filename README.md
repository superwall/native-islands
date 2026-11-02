# NativeIslands

Native views inside `WKWebView` pages. Write the page in React, mark the few
elements that should be native, and the app draws them as real UIKit or SwiftUI
views (Liquid Glass buttons, switches, your own components) right where the web
element sits. Everywhere else, and on any host without NativeIslands, the web
version shows.

Private while it takes shape.

## How it works

### The short version

A `WKWebView` is not one flat picture. WebKit builds the page out of real
UIKit views: the page itself scrolls inside a `UIScrollView`, and every
`overflow: auto` area on the page gets its own native scroll view
(`WKChildScrollView`). NativeIslands puts your native views **inside those
scroll views**, at the exact spot of the web element they replace. They are
not floating above the web view, guessing where to be. They live in the same
view tree as the page's own layers.

### What the view tree looks like

This is the real hierarchy on a running page (Xcode's view debugger shows the
same thing):

```text
IslandWebView                         the WKWebView
└─ WKScrollView                       the page's own scroll view
   ├─ WKContentView                   the page's content layers
   │  └─ … WKChildScrollView          a scrolling route or list
   │        ├─ (WebKit's layers for that area)
   │        └─ native view            ← a glass button, in place
   └─ native view                     ← an island on the page itself
NativeIslands screen layer            ← only for position: fixed elements
```

### Why that matters

Because a native view is a child of the scroll view its element is in, UIKit
moves it for free:

- **Scrolling:** it scrolls with the page, frame for frame, with no JavaScript
  following it. Rubber-banding and momentum included.
- **Page changes:** when a route slides, fades or scales, WebKit animates that
  route's scroll view with Core Animation, and the native view rides along.
  No flash of the web copy.
- **Stacking:** web content WebKit draws above that scroll view (a footer, a
  sheet, the next page) covers the native view the way it would cover the web
  element. A plan card half behind the footer stays glass, cut by the footer.
- **Real glass:** Liquid Glass samples what is drawn behind it. Here that is
  the actual web content, so a glass button bends the page's own gradients,
  images and video.

An overlay can do none of this. It sits on top of everything, has to be moved
by script on every scroll frame (always a frame late), and covers sheets and
footers it should sit under.

### What travels between page and app

```text
page (React)                               app (Swift)
────────────                               ───────────
<GlassButton> renders its web children
measures them, picks the anchor ─ mount ─► NativeIslandsHost
  (page, scroller or screen)               finds the matching scroll view,
                                           adds the native view, answers
web copy fades out ◄──────────── ack ─────
onPress runs      ◄──────────── event ──── user taps the native button
state, requests, commands both ways ◄────► typed text, "validate this", focus
```

The page stays in charge of layout. The app only draws. When the page says an
element is moving in a way a native view cannot follow, covered, faded or
rotated, the web copy shows instead, and the native view comes back once it
settles.

Two kinds of motion stay native, because the app can follow them itself:

- **Sticky boxes.** A `position: sticky` element inside a scrolling area is
  sent with its sticky box where it sits unstuck, its inset and how far it may
  travel. The app runs the same sticky rule on every scroll of that scroll
  view, so the native view stays stuck, and comes unstuck at the end of the
  page, in the same frame as the content (the `sticky` feature).
- **Boxes that clip and resize**, such as an accordion opening. The page sends
  the part of the island the box shows, and the app cuts the native view to
  it, so the island is revealed as the box opens instead of swapping in when
  it is done (the `clip` feature).

Faded and rotated containers still show the web copy. A Liquid Glass view
cannot be drawn half transparent: UIKit's glass breaks when its view has an
alpha below 1. And islands are placed by frame, so the app has no rotation to
apply; sending the element's transform is possible, but not built yet.

### Never a flash

The app keeps a new page's web view hidden until the page reports that every
island on its first frame is drawn (`native_islands_ready`), with a timeout so
a page without islands still shows. Pages that are rendered but not on screen
yet get their islands up front, so a page that slides in already has them.

### Only public API

Everything uses public UIKit and WebKit: `UIScrollView`, `hitTest`,
`WKUserScript`, `WKScriptMessageHandler`, `UIGlassEffect`. The one thing
WebKit does not promise is its view layout: the host finds a scrolling area's
`WKChildScrollView` by matching its size and scroll offset. If a future iOS
changes that layout, no match is found and the element simply stays web.

### Has this been done before?

Parts of it. Map plugins for Cordova and Capacitor draw one native map behind
a transparent web view. Hotwire Native lets the page drive native bars and
toolbars. One Expo app placed a fixed set of native controls in the web
view's main scroll view. As far as we know, nothing else puts **any**
app-registered view inside WebKit's own scroll views, moves it with page
transitions, and passes values both ways. We have not done a full search, so
check before saying it is the first.

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

- **Fallbacks while a browser window is resized.** With the simulated host,
  dragging the window edge moves every element on each frame, and an island
  whose element moves hands back to its web copy until it has been still for
  two frames (`SETTLE_FRAMES`). It is the same rule that hides islands during
  animations a native view cannot follow. On a phone the web view only
  resizes on rotation or when the keyboard opens, so it shows there only
  then.

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
