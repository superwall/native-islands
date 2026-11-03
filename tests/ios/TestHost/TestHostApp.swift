import NativeIslands
import SwiftUI

/// Loads the test pages in `tests/pages/` into an ``IslandWebView`` and draws their
/// islands natively. No account or network is needed: the pages are bundled.
///
/// Launch arguments:
/// - `-route <name>` opens one page directly, such as `-route buttons`.
/// - `-pagesURL http://<mac>:<port>/` loads the pages from `bun run --cwd tests/pages dev` instead.
/// - `-route perf -count 50` opens the performance page with 50 islands.
/// - `-UITestReport YES` exposes a JSON summary of the page to the UI tests;
///   `-perf YES` also runs the performance measurements.
/// - `-NativeIslandsAlignmentLog YES` logs every native frame beside its DOM rect (Debug builds).
@main
struct TestHostApp: App {
  init() {
    AppComponents.register()
  }

  var body: some Scene {
    WindowGroup {
      PagesView(url: PagesLocation.startURL())
        .ignoresSafeArea()
    }
  }
}

/// Where the pages come from.
enum PagesLocation {
  static let scheme = "islands"

  static func startURL(arguments: UserDefaults = .standard) -> URL {
    var components = URLComponents()
    components.scheme = scheme
    components.host = "pages"
    components.path = "/index.html"
    if let url = arguments.url(forKey: "pagesURL"),
      let given = URLComponents(url: url, resolvingAgainstBaseURL: false) {
      components = given
    }
    if let route = arguments.string(forKey: "route"), !route.isEmpty {
      components.queryItems = (components.queryItems ?? []) + [URLQueryItem(name: "route", value: route)]
    }
    if let count = arguments.string(forKey: "count"), !count.isEmpty {
      components.queryItems = (components.queryItems ?? []) + [URLQueryItem(name: "count", value: count)]
    }
    return components.url ?? URL(fileURLWithPath: "/")
  }
}

struct PagesView: UIViewControllerRepresentable {
  let url: URL

  func makeUIViewController(context: Context) -> PagesViewController {
    PagesViewController(url: url)
  }

  func updateUIViewController(_ controller: PagesViewController, context: Context) {}
}
