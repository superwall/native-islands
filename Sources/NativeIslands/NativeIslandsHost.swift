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
/// Each new document is held hidden until its islands are drawn, so the page
/// never shows the web copy of an element that turns native a moment later.
/// See ``NativeIslandsReveal``.
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

  /// When each document is shown.
  public let reveal: NativeIslandsReveal
  /// Whether the current document is shown: its page announced its islands
  /// are drawn, the hold timed out, or nothing was held.
  public private(set) var isReady = true
  /// Called once per held document when it is shown, with why.
  public var onReady: (@MainActor (NativeIslandsReadiness) -> Void)?

  let manager: NativeIslandManager?
  private let surface: WebViewSurface?
  private let schedule: NativeIslandsScheduler
  private var hold = 0
  private var heldAlpha: CGFloat?
  private var router: NativeIslandsRouter?
  private var alignmentProbe: NativeAlignmentProbe?

  /// Sent by the host's own document-start script, so islands of an old
  /// document never outlive it.
  static let documentStartMarker = "native-islands-document-start"

  /// Attaches to `webView`, offering what `registry` holds, or
  /// ``NativeComponentRegistry/shared`` when it is `nil`.
  ///
  /// When the registry is empty, or the OS is older than iOS 26, nothing is
  /// offered, nothing is held, and every page shows its web versions.
  ///
  /// - Parameter reveal: When each document is shown. Default:
  ///   ``NativeIslandsReveal/whenIslandsReady(timeout:)`` with two seconds.
  public convenience init(
    webView: WKWebView,
    registry: NativeComponentRegistry? = nil,
    reveal: NativeIslandsReveal = .whenIslandsReady(timeout: 2)
  ) {
    self.init(webView: webView, registry: registry, reveal: reveal, schedule: Self.mainQueue)
  }

  init(
    webView: WKWebView,
    registry: NativeComponentRegistry?,
    reveal: NativeIslandsReveal,
    schedule: @escaping NativeIslandsScheduler
  ) {
    let registry = registry ?? .shared
    self.registry = registry
    self.webView = webView
    self.reveal = reveal
    self.schedule = schedule
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
    let router = NativeIslandsRouter.of(webView.configuration.userContentController)
    self.router = router
    router.join(self, webView: webView, scripts: [preload, Self.documentStartScript])
    #if DEBUG
    if NativeAlignmentProbe.isRequested() {
      let probe = NativeAlignmentProbe(webView: webView, islands: manager)
      alignmentProbe = probe
      probe.start()
    }
    #endif
    holdDocument()
  }

  /// Where every island is drawn compared with its web element, read from
  /// the page at one moment. Empty when nothing is offered or drawn. Meant
  /// for tests and debugging: it runs a script in the page each time.
  public func alignment() async -> [NativeIslandAlignment] {
    guard let webView, let manager, !manager.islands.isEmpty else { return [] }
    return await withCheckedContinuation { continuation in
      NativeAlignmentProbe.measure(webView: webView, islands: manager) { alignments in
        continuation.resume(returning: alignments)
      }
    }
  }

  /// Whether the host offers any component to the page.
  public var isOffering: Bool {
    manager != nil
  }

  /// Stops drawing and stops listening to this web view. Web views sharing
  /// its configuration keep their hosts; once none is left the message
  /// handlers are removed. The scripts stay in the configuration, as WebKit
  /// can't remove one alone, and pages they start show web versions.
  public func detach() {
    release()
    alignmentProbe?.stop()
    alignmentProbe = nil
    manager?.clear(notifyPage: false)
    router?.leave(self, webView: webView)
    router = nil
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
      holdDocument()
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
    case .ready:
      show(.ready)
    }
  }

  /// Hides the web view until the new document's page announces its islands
  /// are drawn, or the timeout passes.
  private func holdDocument() {
    guard case .whenIslandsReady(let timeout) = reveal, let webView else { return }
    hold += 1
    let current = hold
    isReady = false
    if heldAlpha == nil {
      heldAlpha = webView.alpha
      webView.alpha = 0
    }
    schedule(timeout) { [weak self] in
      guard let self, self.hold == current else { return }
      self.show(.timedOut)
    }
  }

  private func show(_ readiness: NativeIslandsReadiness) {
    guard !isReady else { return }
    release()
    onReady?(readiness)
  }

  /// Gives the web view back the alpha it had before the hold.
  private func release() {
    hold += 1
    isReady = true
    guard let alpha = heldAlpha else { return }
    heldAlpha = nil
    webView?.alpha = alpha
  }

  static let mainQueue: NativeIslandsScheduler = { delay, work in
    DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
      MainActor.assumeIsolated(work)
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

  /// Posts the document-start marker, and does nothing once the handler is
  /// gone, since the script outlives a detached host.
  static var documentStartScript: String {
    let handler = "window.webkit && window.webkit.messageHandlers.\(NativeHostMessage.handlerName)"
    return "\(handler) && \(handler).postMessage(\"\(documentStartMarker)\");"
  }
}

/// When a ``NativeIslandsHost`` shows each document.
public enum NativeIslandsReveal: Equatable, Sendable {
  /// As soon as WebKit draws it. Islands appear when they are drawn, so the
  /// web copy of an element can show for a moment first.
  case immediately
  /// Hidden from the document's start until its page announces that every
  /// island it rendered is drawn, or `timeout` seconds pass. A page that does
  /// not use `@superwall/native-islands` never announces, so it shows after
  /// the timeout; use ``immediately`` for web views that load such pages.
  case whenIslandsReady(timeout: TimeInterval)
}

/// Why a held document was shown.
public enum NativeIslandsReadiness: Equatable, Sendable {
  /// Its page announced that its islands are drawn.
  case ready
  /// The page did not announce in time.
  case timedOut
}

typealias NativeIslandsScheduler = @MainActor (TimeInterval, @escaping @MainActor () -> Void) -> Void

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
