import UIKit
import WebKit

/// The page's messages to the app itself rather than to an island, posted to
/// `window.webkit.messageHandlers.showcase` by `examples/showcase/src/app/host.ts`.
/// A separate object, because the content controller keeps its handlers alive.
final class AppBridge: NSObject, WKScriptMessageHandler {
  static let name = "showcase"

  enum Message: Equatable {
    case appearance(UIUserInterfaceStyle)
    case outlines(Bool)
  }

  private let receive: @MainActor (Message, WKWebView?) -> Void

  /// `receive` also gets the web view that posted, as pages presented in
  /// sheets share the app's configuration and so this handler.
  init(receive: @escaping @MainActor (Message, WKWebView?) -> Void) {
    self.receive = receive
  }

  static func decode(_ body: Any) -> Message? {
    guard let body = body as? [String: Any], let type = body["type"] as? String else { return nil }
    switch type {
    case "appearance":
      let styles: [String: UIUserInterfaceStyle] = ["system": .unspecified, "light": .light, "dark": .dark]
      return (body["value"] as? String).flatMap { styles[$0] }.map(Message.appearance)
    case "outlines":
      return (body["value"] as? Bool).map(Message.outlines)
    default:
      return nil
    }
  }

  func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    guard let decoded = Self.decode(message.body) else { return }
    MainActor.assumeIsolated { receive(decoded, message.webView) }
  }
}
