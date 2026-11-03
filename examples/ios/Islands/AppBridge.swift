import UIKit
import WebKit

/// The page's messages to the app itself rather than to an island, posted to
/// `window.webkit.messageHandlers.showcase` by `examples/showcase/src/app/host.ts`.
/// A separate object, because the content controller keeps its handlers alive.
final class AppBridge: NSObject, WKScriptMessageHandler {
  static let name = "showcase"

  enum Message {
    case appearance(UIUserInterfaceStyle)
  }

  private let receive: @MainActor (Message) -> Void

  init(receive: @escaping @MainActor (Message) -> Void) {
    self.receive = receive
  }

  static func decode(_ body: Any) -> Message? {
    guard let body = body as? [String: Any], let type = body["type"] as? String else { return nil }
    switch type {
    case "appearance":
      let styles: [String: UIUserInterfaceStyle] = ["system": .unspecified, "light": .light, "dark": .dark]
      return (body["value"] as? String).flatMap { styles[$0] }.map(Message.appearance)
    default:
      return nil
    }
  }

  func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    guard let decoded = Self.decode(message.body) else { return }
    MainActor.assumeIsolated { receive(decoded) }
  }
}
