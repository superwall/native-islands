# The iOS host

Everything the app does: adding the package, registering components, showing
the page in a web view that draws islands, revealing it, and the Info.plist
keys some islands need.

## Contents

- [Add the package](#add-the-package)
- [Register components](#register-components)
- [Show the page](#show-the-page)
- [Your own web view](#your-own-web-view)
- [Revealing the page](#revealing-the-page)
- [Web view lifecycle](#web-view-lifecycle)
- [Presentations load pages too](#presentations-load-pages-too)
- [Info.plist keys](#infoplist-keys)
- [Debugging in the app](#debugging-in-the-app)

## Add the package

The package needs iOS 15 or later and draws every registered component on
every iOS it builds for; before iOS 26, glass falls back to a material in the
same shape.

Swift Package Manager: add `https://github.com/superwall/native-islands` and
pick only the libraries the app uses.

| Library                   | Brings                                                              |
| ------------------------- | ------------------------------------------------------------------- |
| `NativeIslands`           | The host: `IslandWebView`, `NativeIslandsHost`, the registry        |
| `NativeIslandsComponents` | The ready-made islands the page's `native-islands/components` names |
| `NativeIslandsMaps`       | The map (MapKit)                                                    |
| `NativeIslandsCharts`     | The chart (Swift Charts, drawn on iOS 16 and later)                 |

CocoaPods, which React Native and Expo apps build through, has one pod per
library:

```ruby
pod 'NativeIslands'
pod 'NativeIslandsComponents'
```

A pod of your own depends on it with `s.dependency 'NativeIslands'`.

## Register components

Register every component before the first web view that should offer it is
created: a host reads the registry once, when it is made, and tells each page
it loads which names it draws. A host made over an empty registry offers
nothing, so every island on its pages stays web. Register in
`application(_:didFinishLaunchingWithOptions:)`:

```swift
import NativeIslands
import NativeIslandsCharts
import NativeIslandsComponents
import NativeIslandsMaps
import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    NativeIslandsComponents.register()
    NativeIslandsMaps.register()
    NativeIslandsCharts.register()
    return true
  }
}
```

In a SwiftUI `App`, register in its `init()`.

The registry and every `register` are `@MainActor`. An app delegate, a
SwiftUI `App` and a view controller already run on the main actor; a helper
of your own that registers needs `@MainActor` too, or Swift 6 refuses to
build it:

```swift
@MainActor
enum AppIslands {
  static func register() {
    NativeIslandsComponents.register()
    NativeComponentRegistry.shared.register("rating", version: 1, accessibilityChildren: .contain) { component in
      RatingView(component: component)
    }
  }
}
```

- `NativeIslandsComponents.register(only: [.glassButton, .toggle])` registers
  some. The names are the cases of `NativeIslandsComponents.Component`, the
  same names the page uses.
- A component registered later under the same name replaces the built-in one,
  such as the app's own `toggle`. Register yours after the library's.
- `register()` also configures TipKit for `tip` (unless the app already has)
  and becomes the notification centre's delegate for `notifications` (unless
  the app set one), so call it before launch finishes to hear about the
  notification that opened the app.
- `NativeIslandsCharts.register()` does nothing before iOS 16; pages show the
  chart's web version there. `tip` needs iOS 17 the same way.

Your own component is one more `register` call; see the page side for the
matching `defineNativeComponent`. A view that draws several controls, as the
rating's stars do, passes `accessibilityChildren: .contain` so VoiceOver
reaches each one; a single control leaves it out. See
[Accessibility](custom-island.md#accessibility):

```swift
NativeComponentRegistry.shared.register("rating", version: 1, accessibilityChildren: .contain) { component in
  RatingView(component: component)
}
```

Use `NativeComponentRegistry.shared` unless the app truly needs separate sets:
sheets and other presentations load their pages in web views that read the
shared registry.

## Show the page

`IslandWebView` is a `WKWebView` with a `NativeIslandsHost` attached. It is
made in code only (`init(coder:)` is unavailable), so no storyboard.

```swift
import NativeIslands
import UIKit
import WebKit

final class PageViewController: UIViewController, WKNavigationDelegate {
  private let url: URL
  private var webView: IslandWebView?

  init(url: URL) {
    self.url = url
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("PageViewController is created in code.")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    // The page's background colour, in light and dark: the cover shows it.
    view.backgroundColor = .systemBackground
    let configuration = WKWebViewConfiguration()
    configuration.allowsInlineMediaPlayback = true
    let webView = IslandWebView(frame: view.bounds, configuration: configuration)
    webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    webView.isOpaque = false
    webView.backgroundColor = .clear
    webView.navigationDelegate = self
    #if DEBUG
    if #available(iOS 16.4, *) { webView.isInspectable = true }
    #endif
    view.addSubview(webView)
    self.webView = webView
    webView.load(URLRequest(url: url))
  }

  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    self.webView?.islands?.webContentProcessDidTerminate()
    webView.reload()
  }
}
```

| `IslandWebView` init | Default                          | Meaning                                                                 |
| -------------------- | -------------------------------- | ----------------------------------------------------------------------- |
| `frame`              | `.zero`                          | As for any view                                                         |
| `configuration`      | a new `WKWebViewConfiguration`   | Set URL scheme handlers, message handlers and media options on it first |
| `registry`           | `NativeComponentRegistry.shared` | Where its components come from                                          |
| `reveal`             | `.whenIslandsReady(timeout: 2)`  | When the page shows; see [Revealing the page](#revealing-the-page)      |

`webView.islands` is its host; `webView.islands?.isOffering` is `false` when
the registry was empty at creation, which is the first thing to check when
every island stays web. Islands present sheets,
menus and pickers from the view controller that shows the web view, so put it
in a controller's view, not a bare window.

In SwiftUI, wrap the controller in a `UIViewControllerRepresentable`, or the
web view in a `UIViewRepresentable` whose `makeUIView` creates the
`IslandWebView`; never create it in `body` or `updateUIView`.

## Your own web view

To keep a `WKWebView` subclass of your own, attach a `NativeIslandsHost`
before its first load, keep a strong reference to the host (nothing else
does), and forward two calls as `IslandWebView` does: `hitTest` so islands in
inner scrolling areas get their taps, and `didMoveToWindow` so islands present
from the right view controller.

```swift
import NativeIslands
import UIKit
import WebKit

final class PageWebView: WKWebView {
  private(set) var islands: NativeIslandsHost?

  init(configuration: WKWebViewConfiguration) {
    super.init(frame: .zero, configuration: configuration)
    islands = NativeIslandsHost(webView: self)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("PageWebView is created in code.")
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    islands?.webViewDidMoveToWindow()
  }

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    if let island = islands?.hitTest(point, with: event, webHit: { super.hitTest(point, with: event) }) {
      return island
    }
    return super.hitTest(point, with: event)
  }
}
```

Call `islands?.detach()` before reusing the web view for something without
islands. One host per web view; any number of web views can each have one.

## Revealing the page

The host covers each new page until the page says its islands are drawn, so
nobody sees web versions turn native, and the web view takes no touches
meanwhile. The cover takes the web view's own background colour, or when that
is clear the first one behind it (else `.systemBackground`), so give the web
view or its controller's view the page's background colour, in light and
dark.

| `reveal`                      | Use                                                                  |
| ----------------------------- | -------------------------------------------------------------------- |
| `.whenIslandsReady(timeout:)` | Pages that use `native-islands`; shows at the latest after `timeout` |
| `.immediately`                | Web views that also load pages without the library                   |

```swift
let host = NativeIslandsHost(webView: webView, reveal: .whenIslandsReady(timeout: 2))
host.onReady = { readiness in
  if readiness == .timedOut { print("The page never announced its islands.") }
}
```

A page that times out is a page bug: it renders no `NativeIslandsProvider`,
sets `announceReady={false}` without announcing, or, without React, never
calls `islands.announceReady()`.

## Web view lifecycle

- **Content process ended:** forward `webViewWebContentProcessDidTerminate(_:)`
  to `islands?.webContentProcessDidTerminate()`, then reload, as above. The
  host drops the native views of the page that died.
- **Navigation:** every new document clears the islands of the last and
  covers the page again; nothing to do.
- **Scrolling:** the host draws in WebKit's own scroll views, so any
  `scrollView` setting (insets, bounces, `isScrollEnabled = false` for a page
  that scrolls in its own areas) works as usual.
- **Sharing data with the page:** use your own `WKScriptMessageHandler` on the
  configuration for app logic; the host's own handler is `nativeIslands`, so
  pick another name.

## Presentations load pages too

`Sheet`, `FullScreenCover`, `Popover` and `Inspector` show another page in an
`IslandWebView` of their own. It shares the presenting web view's
configuration, so it loads the same URL schemes and message handlers, and the
shared registry. For safety it loads only pages of the presenting page's own
origin; a URL from anywhere else is refused and logged.

## Info.plist keys

Some islands need keys, but only when a page uses them:

| Component    | Library                   | Info.plist keys                                                                              |
| ------------ | ------------------------- | -------------------------------------------------------------------------------------------- |
| `Camera`     | `NativeIslandsComponents` | `NSCameraUsageDescription`                                                                   |
| `Permission` | `NativeIslandsComponents` | The usage description of each kind a page asks for: camera, microphone, location or photos   |
| `MapView`    | `NativeIslandsMaps`       | `NSLocationWhenInUseUsageDescription`, only when a page sets `showsUser`                     |
| `Video`      | `NativeIslandsComponents` | None; Picture in Picture keeps playing over other apps only with the `audio` background mode |

`NativeIslandsComponents` links the camera, location and photo frameworks, so
App Store Connect may warn about a missing purpose string even when no page
uses those islands. Add the keys; `register(only:)` does not silence it, as
the warning comes from linking.

## Debugging in the app

| Tool                                              | Shows                                                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `-NativeIslandsOutlines YES`                      | Debug builds: a magenta outline and the name over every native island                                      |
| `host.showsOutlines = true`                       | The same, at run time, in any build                                                                        |
| `-NativeIslandsAlignmentLog YES`                  | Debug builds: logs every island's native and web frame twice a second, flagging any more than 0.5 pt apart |
| `-NativeIslandsMountTrace YES`                    | Debug builds: how long each batch of islands took to reach the screen                                      |
| `await host.alignment()`                          | Each island's native frame next to its web frame, for a test                                               |
| Console, subsystem `com.superwall.native-islands` | The host's warnings: dropped messages, refused registrations, refused presentations                        |
| Safari Web Inspector                              | The page's console, which says why an island stayed web (needs `isInspectable` in Debug)                   |

Pass launch arguments in the scheme's Run arguments, or with
`xcrun simctl launch <device> <bundle id> -NativeIslandsOutlines YES`.

A browser shows only web versions, so prove every island on a simulator or an
iPhone. A synthetic simulator tap never reaches WebKit: drive the page with
real touches (XCUITest, `axe tap --tap-style physical`, or by hand).
