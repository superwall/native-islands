# Native Islands

**Real UIKit and SwiftUI views inside a `WKWebView` page.** Write the page once
in React, mark the few elements that should be native, and on iOS the app draws
them as real native views (Liquid Glass buttons, switches, maps, charts, your
own components) exactly where the web element sits. In a browser, and in any
app without Native Islands, the same page shows its web version.

<p align="center">
  <img src="docs/assets/showcase-components-light.png" width="260" alt="The Islands example app's Components tab in light mode: a large title, an inset grouped list and a floating Liquid Glass tab bar, all one web page">
  &nbsp;
  <img src="docs/assets/showcase-buttons-dark.png" width="260" alt="The Buttons screen in dark mode, with native Liquid Glass buttons placed inside the web page">
  &nbsp;
  <img src="docs/assets/showcase-maps-light.png" width="260" alt="A native MapKit map inside the web page, with web content scrolling around it">
</p>
<p align="center"><sub>Every screen above is one web page in a <code>WKWebView</code>. The glass, the map and the tab bar are native.</sub></p>

> [!WARNING]
> **Native Islands is experimental.** It is early, it has rough edges, and the
> contract between page and app, and the APIs on both sides, will change
> between versions. Read [Status](#status) before you build on it.

---

## One page, two worlds

Most teams that ship a web product and an iOS app end up choosing between two
bad options.

A **web view** reuses everything: the same React code, the same components,
the same release train. But it looks like a web view. Buttons don't have the
system's glass, switches don't feel like switches, and users can tell.

A **native rewrite**, in Swift or React Native, looks right. But it is a second
codebase with its own components, its own layout system and its own bugs, and
every screen has to be built twice and kept in step forever. React Native gives
you native views at the price of leaving the web: no DOM, no CSS, no npm
package that touches either.

Native Islands is a third option. The page stays a web page, with all of the
web: any React code, any CSS, any library, deployed the way it is today. Only
the elements you choose become native, and they are not imitations drawn in
CSS. They are the real UIKit and SwiftUI views, with real Liquid Glass sampling
the page behind them, placed in the page so precisely that the seam does not
show.

```tsx
<GlassButton title="Continue" prominence="prominent" onPress={purchase}>
  <button className="cta">Continue</button>
</GlassButton>
```

On iOS that is a SwiftUI button with Liquid Glass. Everywhere else it is the
`<button>` inside it. The page does not branch.

## The insight: a web view is made of scroll views

The obvious way to put a native view on a web page is to float it above the
web view and move it on every scroll event. That approach is always a frame
late, it slides over sheets and footers it should sit under, and it falls
apart the moment the page animates.

Native Islands relies on a detail of how WebKit works on iOS. A `WKWebView` is
not one flat picture: WebKit builds the page out of real UIKit views. The page
scrolls in a `UIScrollView`, and every `overflow: auto` area on the page gets
its own native scroll view, a `WKChildScrollView`. So Native Islands does not
float views above the page. It puts each native view **inside the scroll view
that holds its element**, at the element's exact spot, as a sibling of the
layers WebKit draws the page with.

This is the real hierarchy of a running page, as Xcode's view debugger shows
it:

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

Once the native view is a child of the right scroll view, UIKit does most of
the work:

- **Scrolling is free.** The view scrolls with the page frame for frame,
  momentum and rubber-banding included, with no JavaScript following it.
- **Transitions are free.** When a route slides, fades or scales, WebKit
  animates its scroll view with Core Animation, and the native view rides
  along.
- **Stacking is right.** Web content WebKit draws above that scroll view (a
  footer, a sheet, the next page) covers the native view the way it would
  cover the web element.
- **Glass is real.** Liquid Glass samples what is behind it, and behind it is
  the actual page, so a glass button bends the page's own gradients, images
  and video.

<p align="center">
  <img src="docs/assets/showcase-buttons-web-light.png" width="260" alt="The Buttons screen with islands switched off: every button is its web version">
  &nbsp;
  <img src="docs/assets/showcase-buttons-light.png" width="260" alt="The same screen with islands on: the buttons are native Liquid Glass, everything else is unchanged">
</p>
<p align="center"><sub>The same page with islands off (left) and on (right). Only the buttons and the tab bar change; the layout does not move.</sub></p>

## How it works

### The page leads, the app draws

The page stays in charge of layout. It measures each island's web element,
picks the scroll view it belongs to, and tells the app. The app adds the
native view there and answers, and only then does the web version fade out.

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

When an element moves or changes size, the page measures it again and the app
moves the native view with it. Web content that covers an island is cut out of
the native view, and see-through covers, such as a sheet's dimmed backdrop,
are laid over it in their colour, so the island stays native under them too.

Values travel both ways, in five kinds of message. Each has one direction and
one job:

| Kind         | Direction                     | What it is for                                                        | Example                |
| ------------ | ----------------------------- | --------------------------------------------------------------------- | ---------------------- |
| **props**    | page → native                 | What to draw. Sent again whenever React re-renders with new values.   | `title`, `prominence`  |
| **events**   | native → page                 | Something happened. Fire and forget, like a DOM event.                | `press`, `submit`      |
| **state**    | native → page, kept           | A value the native view owns, which the page can read at any time.    | the text typed so far  |
| **requests** | native → page, with an answer | The native view asks the page and awaits its reply.                   | "is this email valid?" |
| **commands** | page → native, with an answer | The page tells the native view to do something and awaits the result. | `focus`, `reset`       |

Props and commands go down, the other three come up. A component declares
only the kinds it uses:

```tsx
const SignupForm = defineNativeComponent<{
  props: { title: string };
  events: { submit: { email: string } };
  state: { email: string };
  requests: { validateEmail: { payload: { email: string }; result: { error?: string } } };
  commands: { focus: { args: void; result: void } };
}>("signupForm");
```

### Motion without messages

Sending a message on every frame would bring back the lag of an overlay, so
the common kinds of motion are described once and run by the app itself:

- **Sticky boxes.** A `position: sticky` element is sent with its sticky box,
  inset and travel. The app runs the same sticky rule on every scroll, so the
  native view sticks and comes unstuck in the same frame as the content.
- **Clipping boxes**, such as an accordion opening. The app cuts the native
  view to the part the box shows, so the island is revealed as the box opens.
- **Turned and faded boxes.** An element inside a rotated, scaled or
  see-through box is drawn turned and faded the same way.
- **Sliding pages.** An island outside any scrolling area, such as a nav bar
  button, gets its page's CSS slide (translate keyframes, Bézier easing,
  progress), and the app runs the same slide in Core Animation.

What cannot be described this way, a 3D transform, a filter or a clip path,
shows the web version instead.

### Never a flash of web

A user should never see the web version of a button before the native one.
The app keeps each new page covered until the page reports that every island
of its first frame is drawn, with a timeout so a page without islands still
shows. Pages that are rendered but not yet on screen, such as the next step
of a flow, get their islands up front, so they slide in already native. An
island that comes back, such as a search result showing again, reuses the
native view it had instead of building a new one.

### Built on public API, and safe when it is not there

Everything uses public UIKit and WebKit API: `UIScrollView`, `hitTest`,
`WKUserScript`, `WKScriptMessageHandler`, `UIGlassEffect`. The one thing
WebKit does not promise is how it arranges those views, so the host finds an
area's `WKChildScrollView` by its size and scroll offset, never by its place
among the subviews.

Every failure falls back to the web. If a future iOS changes that layout, no
scroll view matches and the element stays web. A host that cannot draw a
component, an iOS it was not built for, a browser, or a page that cannot tell,
all show the web version. The page never breaks; at worst it is a little less native.

## Proof

Each claim above is checked by a test that runs on every change, and the
results are written down.

### Compatibility

Islands are tested and draw natively on **every iOS from 16 to 27**, the
releases we can run in CI and on simulators today. Below iOS 26 they keep the
look Apple's own controls have there, a system material in the same shape,
never the web version.

| iOS       | Islands | Glass looks like | WebKit probe | Swift suite | Alignment (0.5 pt)  | Screenshots |
| --------- | ------- | ---------------- | ------------ | ----------- | ------------------- | ----------- |
| 16.0–16.4 | native  | system material  | CI only      | CI only     | –                   | –           |
| 17.5      | native  | system material  | pass         | pass        | pass                | `iOS-17`    |
| 18.6      | native  | system material  | pass         | pass        | pass                | `iOS-18`    |
| 26.1–26.5 | native  | Liquid Glass     | pass         | pass        | pass, except 26.3.1 | `iOS-26`    |
| 27.0–27.2 | native  | Liquid Glass     | pass         | pass        | pass                | `iOS-27`    |

Three layers catch three kinds of breakage. A **WebKit probe** loads a fixture
page into a real `WKWebView` on each runtime, records its view tree, and diffs
the trees across iOS versions, so a change in WebKit's layout fails before it
reaches an app. The **Swift suite** runs the host on each runtime.
**TestHost's UI tests** open every scenario page and fail when a native view is
more than 0.5 pt from its web element, and compare each page with screenshot
baselines kept per iOS major. Measured on 2026-11-04; the full matrix, what
WebKit changed between versions, and how to add a new iOS are in
[`docs/compatibility.md`](docs/compatibility.md).

### Performance

Measured on an iPhone 18 Pro with iOS 27.2, a page holding a column of
SwiftUI glass buttons, median of three runs:

| Islands | Page shown, every island drawn | Memory per island | Dropped frames while scrolling | One full relayout (JS) |
| ------: | -----------------------------: | ----------------: | -----------------------------: | ---------------------: |
|      10 |                         220 ms |            962 KB |                              0 |                18.8 ms |
|      50 |                         318 ms |            431 KB |                              0 |                46.4 ms |
|     100 |                         414 ms |            360 KB |                              0 |                80.3 ms |

Scrolling, sticky boxes and page transitions cost nothing per island, because
UIKit moves the views. Each island after the tenth adds about 300 KB of app
memory. The cost that grows is a full relayout of the page: about 0.8 ms of
main-thread JavaScript per island, which fits in a frame for a few dozen
islands and takes about five frames for 100. Mounting is being reworked, so
the first-frame time will change. Exactly what each number measures, and how
to measure it on your own phone, is in
[`docs/performance.md`](docs/performance.md).

## Status

Native Islands is experimental and early. It runs a full example app and a
gallery of regression pages on every iOS from 16 to 27, and you should expect
bugs, missing pieces and breaking changes. Every young cross-platform layer goes through this
stage; the goal of publishing now is to go through it in the open.

Known limits today. Each is small, specific and written down, so you know
exactly where the edges are:

- **Layout-driven motion trails by a frame.** An element that moves by layout
  (a resize, a width animation) is followed by a message each frame, so its
  native view can trail it by one frame while it moves. Scrolling, sticky
  boxes and page slides are not affected.
- **Relayout grows with the island count**, about 0.8 ms per island on an
  iPhone 18 Pro (see [Performance](#performance)). Keep layout animations to
  pages with few islands.
- **Some CSS stays web.** An island inside a 3D transform, a filter or a clip
  path shows its web version.
- **Inner scroll views arrive late.** WebKit builds a scrolling area's scroll
  view a few frames after it lays the area out, so the host waits up to a
  second for it before the island stays web.
- **One known misalignment.** After a fast fling, the buttons in a carousel
  nested inside a list can sit about 0.5 pt off until the next layout pass.
  The alignment test marks this one case as an expected failure.
- **iOS only.** There is no Android host yet.

### Has this been done before?

Parts of it. Map plugins for Cordova and Capacitor draw one native map behind
a transparent web view. Hotwire Native lets a page drive native navigation
bars and toolbars. One Expo app placed a fixed set of native controls in a web
view's main scroll view. As far as we know, nothing else puts any view the app
registers inside WebKit's own scroll views, carries it through page
transitions, and passes values both ways. If you know of prior work, please
open an issue; we would like to credit it.

---

## Getting started

There are two packages, one per side, and they speak one contract.
`tests/fixtures/messages.json` holds an example of every message, and the
tests of both packages decode it, so neither side can drift from the other.

| Side       | Package                   | Where                                  |
| ---------- | ------------------------- | -------------------------------------- |
| App (iOS)  | `NativeIslands` (SwiftPM) | `packages/swift/Sources/NativeIslands` |
| Page (web) | `native-islands` (npm)    | [`packages/web/`](packages/web/)       |

Add the page side from npm, and the app side with Swift Package Manager from
`https://github.com/superwall/native-islands`:

```bash
npm install native-islands
```

### On the page

```tsx
import { defineNativeComponent, NativeIslandsProvider } from "native-islands/react";

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

The children are the web version. The app draws the native button in their
place when it registered `glassButton`, and the children show everywhere else.
The full page API, including state, requests, commands and use without React,
is in [`packages/web/README.md`](packages/web/README.md). The packages don't
ship ready-made native components yet, and a components package is in the
works. Until then, the example app has a set of glass buttons and controls to
copy from.

### In the app

```swift
import NativeIslands

NativeComponentRegistry.shared.register("glassButton") { component in
  Button(component.props.string("title") ?? "") {
    component.emit("press")
  }
}

let webView = IslandWebView(frame: .zero)
webView.load(URLRequest(url: pageURL))
```

`IslandWebView` is a `WKWebView` with a `NativeIslandsHost` attached. It offers
the page what you registered on `NativeComponentRegistry.shared` before it
loads.

With a web view of your own, attach `NativeIslandsHost(webView:)` before the
first load and forward two calls to it, as `IslandWebView` does:

- its `hitTest(_:with:webHit:)` from your `hitTest(_:with:)`, so islands in
  inner scrolling areas take their taps;
- its `webViewDidMoveToWindow()` from your `didMoveToWindow()`, so each
  island's hosting controller becomes a child of the view controller that
  shows the web view, and presents sheets, menus and pickers from there.

```swift
override func didMoveToWindow() {
  super.didMoveToWindow()
  islands.webViewDidMoveToWindow()
}
```

### Revealing the page

The host keeps each new document covered, in the colour behind the web view,
until the page says its islands are drawn. The React provider sends that
signal once every island of the first frame is drawn or settled on its web
version; a page without React calls `islands.announceReady()` itself. The host
then waits two frames, so WebKit has laid the page out with the safe area, and
shows it. A page that never announces is shown after the timeout:

```swift
let host = NativeIslandsHost(webView: webView, reveal: .whenIslandsReady(timeout: 2))
host.onReady = { reason in present() } // .ready or .timedOut
```

Pass `.immediately` for web views that load pages without the library.

A page that is rendered but not showing yet, such as the next screen of a
flow, keeps its islands placed when the host offers the `layered` feature.
Mark it with `data-island-phase` or `inert` and lay it out off screen or
underneath, rather than `display: none`: its islands mount right away and ride
along when it slides in.

## Try it

**Islands** (`examples/`) is a component catalogue in the style of an iOS 26
app, and every screen of it is one web page in a `WKWebView`: large titles,
inset grouped lists, push and swipe back, a native navigation bar that stays
put while screens slide under it, and a floating Liquid Glass tab bar.

- **Components:** glass buttons, menus, toggles, segmented controls, sliders,
  steppers, pickers, date and colour pickers, text fields, gauges, SF Symbol
  effects and Swift Charts.
- **Capabilities:** a MapKit map, video with Picture in Picture, the live
  camera, the photo picker handing photos back to the page, permission
  prompts, haptics and the share sheet.
- **Search:** a native search field that filters every demo as you type.
- **Settings:** appearance and accent colour, which the native views follow,
  and a **Native Islands** switch that shows the web version of every island
  in place.

<p align="center">
  <img src="docs/assets/showcase-charts-light.png" width="260" alt="Swift Charts inside the web page in light mode">
  &nbsp;
  <img src="docs/assets/showcase-charts-dark.png" width="260" alt="The same charts in dark mode">
</p>

You need macOS with Xcode 26 or later, [Bun](https://bun.sh) 1.4.4 or later and
[XcodeGen](https://github.com/yonaskolb/XcodeGen).

```bash run
bun install
cd examples/ios && xcodegen && open Islands.xcodeproj
```

Run it on a simulator or an iPhone. The app bundles the page and needs
no network, except for the sample video. Launch it with `-screen <id>` (such
as `-screen maps`) or `-tab <id>` to open one screen. Camera and Picture in
Picture need a real iPhone.

The same page runs in a browser, where `?native=simulate` draws a magenta
outline wherever a native view would sit:

```bash run
bun run --cwd examples/showcase dev
```

Then open `http://localhost:5173/?native=simulate`, or
`http://localhost:5173/?native=simulate&screen=buttons` for one screen.

`tests/pages/` is the scenario gallery behind the tests: regression pages for
every scenario, and a three-page flow that shows islands sliding in with their
page. `tests/ios/` is TestHost, the app that bundles them. In a
browser, `?route=<name>` opens one page (`buttons`, `controls`, `scrolling`,
`motion`, `overlays`, `stress`, `state`, `flow-plans`); in TestHost it is
`-route <name>`, and `-NativeIslandsAlignmentLog YES` logs each native frame
beside its DOM rect.

## Develop

```bash
bun install
bun run --cwd packages/web test:run
bun run --cwd packages/web typecheck
xcodebuild test -scheme NativeIslands -destination 'platform=iOS Simulator,name=iPhone 17'
scripts/ui-tests.sh          # alignment and screenshots on several simulators
scripts/compat-matrix.sh     # the WebKit probe on every installed iOS runtime
```

Every check, the contract rules and the code style are in
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

Native Islands is released under the
[Functional Source License 1.1, MIT Future License](LICENSE) (FSL-1.1-MIT).
You can use, change and ship it in your own apps and products for any purpose
except a competing use: a commercial product or service that substitutes for
Native Islands, or for a Superwall product built on it, or that offers
substantially the same functionality. Each release becomes plain MIT two years
after it is published. The FSL is a
[Fair Source](https://fair.io) licence, not an OSI-approved open source one.

Copyright 2026 Superwall, Inc.
