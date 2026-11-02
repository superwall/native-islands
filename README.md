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

## Develop

```bash
bun install
bun run --cwd js test:run
bun run --cwd js typecheck
xcodebuild test -scheme NativeIslands -destination 'platform=iOS Simulator,name=iPhone 17'
```
