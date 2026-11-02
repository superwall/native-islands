import UIKit
import WebKit

/// Draws native islands in a `WKWebView` page that uses
/// `@superwall/native-islands`.
///
/// Attach it before the web view loads its first page: it adds the script that
/// tells each document what the registry offers, and the message handler the
/// page posts its islands to.
///
/// ```swift
/// let webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
/// let islands = NativeIslandsHost(webView: webView)
/// webView.load(URLRequest(url: pageURL))
/// ```
///
/// Islands in the page's inner scrolling areas take touches only when the web
/// view asks the host first. ``IslandWebView`` does that for you; a web view of
/// your own calls ``hitTest(_:with:webHit:)`` from its `hitTest(_:with:)`.
///
/// Islands are cleared whenever a new document starts. Call
/// ``webContentProcessDidTerminate()`` from your navigation delegate so they
/// are cleared as soon as the page is gone.
@MainActor
public final class NativeIslandsHost {
  /// The components this host offers.
  public let registry: NativeComponentRegistry
  /// The web view this host draws in, while it is alive.
  public private(set) weak var webView: WKWebView?

  let manager: NativeIslandManager?
  private let surface: WebViewSurface?
  private var userContentController: WKUserContentController?
  private var alignmentProbe: NativeAlignmentProbe?

  /// Sent by the host's own document-start script, so islands of an old
  /// document never outlive it.
  static let documentStartMarker = "native-islands-document-start"

  /// Attaches to `webView`, offering what `registry` holds, or
  /// ``NativeComponentRegistry/shared`` when it is `nil`.
  ///
  /// When the registry is empty, or the OS is older than iOS 26, nothing is
  /// offered and every page shows its web versions.
  public init(webView: WKWebView, registry: NativeComponentRegistry? = nil) {
    let registry = registry ?? .shared
    self.registry = registry
    self.webView = webView
    guard let capability = registry.capability, let preload = capability.preloadScript else {
      manager = nil
      surface = nil
      return
    }
    let surface = WebViewSurface(webView: webView)
    self.surface = surface
    var deliver: (@MainActor ([NativeReply]) -> Void)?
    let manager = NativeIslandManager(registry: registry, surface: surface) { replies in
      deliver?(replies)
    }
    self.manager = manager
    deliver = { [weak self] replies in
      self?.deliver(replies)
    }
    let controller = webView.configuration.userContentController
    userContentController = controller
    controller.addUserScript(
      WKUserScript(source: preload, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    )
    controller.addUserScript(
      WKUserScript(
        source: Self.documentStartScript,
        injectionTime: .atDocumentStart,
        forMainFrameOnly: true
      )
    )
    controller.add(ScriptHandler(host: self), contentWorld: .page, name: NativeHostMessage.handlerName)
    NativeFrameReporter.install(in: controller, islands: manager)
    #if DEBUG
    if NativeAlignmentProbe.isRequested() {
      let probe = NativeAlignmentProbe(webView: webView, islands: manager)
      alignmentProbe = probe
      probe.start()
    }
    #endif
  }

  /// Whether the host offers any component to the page.
  public var isOffering: Bool {
    manager != nil
  }

  /// Stops drawing and removes the host's message handlers. The scripts it
  /// added stay in the configuration; pages they start show web versions
  /// once the handler is gone.
  public func detach() {
    alignmentProbe?.stop()
    alignmentProbe = nil
    manager?.clear(notifyPage: false)
    userContentController?.removeScriptMessageHandler(forName: NativeHostMessage.handlerName, contentWorld: .page)
    #if DEBUG
    userContentController?.removeScriptMessageHandler(forName: NativeFrameReporter.name, contentWorld: .page)
    #endif
    userContentController = nil
  }

  /// Clears every island once the page's process is gone. The reloaded page
  /// mounts them again.
  public func webContentProcessDidTerminate() {
    manager?.clear(notifyPage: false)
  }

  /// The island under `point`, in the web view's coordinates, or `nil` to let
  /// WebKit take the touch.
  ///
  /// - Parameter webHit: What the web view itself would hit there, as
  ///   `super.hitTest(_:with:)` returns it. An island in an inner scroller only
  ///   takes the touch when that hit is inside its scroller, so web content
  ///   covering part of it keeps its taps.
  public func hitTest(_ point: CGPoint, with event: UIEvent?, webHit: () -> UIView?) -> UIView? {
    guard let manager, let webView else { return nil }
    return manager.hitTest(point, in: webView, with: event, webHit: webHit)
  }

  func receive(_ body: Any) {
    guard let manager else { return }
    if let marker = body as? String, marker == Self.documentStartMarker {
      manager.clear(notifyPage: false)
      return
    }
    let message: NativeHostMessage
    do {
      message = try NativeHostMessage.decode(body: body)
    } catch {
      NativeIslandsLog.main.warning(
        "Dropped a message the host couldn't read: \(error.localizedDescription, privacy: .public)"
      )
      return
    }
    switch message {
    case .batch(let batch):
      manager.apply(batch)
    case .unreadableBatch:
      manager.recoverFromUnreadableBatch()
    case .command(let command):
      manager.perform(command)
    case .response(let response):
      manager.receive(response)
    }
  }

  private func deliver(_ replies: [NativeReply]) {
    guard let webView, let script = Self.deliveryScript(replies) else { return }
    webView.evaluateJavaScript(script, completionHandler: nil)
  }

  /// The script that hands `replies` to `window.__nativeIslands.accept64`.
  static func deliveryScript(_ replies: [NativeReply]) -> String? {
    guard let base64 = NativeReply.base64(replies) else { return nil }
    return "window.__nativeIslands && window.__nativeIslands.accept64(\"\(base64)\");"
  }

  static var documentStartScript: String {
    "window.webkit.messageHandlers.\(NativeHostMessage.handlerName).postMessage(\"\(documentStartMarker)\");"
  }
}

/// Forwards script messages without retaining the host, since the user content
/// controller keeps its handlers alive.
private final class ScriptHandler: NSObject, WKScriptMessageHandler {
  weak var host: NativeIslandsHost?

  init(host: NativeIslandsHost) {
    self.host = host
  }

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    let body = message.body
    MainActor.assumeIsolated {
      host?.receive(body)
    }
  }
}

/// The three spaces a page measures in, for any `WKWebView`.
@MainActor
final class WebViewSurface: NativeHostSurface {
  private weak var webView: WKWebView?
  private let layer: NativePassthroughView
  private let fallbackScrollView = UIScrollView()

  init(webView: WKWebView) {
    self.webView = webView
    layer = NativePassthroughView(frame: webView.bounds)
    layer.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    layer.backgroundColor = .clear
    webView.addSubview(layer)
  }

  var pageScrollView: UIScrollView {
    webView?.scrollView ?? fallbackScrollView
  }

  var screenLayer: UIView {
    webView?.bringSubviewToFront(layer)
    return layer
  }

  var viewport: UIView {
    webView ?? layer
  }
}
