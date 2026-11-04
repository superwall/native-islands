import NativeIslands
import SwiftUI

/// Islands: an iOS app whose every screen is the web app in `examples/showcase`,
/// with native islands wherever a web view falls short. The app is bundled, so
/// it needs no network.
///
/// Launch arguments:
/// - `-screen <id>` opens one screen directly, such as `-screen accent`; `-tab <id>` opens a tab.
/// - `-pagesURL http://<mac>:<port>/` loads `bun run --cwd examples/showcase dev` instead.
/// - `-NativeIslandsOutlines YES` starts with every native island outlined.
@main
struct IslandsApp: App {
  init() {
    ShowcaseComponents.register()
  }

  var body: some Scene {
    WindowGroup {
      ShowcaseView(url: ShowcaseLocation.startURL())
        .ignoresSafeArea()
    }
  }
}

enum ShowcaseLocation {
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
    for name in ["tab", "screen"] {
      if let value = arguments.string(forKey: name), !value.isEmpty {
        components.queryItems = (components.queryItems ?? []) + [URLQueryItem(name: name, value: value)]
      }
    }
    return components.url ?? URL(fileURLWithPath: "/")
  }
}

struct ShowcaseView: UIViewControllerRepresentable {
  let url: URL

  func makeUIViewController(context: Context) -> ShowcaseViewController {
    ShowcaseViewController(url: url)
  }

  func updateUIViewController(_ controller: ShowcaseViewController, context: Context) {}
}
