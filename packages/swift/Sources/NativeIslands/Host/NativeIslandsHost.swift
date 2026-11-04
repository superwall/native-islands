import UIKit
import WebKit

/// Draws native islands in a `WKWebView` page that uses `@superwall/native-islands`.
///
/// Attach it before the web view loads its first page. A web view of your own
/// must forward `hitTest(_:with:)` to ``hitTest(_:with:webHit:)``, as
/// ``IslandWebView`` does, or islands in inner scrollers never receive touches.
@MainActor
public final class NativeIslandsHost {
  public let registry: NativeComponentRegistry
  public private(set) weak var webView: WKWebView?

  public let reveal: NativeIslandsReveal
  public private(set) var isReady = true
  public var onReady: (@MainActor (NativeIslandsReadiness) -> Void)?

  let manager: NativeIslandManager?
  private let surface: WebViewSurface?
  private let schedule: NativeIslandsScheduler
  private let settle: NativeIslandsSettle
  private var hold = 0
  private var held: (cover: NativeIslandsCover, interactive: Bool)?
  private var router: NativeIslandsRouter?
  private var alignmentProbe: NativeAlignmentProbe?

  static let documentStartMarker = "native-islands-document-start"

  public convenience init(
    webView: WKWebView,
    registry: NativeComponentRegistry? = nil,
    reveal: NativeIslandsReveal = .whenIslandsReady(timeout: 2)
  ) {
    self.init(
      webView: webView,
      registry: registry,
      reveal: reveal,
      schedule: Self.mainQueue,
      settle: Self.afterTwoFrames
    )
  }

  init(
    webView: WKWebView,
    registry: NativeComponentRegistry?,
    reveal: NativeIslandsReveal,
    schedule: @escaping NativeIslandsScheduler,
    settle: @escaping NativeIslandsSettle = { _, done in done() }
  ) {
    let registry = registry ?? .shared
    self.registry = registry
    self.webView = webView
    self.reveal = reveal
    self.schedule = schedule
    self.settle = settle
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

  public func alignment() async -> [NativeIslandAlignment] {
    guard let webView, let manager, !manager.islands.isEmpty else { return [] }
    return await withCheckedContinuation { continuation in
      NativeAlignmentProbe.measure(webView: webView, islands: manager) { alignments in
        continuation.resume(returning: alignments)
      }
    }
  }

  public var isOffering: Bool {
    manager != nil
  }

  /// Call when the web view moves to a window or to another view
  /// controller, so islands present from the controller that shows them.
  /// `IslandWebView` calls it itself.
  public func webViewDidMoveToWindow() {
    manager?.adoptIslands()
  }

  public func detach() {
    release()
    alignmentProbe?.stop()
    alignmentProbe = nil
    manager?.clear(notifyPage: false)
    router?.leave(self, webView: webView)
    router = nil
  }

  /// Call from `webViewWebContentProcessDidTerminate(_:)`.
  public func webContentProcessDidTerminate() {
    manager?.clear(notifyPage: false)
  }

  /// - Parameter webHit: What `super.hitTest(_:with:)` returns at `point`.
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
      showOnceSettled()
    }
  }

  private func holdDocument() {
    guard case .whenIslandsReady(let timeout) = reveal, let webView else { return }
    hold += 1
    let current = hold
    isReady = false
    if held == nil {
      // A cover above the page hides it without touching the web view: WebKit stops
      // running a page whose web view is transparent or masked on some iOS versions.
      let cover = NativeIslandsCover(frame: webView.bounds)
      webView.addSubview(cover)
      surface?.cover = cover
      held = (cover, webView.isUserInteractionEnabled)
      webView.isUserInteractionEnabled = false
    }
    schedule(timeout) { [weak self] in
      guard let self, self.hold == current else { return }
      self.show(.timedOut)
    }
  }

  // The page can be ready before WebKit has given it the safe area it lays
  // out in, and its first frame then sits too high. Once a script has run
  // two frames after the page's message, WebKit has laid the page out with
  // what it had sent before it.
  private func showOnceSettled() {
    guard !isReady, let webView else { return }
    let current = hold
    settle(webView) { [weak self] in
      guard let self, self.hold == current else { return }
      self.show(.ready)
    }
  }

  private func show(_ readiness: NativeIslandsReadiness) {
    guard !isReady else { return }
    release()
    onReady?(readiness)
  }

  private func release() {
    hold += 1
    isReady = true
    guard let held else { return }
    self.held = nil
    held.cover.removeFromSuperview()
    surface?.cover = nil
    webView?.isUserInteractionEnabled = held.interactive
  }

  static let afterTwoFrames: NativeIslandsSettle = { webView, done in
    webView.callAsyncJavaScript(
      "await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))",
      arguments: [:],
      in: nil,
      in: .defaultClient
    ) { _ in
      MainActor.assumeIsolated(done)
    }
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

  static func deliveryScript(_ replies: [NativeReply]) -> String? {
    guard let base64 = NativeReply.base64(replies) else { return nil }
    return "window.__nativeIslands && window.__nativeIslands.accept64(\"\(base64)\");"
  }

  static var documentStartScript: String {
    let handler = "window.webkit && window.webkit.messageHandlers.\(NativeHostMessage.handlerName)"
    return "\(handler) && \(handler).postMessage(\"\(documentStartMarker)\");"
  }
}

public enum NativeIslandsReveal: Equatable, Sendable {
  case immediately
  /// A page that doesn't use `@superwall/native-islands` shows only after `timeout`.
  case whenIslandsReady(timeout: TimeInterval)
}

public enum NativeIslandsReadiness: Equatable, Sendable {
  case ready
  case timedOut
}

typealias NativeIslandsScheduler = @MainActor (TimeInterval, @escaping @MainActor () -> Void) -> Void
typealias NativeIslandsSettle = @MainActor (WKWebView, @escaping @MainActor () -> Void) -> Void

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

  weak var cover: UIView?

  var screenLayer: UIView {
    webView?.bringSubviewToFront(layer)
    if let cover { webView?.bringSubviewToFront(cover) }
    return layer
  }

  var viewport: UIView {
    webView ?? layer
  }
}
