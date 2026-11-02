import ObjectiveC
import WebKit

/// The one set of scripts and message handlers a `WKUserContentController`
/// gets, however many hosts share it.
///
/// Web views made from one configuration share its user content controller,
/// and WebKit throws when a handler name is added twice. So the first host
/// installs everything, later hosts only join, and each message goes to the
/// host of the web view that posted it.
@MainActor
final class NativeIslandsRouter: NSObject, WKScriptMessageHandler {
  private struct Entry {
    weak var host: NativeIslandsHost?
  }

  private static var key: UInt8 = 0

  private weak var controller: WKUserContentController?
  private var hosts: [ObjectIdentifier: Entry] = [:]
  private var installedScripts: Set<String> = []
  private var listening = false

  private init(controller: WKUserContentController) {
    self.controller = controller
  }

  /// The router of `controller`, made the first time it is asked for.
  static func of(_ controller: WKUserContentController) -> NativeIslandsRouter {
    if let router = objc_getAssociatedObject(controller, &key) as? NativeIslandsRouter {
      return router
    }
    let router = NativeIslandsRouter(controller: controller)
    objc_setAssociatedObject(controller, &key, router, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
    return router
  }

  /// Sends `webView`'s messages to `host`, installing the handlers and the
  /// `scripts` this controller doesn't have yet.
  func join(_ host: NativeIslandsHost, webView: WKWebView, scripts: [String]) {
    guard let controller else { return }
    let id = ObjectIdentifier(webView)
    if let existing = hosts[id]?.host, existing !== host {
      NativeIslandsLog.main.warning(
        "A second NativeIslandsHost attached to one web view; the newer one draws its islands."
      )
    }
    hosts[id] = Entry(host: host)
    for source in scripts where !installedScripts.contains(source) {
      let isCapability = source.hasPrefix(Self.capabilityPrefix)
      if isCapability, installedScripts.contains(where: { $0.hasPrefix(Self.capabilityPrefix) }) {
        NativeIslandsLog.main.warning(
          "Web views sharing one configuration offer different components; each page sees the capability added last."
        )
      }
      installedScripts.insert(source)
      controller.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }
    guard !listening else { return }
    listening = true
    controller.add(self, contentWorld: .page, name: NativeHostMessage.handlerName)
    #if DEBUG
    let reporter = NativeFrameReporter { [weak self] webView in
      webView.flatMap { self?.host(for: $0)?.manager }
    }
    controller.addScriptMessageHandler(reporter, contentWorld: .page, name: NativeFrameReporter.name)
    #endif
  }

  /// Stops sending `webView`'s messages to `host`. Once no host is left the
  /// handlers go too; the scripts stay, as WebKit can't remove one alone.
  func leave(_ host: NativeIslandsHost, webView: WKWebView?) {
    hosts = hosts.filter { $0.value.host != nil && $0.value.host !== host }
    if let webView, hosts[ObjectIdentifier(webView)]?.host === host {
      hosts[ObjectIdentifier(webView)] = nil
    }
    guard hosts.isEmpty, listening, let controller else { return }
    listening = false
    controller.removeScriptMessageHandler(forName: NativeHostMessage.handlerName, contentWorld: .page)
    #if DEBUG
    controller.removeScriptMessageHandler(forName: NativeFrameReporter.name, contentWorld: .page)
    #endif
  }

  func host(for webView: WKWebView) -> NativeIslandsHost? {
    hosts[ObjectIdentifier(webView)]?.host
  }

  /// Whether the router's message handlers are installed.
  var isListening: Bool {
    listening
  }

  nonisolated func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    MainActor.assumeIsolated {
      guard let webView = message.webView else { return }
      host(for: webView)?.receive(message.body)
    }
  }

  static let capabilityPrefix = "window.\(NativeCapability.global)"
}
