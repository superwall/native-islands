---
name: native-islands
description: Put real SwiftUI and UIKit views inside a web page running in a WKWebView with Native Islands (the `native-islands` npm package and the `NativeIslands` Swift package). Use when a page or an iOS app imports `native-islands`, `native-islands/react`, `native-islands/components`, `NativeIslands` or `NativeIslandsComponents`; when adding a native control, Liquid Glass button, sheet, alert, tab bar, navigation bar, list, map, chart, video, camera or any custom native view to a web page shown in an iOS app; when wiring `IslandWebView` or `NativeIslandsHost` into an app; or when an island shows its web version, sits in the wrong place, flashes or does not update. NOT for React Native, Capacitor plugins or native views laid over a web view by hand.
---

# Native Islands

Native Islands draws native iOS views inside a `WKWebView` page. The page
stays in charge of layout: each island is a web element, and the app draws a
native twin at that element's position, inside WebKit's own scroll views, so
it scrolls, slides and is covered exactly like the web around it. Anything the
app cannot draw stays web. There are two sides that must agree on one name:

| Side      | Package                                                      | What it does                                                     |
| --------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| Page (JS) | `native-islands` (npm), React bindings in `/react`           | Wraps a web element in a named island, lays it out               |
| App (iOS) | `NativeIslands` (SwiftPM or CocoaPods), iOS 15+              | Registers a SwiftUI view under that name and draws it            |
| Both      | `native-islands/components` + `NativeIslandsComponents`      | 34 ready-made islands: controls, sheets, chrome, lists           |
| Both      | `NativeIslandsMaps`, `NativeIslandsCharts` (Swift libraries) | The map and the chart, apart so an app links them only when used |

Reach for a ready-made island before writing your own: `GlassButton`,
`Toggle`, `Slider`, `Picker`, `TextField`, `Sheet`, `Alert`, `TabView`,
`NavigationStack`, `List`, `MapView`, `Chart`, `Video` and the rest need no
Swift beyond one `register()` call.

## The smallest working setup

On the page, the provider connects to the app and reveals the page once its
islands are drawn:

```tsx
import { NativeIslandsProvider } from "native-islands/react";
import { GlassButton, Toggle } from "native-islands/components";
import "native-islands/components.css";

export const App = ({ notify, setNotify, buy }: AppProps) => (
  <NativeIslandsProvider>
    <Toggle label="Notifications" isOn={notify} onChange={setNotify} />
    <GlassButton title="Continue" prominence="prominent" onPress={buy}>
      <button type="button" className="cta">
        Continue
      </button>
    </GlassButton>
  </NativeIslandsProvider>
);
```

In the app, register before the first load, then load the page in an
`IslandWebView` (a `WKWebView` with a `NativeIslandsHost` attached):

```swift
import NativeIslands
import NativeIslandsComponents

NativeIslandsComponents.register()

let webView = IslandWebView(frame: .zero)
webView.load(URLRequest(url: pageURL))
```

In a browser, or in an app that did not register `toggle`, the same page shows
the web versions. There are no platform checks anywhere.

## Hard rules

Each of these breaks a page in a way that is easy to miss on a simulator.

**1. The children are the web version, and they set the size.** An island is
drawn in the box of its web element, so the children must be a real, laid-out
element of the right size: never `null`, `display: none` or a zero-size box.
(A component defined with `sizing: "native"` or `"nativeHeight"` takes its
size, or its height, from the native view instead.)
Never branch on the platform (`navigator.userAgent`, `window.webkit`) to pick
one or the other; the island decides.

```tsx
// The native button sits exactly where this button is laid out.
<GlassButton title="Save" onPress={save}>
  <button type="button" className="save">
    Save
  </button>
</GlassButton>
```

**2. Register before you create the web view.** `IslandWebView` and
`NativeIslandsHost` read the registry once, when they are created, and offer
those names to every page that web view loads. A name registered later is
never offered to that web view, and a host created over an empty registry
does nothing at all, so every island stays web. Register in
`application(_:didFinishLaunchingWithOptions:)`, or at least before the
`IslandWebView(frame:)` or `NativeIslandsHost(webView:)` line.

**3. State for what the user owns, events for moments.** A switch, a slider
or typed text is state: the page passes it as a prop and hears changes as
`on<Key>Change`. A press or a submit is an event, heard as `on<Event>`. State
carries a revision, so an echo of an older value never flips the native control
back. Names of events, state keys and requests share one set of `on…` props:
never name an event `valueChange` next to a state key `value`.

```tsx
const Rating = defineNativeComponent<{
  props: { value: number; max: number };
  state: { value: number };
  events: { submit: { value: number } };
}>("rating");

<Rating value={stars} max={5} onValueChange={setStars} onSubmit={({ value }) => send(value)}>
  <WebStars value={stars} max={5} onChange={setStars} />
</Rating>;
```

**4. Nothing on the page can draw on top of an island.** Islands sit above the
page. A badge, a label or an overlay on an island is a prop the native view
draws, not a web element. Every item an island shows (a tab, a bar item, a
row, a menu action) is a prop too, so the page adds one without an app update.

**5. Park waiting screens, never `display: none` them.** A screen that is
rendered but not showing yet (the next step of a flow, a pushed route) keeps
its islands only when it is laid out. Mark it `inert` or with
`data-island-phase` (`ISLAND_PHASE_ATTRIBUTE`) and move it off screen or
underneath, each waiting screen at its own position, so its islands mount
early and slide in already native.

```tsx
<section
  className="screen"
  inert={!showing}
  style={{ transform: showing ? "none" : `translateX(${100 * (index + 1)}%)` }}
>
  <Checkout />
</section>
```

**6. In Swift, numbers from the page are `Double`.** Read top-level props with
`props.double` or `props.int`, and nested numbers through `NSNumber`, never
`as? Int`, which fails for every number JSON delivers.

```swift
let rows = component.props.all["rows"] as? [[String: Any]] ?? []
let counts = rows.map { ($0["count"] as? NSNumber)?.intValue ?? 0 }
```

**7. Let the page reveal itself.** The app covers each new page until its
islands are drawn. `NativeIslandsProvider` announces it; a page without React
calls `islands.announceReady()` once its first islands are mounted. Never set
`announceReady={false}` without calling it yourself, or every page waits for
the two-second timeout.

**8. Some places always stay web.** An island inside a 3D transform, a CSS
`filter` or a `clip-path` shows its web version, and so does any island the
app cannot place. That is the design, not a bug: never hide the web version to
"force" native, and never read "could not check" as "nothing there".

**9. Media fills its parent.** `MapView`, `Video`, `Camera` and
`MaterialBackground` take the size of their parent, so give the parent one,
such as `aspect-ratio: 16 / 9` or a fixed height.

**10. Prove it in the app, with real touches.** A browser only ever shows the
web versions. Run the app on a simulator or an iPhone and check each island
is native, not its web version, before calling the work done. A synthetic
simulator tap never reaches WebKit, so drive the web view with physical taps
(XCUITest, `axe tap --tap-style physical`) or by hand.

## Where to go next

Read only the file the job needs.

| Job                                                                           | Read                                                                                                              |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| The provider, defining a component, events, state, requests, commands, sizing | [Page side](references/page.md)                                                                                   |
| Why an island stays web, or parking screens that are not showing yet          | [When an island stays web](references/page.md#when-an-island-stays-web)                                           |
| A page without React, or testing in a browser with the simulator              | [Without React](references/page.md#without-react)                                                                 |
| Adding the Swift package, registering, `IslandWebView`, your own web view     | [iOS host](references/host.md)                                                                                    |
| The page shows late or flashes, Info.plist keys, debugging flags in the app   | [Revealing the page](references/host.md#revealing-the-page), [Debugging](references/host.md#debugging-in-the-app) |
