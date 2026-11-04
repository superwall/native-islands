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
  Content inside the same scroll view stays under its islands: the React
  bindings make every scroller that holds one a stacking context
  (`isolation: isolate`), so WebKit never lifts the rest of that scroller
  above them while something in it animates.
- **Real glass:** Liquid Glass samples what is drawn behind it. Here that is
  the actual web content, so a glass button bends the page's own gradients,
  images and video. Islands draw from iOS 16; before iOS 26 glass is a
  material of the same shape, as UIKit's own controls are there.

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

The page stays in charge of layout. The app only draws. When an element moves
or changes size, because the window resizes, a CTA shrinks, a box slides or
anything else lays it out again, the page measures it again on every frame and
the app moves the native view with it. Covers are cut out of the native view
and see-through ones, such as a sheet's dimmed backdrop, are laid over it in
their colour, so it stays native under them too.

Two kinds of motion need no message per frame, because the app follows them
itself:

- **Sticky boxes.** A `position: sticky` element inside a scrolling area is
  sent with its sticky box where it sits unstuck, its inset and how far it may
  travel. The app runs the same sticky rule on every scroll of that scroll
  view, so the native view stays stuck, and comes unstuck at the end of the
  page, in the same frame as the content (the `sticky` feature).
- **Boxes that clip and resize**, such as an accordion opening. The page sends
  the part of the island the box shows, and the app cuts the native view to
  it, so the island is revealed as the box opens instead of swapping in when
  it is done (the `clip` feature).

- **Turned and faded boxes.** An element inside a rotated, scaled or
  see-through box is sent with the box's 2D transform and opacity, and the app
  draws the native view turned and faded the same way (the `transform`
  feature). A 3D transform, a filter or a clip path still shows the web copy.
- **Sliding pages.** An island outside any scrolling area, such as a nav bar
  button, rides its page as it slides on or off stage too. The page sends the
  CSS animation that slides it (translate-only keyframes, Bézier easing, how
  far in it is), and the app runs the same slide on the native view in Core
  Animation. Where the next page slides over it, the view hides as it is
  covered (the `motion` feature).

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

| Side       | Package                                 | Where                                  |
| ---------- | --------------------------------------- | -------------------------------------- |
| Host (iOS) | `NativeIslands` (Swift Package Manager) | `packages/swift/Sources/NativeIslands` |
| Page       | `@superwall/native-islands`             | `packages/web/`                        |

Both sides speak one contract. `tests/fixtures/messages.json` holds an example of every message, and the tests of both packages decode it.

## Use it on the page

```tsx
import { defineNativeComponent, NativeIslandsProvider } from "@superwall/native-islands/react";

const GlassButton = defineNativeComponent<{
  props: { title: string; prominence?: "regular" | "prominent" };
  events: { press: undefined };
}>("glassButton");

<NativeIslandsProvider>
  <GlassButton title="Continue" prominence="prominent" onPress={purchase}>
    <button>Continue</button>
  </GlassButton>
</NativeIslandsProvider>;
```

The children are the web version. The host draws the native button over them
when the app registered `glassButton`, and the children show everywhere else.
The packages ship no components of their own; the example app has a set of
glass buttons and controls to copy from (`examples/ios/Islands/Components/Defaults/`),
and a native island with a web version for every control in `examples/showcase`.

## Use it in the app

```swift
import NativeIslands

let webView = IslandWebView(frame: .zero)
webView.load(URLRequest(url: pageURL))
```

`IslandWebView` is a `WKWebView` with a `NativeIslandsHost` attached. It offers
what you register on `NativeComponentRegistry.shared` before it loads a page:

```swift
NativeComponentRegistry.shared.register("rating") { component in
  RatingView(value: component.props.int("value") ?? 0) {
    component.setState(["value": $0])
  }
}
```

With a web view of your own, attach `NativeIslandsHost(webView:)` before the
first load and forward two calls to it, as `IslandWebView` does:

- its `hitTest(_:with:webHit:)` from your `hitTest(_:with:)`, so islands in
  inner scrolling areas take their taps;
- its `webViewDidMoveToWindow()` from your `didMoveToWindow()`, so each
  island's hosting controller becomes a child of the view controller that
  shows the web view. Without it, islands mounted before the web view had a
  controller present (a `ColorPicker`, a sheet, a menu) from a detached
  controller until their next update.

```swift
override func didMoveToWindow() {
  super.didMoveToWindow()
  islands.webViewDidMoveToWindow()
}
```

## No web flash

The host keeps each new document covered, with the colour behind the web view,
until the page says its islands are drawn, so a native element never shows its web copy first. The provider sends
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
slides in, and need no swap to native when it arrives. A page sliding off
stage may be `inert` as it goes; its islands still ride along.

## Try it

`examples/` is **Islands**, an app in the style of a component catalogue whose
every screen is one web page in a `WKWebView`. It looks and moves like an iOS 26
app: large titles, inset grouped lists, push and swipe back, a native
navigation bar that stays put while screens slide under it, a floating Liquid
Glass tab bar with a search button. Where a web view falls short, the page puts
a native island:

- **Components:** glass buttons, menus, toggles, segmented controls, sliders,
  steppers, wheel and menu pickers, date and colour pickers, text fields,
  gauges, SF Symbol effects and Swift Charts.
- **Capabilities:** a MapKit map, AVFoundation video with Picture in Picture,
  the live camera, the photo picker handing photos back to the page, real
  permission prompts, haptics and the share sheet.
- **Search:** a native search field that filters every demo as you type.
- **Settings:** light, dark or system appearance and the accent colour, which
  the native views follow, and a **Native Islands** switch that shows the web
  version of every island in place.

Its styles start from `live.css`, which makes a page behave like an app: no
text selection, tap highlight, callouts, scrollbars or focus rings.

```bash run
bun install
cd examples/ios && xcodegen && open Islands.xcodeproj   # run on an iOS 16+ simulator or device
```

```bash
bun run --cwd examples/showcase dev     # http://localhost:5173/?native=simulate in a browser
```

The app bundles the page, so it needs no network, except for the sample video
stream. Launch it with `-screen <id>` (such as `-screen maps`) or `-tab <id>`
to open one screen, and in a browser use `?screen=<id>` or `?tab=<id>`. Camera
and Picture in Picture need a real iPhone.

`tests/pages/` is the scenario gallery: regression pages covering every scenario, plus a
three-page flow that shows islands sliding in with their page.
`tests/ios/` is TestHost, an iOS 16+ app that bundles them; it needs no account or network.

```bash
bun install
bun run --cwd tests/pages dev           # http://localhost:5173/?native=simulate in a browser
cd tests/ios && xcodegen && open TestHost.xcodeproj
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
scripts/ui-tests.sh --record            # rewrite tests/ios/Baselines after a deliberate visual change
performance/run.sh                      # 10, 50 and 100 islands against performance/baseline.json
performance/run.sh --device "iPhone Air" --record
```

- **Alignment** (`tests/ios/TestHostUITests/AlignmentUITests.swift`) opens every
  page and fails when a drawn island is more than 0.5 pt from its web element,
  when an island has no web element, or when a scenario that expects native
  still shows its web version. It also scrolls, and pushes and pops the flow.
- **Screenshots** (`ScreenshotUITests.swift`) compare each still page with
  `tests/ios/Baselines/iOS-<major>/<model>-<width>x<height>/`. A pixel counts as different
  when a channel moves by more than 24 of 255; a page fails above 0.2%.
- **Performance** (`PerformanceUITests.swift`) records, for 10, 50 and 100
  islands: the time until the page is shown with its islands drawn, the memory
  per island, frames dropped while the page scrolls top to bottom and back,
  and the JS time of one layout pass. `performance/check.ts` fails when one
  rises past its baseline by more than a share plus a fixed slack
  (`performance/compare.ts`), and when one could not be measured. On a
  shared simulator dropped frames and layout cost swing a lot between
  identical runs, so those gates only catch large rises; measure scrolling on a device for anything finer.

Every iOS version from 16 is covered by its own matrix and CI workflow; what
was proven where, and how to add a new iOS, is in
[`docs/compatibility.md`](docs/compatibility.md).

Simulators are slimmed with `simslim` when it is installed, booted in light
mode and given a fixed status bar. Failing screenshots are attached to the
result bundle in `build/ui-tests/results.xcresult`.

## Known issues

- **A frame behind while something moves.** An element that moves by layout
  (a resize, a width change, a slide) is followed by a message each frame, so
  the native view can trail it by one frame while it moves. Islands inside a
  page's scrolling area move with page changes without any message.

- After a fast fling, the buttons in the carousel nested inside a list (S19)
  can sit about 0.52 pt above their web elements until the next layout pass.
  The alignment test marks this one case as an expected failure.
- WebKit builds an inner scrolling area's scroll view a few frames after the
  page lays it out. The host holds a mount for such a scroller until a scroll
  view of its shape sits at its own spot, for up to a second (20 tries),
  before answering `anchor_not_found`. A parked screen's look-alike scroll
  view a screen away never counts.

## Develop

```bash
bun install
bun run --cwd packages/web test:run
bun run --cwd packages/web typecheck
bun run --cwd tests/pages build
xcodebuild test -scheme NativeIslands -destination 'platform=iOS Simulator,name=iPhone 17'
```
