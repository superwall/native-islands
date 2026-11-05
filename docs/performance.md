# Performance

What an island costs, measured on a real iPhone. This page records the numbers,
exactly what each one measures, and how to measure them again.

On an iPhone 18 Pro, a page with 100 native glass buttons is shown
with every button drawn about 0.5 s after its web view is created, scrolls
without dropping a frame, and adds about 290 KB of app memory per island. The
cost that grows with the island count is a full relayout of the page: about
0.32 ms of main-thread JavaScript per added island, so 100 islands cost about
38 ms, a bit over two frames, each time the whole page lays out again.

Measured on 2026-11-04 against `main` at `f1e705f`.

## Results

iPhone 18 Pro (`iPhone19,2`), iOS 27.2, Xcode 27.2, Debug build of TestHost.
Each number is the median of three runs. The runs differed by up to 25% for the
first frame, 5% for memory, and 8% for relayout; no run dropped a frame.

```
 islands   first frame   memory per island   dropped frames   relayout (JS)
 ───────   ───────────   ─────────────────   ──────────────   ─────────────
      10        165 ms              971 KB                0          8.8 ms
      50        247 ms              421 KB                0         19.3 ms
     100        483 ms              357 KB                0         37.9 ms
```

Memory per island divides everything the app grew by over the island count, so
it includes a fixed cost that the first islands carry. Each island after the
tenth adds about 290 KB (284 KB from 10 to 50 islands, 293 KB from 50 to 100).

## What each number measures

The page is TestHost's `perf` route: a scrolling area holding a column of _n_
glass buttons, each a SwiftUI view with Liquid Glass, and nothing else.
`PerformanceUITests` opens it with 10, 50 and 100 islands, one fresh launch
each.

- **First frame:** from when the host creates its web view to when the host
  reveals the page because the page announced that every island of its first
  frame is drawn (`onReady` with `.ready`, never the timeout). It includes
  loading the bundled page, React's first render, every mount and its
  acknowledgement, and the two frames the host waits before revealing.
- **Memory per island:** the app's physical footprint (as Xcode's memory gauge
  shows it) once every island is drawn and has settled for half a second, minus
  the footprint when the web view was created, divided by the island count.
  WebKit renders page content in its own process, which this does not count.
- **Dropped frames:** frames the app's display link missed while the page
  scrolls its area from top to bottom and back over 1.6 s, one step per frame;
  the median of three sweeps. Islands ride along in WebKit's scroll view, so
  scrolling sends the host no message.
- **Relayout (JS):** the page nudges its own padding so that the whole page
  lays out again, and times the JavaScript that runs in animation-frame
  callbacks over the next two frames, where NativeIslands measures each island
  and sends the new frames. That time includes the style and layout work WebKit
  does when the library reads an element's position. The mean of 21 passes.

## What it means for a page

- Scrolling, sticky boxes and page transitions cost nothing per island: UIKit
  moves the native views with WebKit's own scroll views.
- A change that lays out the whole page (a window resize, a font load, content
  inserted above the islands) costs about 0.32 ms per island once. With up to
  about 30 islands that fits in a frame; with 100 it takes a bit over two.
- An element whose layout animates is measured on every frame of the
  animation, so keep such animations to pages with few islands. A page that
  slides in with a translate-only CSS animation is the exception: the host runs
  the same slide in Core Animation and needs no message per frame.

## Simulators

`performance/run.sh` runs the same test on a simulator and compares it with
`performance/baseline.json`, to catch large regressions in CI. A simulator runs
WebKit on the Mac's processor and shares it with everything else the Mac is
doing, so its numbers are neither comparable with a phone nor stable from one
run to the next: on a loaded Mac the same build measured relayout costs four to
nine times its baseline. Quote device numbers only.

## Measure again

On a connected iPhone (set your own team):

```bash
cd tests/ios && xcodegen -q
xcodebuild test -project TestHost.xcodeproj -scheme TestHost \
  -destination 'id=<device udid>' -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=<team> CODE_SIGN_STYLE=Automatic \
  -only-testing:TestHostUITests/PerformanceUITests \
  -resultBundlePath build/perf.xcresult
xcrun xcresulttool export attachments --path build/perf.xcresult --output-path build/perf
```

The `performance` attachment in `build/perf` holds the numbers as JSON. Run it
three times and take the median of each. On a simulator, `performance/run.sh`
prints them and checks them against the baseline.
