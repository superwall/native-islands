# Pitfalls

The mistakes that break Native Islands pages and apps, each with its fix. Most
of them look fine in a browser and on a quick look in the simulator, so check
a change against this list before calling it done.

## Contents

- [What stays web, and why](#what-stays-web-and-why)
- [On the page](#on-the-page)
- [In the app](#in-the-app)
- [In Swift views of your own](#in-swift-views-of-your-own)
- [Proving it](#proving-it)

## What stays web, and why

An island shows its web version whenever the app cannot draw it exactly where
the page has it. That is the design: the page always works, and nobody sees a
native view in the wrong place.

| It stays web when                                                 | Because                                                         | Do instead                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| The page runs in a browser, or in an app without the library      | There is no app to draw it                                      | Nothing: the web version is the product there             |
| The app did not register the name, or registered an older version | It cannot draw what it does not have                            | Register it; raise `version` only when the page needs it  |
| An ancestor has a 3D transform, a `filter` or a `clip-path`       | The app cannot apply those to a native view the way WebKit does | Keep islands out of such elements                         |
| It is `display: none`, `visibility: hidden` or has no size        | There is no box to draw in                                      | Park waiting screens off screen instead of hiding them    |
| It is inside an `inert` element without `data-island-phase`       | The page marked that part as not in use                         | That is how a parked screen waits; remove a stray `inert` |
| A page element covers all of it                                   | Islands sit above the page, so the page could not show over it  | Make the overlay a prop of the island, or move it         |
| An ancestor is running a CSS transition the app cannot mirror     | The native view would trail the web one                         | Slide screens with `data-island-phase`                    |
| Its children are bare text, `null` or hidden                      | The island measures its children                                | Wrap one laid-out element of the right size               |
| A prop is not JSON                                                | Props cross to Swift as JSON                                    | Send strings, numbers, booleans, arrays and plain objects |

## On the page

| Wrong                                                                | Right                                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `if (window.webkit) <NativeThing/> else <WebThing/>`                 | One island with the web version as its children; the island decides                                     |
| Custom children with no `onClick`, relying on `onPress`              | Children you pass replace the built-in web version: wire their handlers too                             |
| `defineNativeComponent` inside a component                           | Define it once at module level; a new one each render remounts the island                               |
| `style` or `className` on the island                                 | Style the children; the island's wrapper is `display: contents`                                         |
| A badge or label positioned over an island                           | A prop the native view draws                                                                            |
| `display: none` on a screen that is about to slide in                | Keep it laid out, `inert`, moved off screen with a `transform`, each at its own position                |
| Two parked screens stacked at the same spot                          | Give each its own position, so no island sits under another                                             |
| An event `valueChange` next to a state key `value`                   | Names apart: both would be `onValueChange`                                                              |
| A value the user owns sent as an event                               | State, so an echo of an older value never flips the native control back                                 |
| `email={email}` for a state key not listed in `props`                | List a key the page also sets in `props` as well as `state`                                             |
| `await ref.current.command("focus")` with no `catch`                 | Catch `NativeCommandError` and do the web thing: it rejects in browsers and before the island is native |
| `date={new Date()}`                                                  | `date={new Date().toISOString()}`                                                                       |
| `tint="oklch(70% 0.1 200)"`, or a `var()` nested in an item          | Hex or `rgb()` for nested colours; top-level colour props may use `var(--token)`                        |
| A second `NativeIslandsProvider` inside the first, or one per screen | One provider at the root                                                                                |
| `announceReady={false}` and nothing else                             | Leave it on, or call `useNativeIslands().announceReady()` once the first islands are mounted            |
| Animating `width`, `height` or `top` on a page full of islands       | Animate `transform` and `opacity`; layout costs about 0.3 ms per island per frame                       |
| Hundreds of islands, such as one per row of a long list              | One `List` island, or fewer parked screens: a page shows at most 256                                    |
| A parked screen keeping the camera or a video playing                | Let go of devices while the screen is not showing                                                       |
| A web version of `<div onClick>`s with no roles or labels            | Real buttons, roles, `aria-*` state and labels: VoiceOver reads the web version of islands in the page  |
| `aria-hidden` or `visibility: hidden` on a web version you pass      | Leave it readable; the island hides it from sight and touches itself                                    |

## In the app

| Wrong                                                                        | Right                                                                                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Registering after `IslandWebView(frame:)` or in `viewDidLoad` after it       | Register at launch; a host reads the registry only when it is made                                      |
| A registry of your own for some components                                   | `NativeComponentRegistry.shared`: sheets and popovers load their pages with it                          |
| `NativeIslandsHost(webView:)` without keeping it                             | Keep a strong reference; nothing else holds it, and every island goes web                               |
| A web view of your own that does not forward `hitTest` and `didMoveToWindow` | Forward both, as `IslandWebView` does                                                                   |
| A web view straight in a window                                              | Inside a view controller's view, so sheets and menus can present                                        |
| Creating the web view in a SwiftUI `body` or `updateUIView`                  | Create it once in `makeUIView` or a view controller                                                     |
| A cover colour that is not the page's                                        | Give the web view, or the view behind a clear one, the page's background in light and dark              |
| `reveal: .immediately` for pages that use the library                        | `.whenIslandsReady(timeout:)`, the default, so web versions never show turning native                   |
| Pages loaded from `file://`                                                  | A `WKURLSchemeHandler` on a scheme of your own, or `https`, so sheets can load pages of the same origin |
| A sheet whose `url` is on another origin                                     | The same origin as the presenting page; others are refused                                              |
| `webViewWebContentProcessDidTerminate` not forwarded                         | Call `islands?.webContentProcessDidTerminate()`, then reload                                            |
| No `NSCameraUsageDescription` and friends                                    | Add the keys in [Info.plist keys](host.md#infoplist-keys); App Store Connect may ask even when unused   |
| Your own `toggle` registered before `NativeIslandsComponents.register()`     | After it: the later registration wins                                                                   |

## In Swift views of your own

| Wrong                                                             | Right                                                                             |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `item["count"] as? Int`                                           | `(item["count"] as? NSNumber)?.intValue`; every number from JSON is a `Double`    |
| `props.string("tint")` turned into a colour by hand               | `props.color("tint")`, or `NativeComponentProps.color(css:)` for a nested one     |
| A copy of a prop in `@State` that the view edits                  | Read from `component.props`, which already holds the state the view set           |
| `var component: NativeComponentContext` without `@ObservedObject` | `@ObservedObject`, so new props redraw the view                                   |
| An event for something the page must not miss                     | State: events are dropped while the island is parked or hidden                    |
| A `Date` or a custom type in `emit` or `setState`                 | JSON only; anything else is dropped and logged                                    |
| `request` without `do`/`catch`                                    | Handle `.refused`, `.timedOut` and `.notShowing`                                  |
| An unknown command returning `nil`                                | Throw `NativeComponentError.refused`, so the page knows                           |
| `.frame(maxWidth: .infinity)` with `sizing: "native"`             | An ideal size (`.fixedSize()`); fill the box only with `sizing: "web"`            |
| A `glass` closure that returns `nil` until a prop arrives         | Decide glass from the first props: an island without glass at mount never gets it |
| `.accessibilityLabel` on each control inside one island           | Labels in the web version; in the page VoiceOver reads it, not the Swift view     |
| Keeping `component.id`                                            | It changes when the view is handed to a new island                                |

## Proving it

| Wrong                                                | Right                                                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| "It works in Chrome"                                 | A browser only shows web versions; run the app                                                     |
| "It looks native" on a glance at the simulator       | `-NativeIslandsOutlines YES`: every native island has a magenta outline and its name               |
| `simctl` or synthetic taps that do nothing           | Real touches: by hand, XCUITest or `axe tap --tap-style physical`                                  |
| Reading a missing console warning as "nothing wrong" | Check `data-island-mode` and `data-island-handoff`; layout hand-offs are not logged                |
| Checking only light mode on the newest iOS           | Light and dark, and an iOS before 26 if the app supports one: glass falls back to a material there |
