# Integrate Native Islands into an app and its pages

You are adding Native Islands to an iOS app that shows web pages in a
`WKWebView`, and to those pages, so their controls draw natively in the app
and stay web everywhere else.

## Checklist

- [ ] Page: `native-islands` installed, one `NativeIslandsProvider` at the root, `components.css` imported once
- [ ] Page: the first controls wrapped in ready-made islands, each keeping its web version as children
- [ ] App: the Swift libraries added, every component registered before the first web view
- [ ] App: pages shown in an `IslandWebView`, or a host attached to the web view the app or an SDK already has
- [ ] App: the web view's background set to the page's, in light and dark
- [ ] App: Info.plist keys for the islands the pages use
- [ ] Proven native in the app and web in a browser

## 1. The page

```bash
npm install native-islands
```

Wrap the root once:

```tsx
import { NativeIslandsProvider } from "native-islands/react";
import "native-islands/components.css";

export const Root = () => (
  <NativeIslandsProvider>
    <App />
  </NativeIslandsProvider>
);
```

Then replace one control at a time with its ready-made island, keeping the
page's own element as the children. Pick each from the table in
[Ready-made islands](../references/components.md#which-island-for-the-job).

```tsx
import { GlassButton } from "native-islands/components";

<GlassButton title="Continue" prominence="prominent" onPress={next}>
  <button type="button" className="cta" onClick={next}>
    Continue
  </button>
</GlassButton>;
```

The page still works unchanged in every browser. Decide here:

- **The page has no React:** use `connectNativeIslands` and call
  `islands.announceReady()`; see [Without React](../references/page.md#without-react).
- **The page renders on the server (Next.js):** nothing to change; islands go
  native once the page hydrates in the app.
- **The page has screens that slide in (a flow, a router):** park the ones not
  showing instead of unmounting them; see
  [Screens that are not showing yet](../references/page.md#screens-that-are-not-showing-yet).

## 2. The app

Add `https://github.com/superwall/native-islands` with Swift Package Manager
(`NativeIslands`, `NativeIslandsComponents`, and `NativeIslandsMaps` or
`NativeIslandsCharts` only if pages use a map or a chart), or with CocoaPods
from the repository at a release tag (the pods are not on the trunk):

```ruby
pod 'NativeIslands', git: 'https://github.com/superwall/native-islands.git', tag: 'v0.1.0'
pod 'NativeIslandsComponents', git: 'https://github.com/superwall/native-islands.git', tag: 'v0.1.0'
```

Register at launch, before any web view exists:

```swift
import NativeIslands
import NativeIslandsComponents
import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    NativeIslandsComponents.register()
    return true
  }
}
```

Then decide how the app shows pages:

- **A new screen, or a web view you can replace:** use `IslandWebView`, made in
  code inside a view controller; see [Show the page](../references/host.md#show-the-page).
- **An existing `WKWebView`, or a subclass:** call
  `NativeIslandsHost.attach(to: webView)` before its first load; see
  [Your own web view](../references/host.md#your-own-web-view).
- **A web view an SDK creates, such as a Superwall paywall:** attach in the
  hook the SDK calls with each new web view, set before the SDK starts:
  `Superwall.paywallWebViewCreated = { NativeIslandsHost.attach(to: $0) }`
  before `Superwall.configure`. The hook needs a SuperwallKit release that has
  it; see
  [A web view an SDK creates](../references/host.md#a-web-view-an-sdk-creates).
- **SwiftUI:** wrap the controller in a `UIViewControllerRepresentable`.
- **Pages bundled in the app:** serve them from a `WKURLSchemeHandler` on a
  scheme of your own (set it on the configuration before creating the web
  view), not `file://`, so sheets can load other pages of the same origin.

Set the web view's background (or its controller view's) to the page's
background colour in light and dark: the app covers the page with that colour
until its islands are drawn.

Add the Info.plist keys of the islands your pages use, listed in
[Info.plist keys](../references/host.md#infoplist-keys).

## 3. Verify

1. Build the page and the app. In a browser, the page looks and works as
   before: every island shows its web version.
2. Run the app on a simulator with the launch argument
   `-NativeIslandsOutlines YES`. Every island has a magenta outline with its
   name; a control without one is still web.
3. For any that stayed web, open Safari's Web Inspector on the simulator and
   follow [Debug an island](debug.md).
4. Tap each island with a real touch (by hand, XCUITest or
   `axe tap --tap-style physical`) and check the page reacts.
5. Switch to dark mode and back: no flash of a wrong colour on load.

## Pitfalls

- Registering in a view controller's `viewDidLoad` after creating the web view:
  the host offers nothing and every island stays web.
- Attaching after the web view has started loading, such as in a navigation
  delegate: the first page never hears which islands the app draws.
- A web view in a bare window with no view controller: sheets, menus and
  pickers have nothing to present from.
- Hiding the web versions with CSS to "force" native: they set each island's
  size and position, and are what browsers show.

More in [Pitfalls](../references/pitfalls.md).
