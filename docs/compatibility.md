# iOS and WebKit compatibility

Native Islands draws inside the UIKit views WebKit builds for a page. It does not
use a private API, but it does rely on how WebKit lays those views out. This
page records what that layout is on each iOS version, how it was measured, and
how to measure it again.

**In short:** islands draw natively on every iOS from 16 to 27. Below iOS 26
they stay native and take the look Apple's own controls have there (system
materials, bordered buttons), never the web version. Every iOS simulator runtime from
17.5 to 27.2 that we ran passes the WebKit probe, the Swift suite and TestHost's
alignment tests (26.3.1 skips the UI tests, see below), and the screenshot
baselines of 17, 18, 26 and 27 pass on their newest runtime. iOS 16
is covered only by the `iOS compatibility` workflow, as macOS 27 cannot boot
it; run it once after merging.

## How it is tested

Three layers, each catching what the one before cannot:

```
 layer               what it runs                  catches
 ──────────────────  ────────────────────────────  ──────────────────────
 1 WebKit probe      WebKitLayoutTests on a real   WebKit changing the
                     WKWebView, one view tree per  scroll views the host
                     runtime, diffed across them   draws in
 2 Swift suite       the package tests on each     host code that breaks
                     runtime                       on one iOS
 3 TestHost UI       alignment (0.5 pt) and        a look or a position
                     screenshots per iOS major     that changed on one iOS
```

| Where                      | Runs                   | iOS versions                    | When                 |
| -------------------------- | ---------------------- | ------------------------------- | -------------------- |
| `scripts/compat-matrix.sh` | layers 1–3 (`--steps`) | every runtime installed locally | by hand              |
| `scripts/ui-tests.sh`      | layer 3                | `--runtimes` you name           | by hand              |
| `compat.yml` workflow      | layers 1 and 2         | every patch release from 16.0   | Mondays, and by hand |
| Islands on a device        | by eye                 | the device's iOS                | before a release     |

## Adding a new iOS release

1. Install its simulator runtime (`xcodebuild -downloadPlatform iOS`) and run
   `scripts/compat-matrix.sh --runtimes <version> --steps probe,swift,ui`.
2. If the probe fails, WebKit changed a scroll view the host relies on: read the
   tree diff, then fix `NativeHostSurface.match`, never the test.
3. A new major has no screenshot baselines. Look at every TestHost page and the
   showcase on it, then record them with
   `scripts/ui-tests.sh --runtimes <version> --record --only ScreenshotUITests`.
4. Add the version to `ALL_RUNTIMES` in `.github/workflows/compat.yml`, and its
   row to the support matrix below.

## Writing islands that work on every iOS

- An island stays native on every iOS the host supports. When a SwiftUI API is
  newer than iOS 16, gate it with `if #available` and draw the closest thing
  Apple shipped before it: `examples/ios/Islands/Components/Defaults/Compat.swift`
  has the glass, glass button and symbol-effect fallbacks the showcase uses.
- Never fall back to the web version on older iOS. A registered component is
  offered on every iOS from 16, so the page draws it natively there; the web
  version is only for pages outside the app and iOS 15.
- Check a new island on the oldest and newest runtime you have before merging.

## Support matrix

The host draws islands from iOS 16; below that it offers nothing and the page
shows its web versions. Measured on 2026-11-04:

| iOS            | Islands drawn | Glass looks like               | WebKit probe | Swift suite | TestHost alignment  | Screenshot baselines |
| -------------- | ------------- | ------------------------------ | ------------ | ----------- | ------------------- | -------------------- |
| 15 and earlier | no, web only  | (web version)                  | –            | –           | –                   | –                    |
| 16.0–16.4      | yes           | system material, hairline edge | CI only      | CI only     | –                   | –                    |
| 17.5           | yes           | system material, hairline edge | pass         | pass        | pass                | `iOS-17`             |
| 18.6           | yes           | system material, hairline edge | pass         | pass        | pass                | `iOS-18`             |
| 26.1–26.5      | yes           | Liquid Glass                   | pass         | pass        | pass, except 26.3.1 | `iOS-26` (26.5)      |
| 27.0–27.2      | yes           | Liquid Glass                   | pass         | pass        | pass                | `iOS-27` (27.2)      |
| 27.2 on device | yes           | Liquid Glass                   | –            | –           | by hand             | –                    |

"Pass" is a run on a local simulator of that version, on macOS 27; "CI only" means the
`iOS compatibility` workflow, because macOS 27 cannot boot iOS 16. The device
row is the Islands app on an iPhone 18 Pro, checked by hand: Components, a pushed
screen (Buttons), merged glass groups and the tab bar.

What differs by version, for anyone building islands:

- **Glass.** iOS 26 and later draw Liquid Glass. Below 26 a glass island is the
  system material in the same shape, with a thin edge where it has no tint, and
  glass groups stay separate shapes, as Apple's own pre-26 bars do.
- **Controls.** Buttons fall back to Apple's bordered and bordered-prominent
  styles, and every other SwiftUI control draws as that iOS draws it.
- **Before iOS 17.** SwiftUI maps have no markers, selection or camera, so the
  showcase uses `MKMapView` there; symbol effects don't animate; charts read the
  drag directly. On iOS 17 symbol effects fall back to the nearest one it has.
- **Before iOS 18.** A SwiftUI island on a page that slid in is attached to the
  window again on its first touch, so its buttons take taps (see below).

## What the host relies on

The host finds the scroll view for each scrolling area of the page and adds its
native views there. That works as long as WebKit keeps doing these things:

1. The page scrolls in `WKWebView.scrollView` (a `WKScrollView`), and its
   `contentOffset` is the page's scroll position.
2. Every `overflow: auto` or `overflow: scroll` box with something to scroll
   gets its own `UIScrollView` subclass (`WKChildScrollView`), sized to the box's
   padding box, with `contentOffset` equal to the box's `scrollLeft` and
   `scrollTop`. The host matches it by that size and offset
   (`NativeHostSurface.match`).
3. Those scroll views are descendants of `WKContentView`, inside the
   `WKCompositingView` tree that mirrors the page's compositing layers, so a
   view added to one moves, clips and animates with that layer.
4. Composited content later in the page sits in later sibling views, so it
   draws above a native view added to an earlier scroll view.
5. `position: sticky`, `position: fixed`, 2D transforms, `isolation: isolate`
   and `display: contents` on an ancestor don't stop a box from getting its own
   scroll view.
6. A CSS animation on a route's box runs as a Core Animation animation on that
   box's view, so the native views in it ride along.

`WebKitLayoutTests` (in `packages/swift/Tests/NativeIslandsTests/Host/`) checks
each of these on a real `WKWebView` with one fixture page,
`WebKitLayoutFixture.html`. If WebKit stops doing one of them on some iOS, the
test fails on that iOS, and an element would show its web version there instead
of a native one.

## Measured view trees

The probe writes the view tree of the fixture page, with each probed element's
view marked, to one JSON file per runtime. `scripts/webkit-tree-diff.ts`
compares them with the newest release. These are the differences it found,
measured on 2026-11-04:

| iOS                        | WebKit user agent         | Every probed box has its scroll view | Differences from iOS 27.2 (24B114)                                                                |
| -------------------------- | ------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 17.5 (21F79)               | `iPhone OS 17_5`          | yes, matched by size and offset      | `position: fixed` scroller one level higher; nested scroller wrapped in one more compositing view |
| 18.6 (22G86)               | `iPhone OS 18_6`          | yes                                  | same as 17.5                                                                                      |
| 26.1, 26.3.1, 26.4.1, 26.5 | `iPhone OS 18_7` (frozen) | yes                                  | nested scroller wrapped in one more compositing view                                              |
| 27.0 (24A5408d)            | `iPhone OS 18_7`          | yes                                  | none                                                                                              |
| 27.1, 27.2 beta            | `iPhone OS 18_7`          | yes                                  | no scroll-edge effect views (device type, not WebKit)                                             |
| 27.2 (24B114)              | `iPhone OS 18_7`          | yes                                  | reference                                                                                         |

What each difference means for the host:

- **Fixed boxes (iOS 17 and 18).** WebKit puts viewport-constrained layers in a
  zero-sized container on iOS 17 and 18, and in a viewport-sized one from
  iOS 26. The `WKChildScrollView` of a fixed scroller is still a
  `WKChildScrollView` with the same frame in window coordinates and the same
  offset; only its depth changes. The matcher walks the whole tree and never
  counts levels, so this does not affect placement.
- **Nested scrollers (iOS 17 to 26).** Up to iOS 26 WebKit wraps a scroller
  that holds another scroller in one more `WKCompositingView` clipping layer.
  Again, the inner `WKChildScrollView` is unchanged.
- **Scroll-edge effect views (iOS 27 on some devices).** `BackdropView`,
  `ScrollEdgeEffectView` and two `_UITouchPassthroughView`s appear on the page's
  `WKScrollView` on iPhone 17 simulators of iOS 27.0 and 27.2. They are UIKit's
  Liquid Glass scroll-edge effect, added beside WebKit's content, not inside it.
  Native views go into `WKChildScrollView`s or `WKContentView`, never next to
  these, so they don't change order or touches.
- **User agent.** From iOS 26 Safari freezes the OS in the user agent at
  `18_7`. The page side never reads the user agent; this only matters to
  anyone debugging trees by user agent.

No runtime lost a probed view or changed its type, and on every runtime a
native view added at the host's spot lands on its element within 1 pt.

## What WebKit changed, from its sources

Apple's release notes rarely mention the UIKit views behind a page, so these
come from WebKit's commits, its bug tracker and other projects that hit them.
Items marked _unconfirmed_ have no source we could read.

- **iOS 27: `WKColorExtensionView` inside `WKScrollView`.** WebKit 318137@main
  ([commit 8b5cfad](https://github.com/WebKit/WebKit/commit/8b5cfad939f76e35a20fbc885759fb82914843d0),
  [bug 317336](https://bugs.webkit.org/show_bug.cgi?id=317336)) inserts a
  colour-extension view into the page's `WKScrollView` above `WKContentView`,
  and side ones into `WKWebView` above the scroll view. They take no touches and
  appear only when a `position: fixed` or `sticky` box touches an edge next to an
  obscured inset ([bug 301756](https://bugs.webkit.org/show_bug.cgi?id=301756)),
  which is why the probe, with no insets, never sees one. Islands anchored to
  the page are brought to the front of `WKScrollView`, so they draw above such a
  view inside an obscured inset, where WebKit's own content is under it.
- **iOS 26: scroll-edge effect on `WKScrollView`.** Built with the iOS 26 SDK,
  UIKit adds `ScrollEdgeEffectView` to every `UIScrollView`, the page's included
  ([Capacitor docs](https://github.com/ionic-team/capacitor-docs/pull/617)). The
  probe sees it on iOS 27 iPhone 17 simulators. Page islands sit above it, so
  they are not softened by the top edge effect the way web content is; an app
  can turn the effect off with `scrollView.topEdgeEffect.isHidden`.
- **iOS 26: `WKWebView.obscuredContentInsets`.** A public API that moves the
  layout viewport separately from `scrollView.contentInset`
  ([WebKit in Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)).
  The host's viewport comes from the web view's bounds and the page's own
  measurements, and `WKChildScrollView` offsets are unaffected; an app that sets
  these insets should be added to the probe before relying on page islands.
- **Safari 26.0 layout fixes.** Scroll compensation for fixed boxes is applied
  before other transforms, and `will-change: view-transition-name` or
  `offset-path` now make a stacking context. Both can add `WKCompositingView`s;
  neither changes the scroll views. Text selection is now drawn inside overflow
  scrollers, so selection views can appear in a `WKChildScrollView` beside
  islands.
- **iOS 18 to 26: child scroll-view gestures.**
  [Bug 290063](https://www.mail-archive.com/webkit-changes@lists.webkit.org/msg228569.html)
  (selection highlight blocking a child scroll) and
  [bug 306977](https://bugs.webkit.org/show_bug.cgi?id=306977) (swipes over some
  content not scrolling, a 26.x regression fixed in 306820@main) touched the code
  that scrolls `WKChildScrollView`s. Neither changes which views exist; both are
  why touches through islands are covered by the UI tests, not by the probe.
- **When a box gets a `WKChildScrollView`** _(unconfirmed)_. Since iOS 13 every
  composited `overflow: auto` or `scroll` box that actually overflows gets one;
  `-webkit-overflow-scrolling: touch` is ignored. `overflow: hidden` and `clip`
  never get one, and a box that does not overflow yet may get its scroll view
  only once it does. The host already waits for a match and keeps the web
  version until there is one.
- **iOS 16 and 17** _(unconfirmed)_. `overscroll-behavior` (16.0) maps to
  `bounces` on child scroll views and scroll snapping was reworked; both change
  scroll-view properties, not the tree. The iOS 16 trees come from CI.

What the host should keep doing because of these: find scroll views by class and
geometry, never by index among `subviews`; expect UIKit and WebKit views beside
`WKContentView` in `WKScrollView`; and treat a missing match as "stay web".

## Running it

On a Mac, every installed iOS runtime, one after another:

```bash
scripts/compat-matrix.sh                      # the WebKit probe on each runtime
scripts/compat-matrix.sh --runtimes 17.5,27.2 # some runtimes
scripts/compat-matrix.sh --list               # what it would run
```

It prints one line per runtime and then the tree comparison. The trees, logs and
result bundles are in `build/compat/`. `--steps probe,swift,ui` adds the whole
Swift suite and TestHost's alignment tests (every island within 0.5 pt of its
web element, pages pushed and popped) on each runtime.

## Looks per iOS release

Each iOS release draws controls its own way, so TestHost's screenshot baselines
are kept per major release in `tests/ios/Baselines/iOS-<major>/<device>/`, each
recorded on the newest runtime of that release:

```bash
scripts/ui-tests.sh --runtimes 17.5,18.6,26.5,27.2              # alignment and screenshots
scripts/ui-tests.sh --runtimes 17.5,18.6,26.5,27.2 --record --only ScreenshotUITests
```

`--runtimes` takes one iPhone per runtime, the first of `--devices` it has.
iOS 27 also keeps iPhone Air baselines. A page is photographed once two shots
half a second apart match, as glass can take a moment to finish drawing its
edge, and the home indicator strip is left out, since UIKit shades it
differently between runs.

Below iOS 18 SwiftUI hit-tests its content where the hosting view sat when it
last entered the window. WebKit slides a pushed page in by animating a layer far
above the island, so a SwiftUI button on that page took no taps on iOS 17. The
host attaches an island's hosting view again when a touch lands on it after it
moved. Scrolling does not count as a move, and an island holding the first
responder (a focused field) is left alone, since leaving the window would end
its editing. Detaching runs SwiftUI's `onDisappear` and `onAppear`, so a view
that starts a device there (a player, a camera) restarts on that first touch.
`AlignmentUITests.testPagesPushAndPopWithTheirIslandsAligned` taps
through a push on every runtime.

TestHost's alignment tests pass on 17.5, 18.6, 26.1, 26.4.1, 26.5, 27.0, 27.1
and 27.2. On the iOS 26.3.1 simulator, WebKit's page process crashes in
JavaScriptCore (`EXC_BAD_ACCESS` in `regExpProtoFuncSplitFast`) on a few page
loads, a different few each run, so those pages never report and their tests
time out. The same pages pass on 26.1 and 26.4.1, and the crash is inside the
runtime's own JavaScriptCore, so 26.3.1 is left out of the UI runs.

macOS 27 does not boot iOS 16 simulators, so iOS 16 runs only in CI. The
`iOS compatibility` workflow (`.github/workflows/compat.yml`) runs the probe
and the whole Swift suite on every iOS simulator runtime from 16.0, one
`macos-26` job each, then compares
all the trees in a last job whose summary shows the comparison. It runs every
Monday and by hand:

```bash
gh workflow run compat.yml --ref <branch>                      # every runtime
gh workflow run compat.yml --ref <branch> -f runtimes=16.4,17.5 # some
```

When Apple ships a new iOS, add its runtime to `ALL_RUNTIMES` in that workflow.
