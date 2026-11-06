import NativeIslands
import UIKit
import WebKit

/// The page a presentation shows: another page in its own `IslandWebView`,
/// with its own `NativeIslandsHost`, sharing the presenting web view's
/// configuration so it loads the same schemes and sees the same components.
/// It fades in once its islands are drawn.
@MainActor
final class PresentedPageController: UIViewController, WKNavigationDelegate {
  let webView: IslandWebView
  private(set) var url: URL
  private let style: String
  var onMessage: (@MainActor (Any?) -> Void)?
  var onDismissRequest: (@MainActor (Any?) -> Void)?

  init(url: URL, configuration: WKWebViewConfiguration, style: String) {
    self.url = url
    self.style = style
    webView = IslandWebView(configuration: configuration)
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError("PresentedPageController is created in code.") }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground
    webView.frame = view.bounds
    webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    webView.isOpaque = false
    webView.backgroundColor = .clear
    webView.scrollView.backgroundColor = .clear
    webView.alpha = 0
    webView.navigationDelegate = self
    #if DEBUG
    if #available(iOS 16.4, *) {
      webView.isInspectable = true
    }
    #endif
    view.addSubview(webView)
    webView.islands?.onReady = { [weak self] _ in self?.reveal() }
    PresentationMessages.of(webView.configuration.userContentController).add(self)
    webView.load(URLRequest(url: url))
  }

  func load(_ next: URL) {
    guard next != url else { return }
    url = next
    webView.alpha = 0
    webView.load(URLRequest(url: next))
  }

  /// Hands `data` to the presented page as a `nativeislandspresentation` event.
  func post(_ data: Any?) {
    guard let json = Self.json(["type": "message", "data": data ?? NSNull()]) else { return }
    webView.evaluateJavaScript(
      "window.dispatchEvent(new CustomEvent('nativeislandspresentation', { detail: \(json) }))"
    )
  }

  func receive(_ body: Any) {
    guard let body = body as? [String: Any] else { return }
    switch body["type"] as? String {
    case "dismiss": onDismissRequest?(body["result"])
    case "message": onMessage?(body["data"])
    default: break
    }
  }

  func close() {
    webView.islands?.detach()
    PresentationMessages.of(webView.configuration.userContentController).remove(self)
  }

  private func reveal() {
    guard webView.alpha < 1 else { return }
    UIView.animate(withDuration: 0.2) { self.webView.alpha = 1 }
  }

  func webView(_ webView: WKWebView, didCommit navigation: WKNavigation?) {
    let info = Self.json(["style": style]) ?? "{}"
    webView.evaluateJavaScript(
      "window.__NATIVE_ISLANDS_PRESENTED__ = \(info); window.dispatchEvent(new Event('nativeislandspresented'))"
    )
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation?) {
    // A page without the library never says it is ready.
    if self.webView.islands?.isOffering != true { reveal() }
    DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak self] in self?.reveal() }
  }

  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    self.webView.islands?.webContentProcessDidTerminate()
    webView.reload()
  }

  static func json(_ value: Any) -> String? {
    guard JSONSerialization.isValidJSONObject(value),
      let data = try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed])
    else { return nil }
    return String(data: data, encoding: .utf8)
  }
}

/// Routes `nativeIslandsPresentation` messages from presented pages to their
/// controller. Presented web views share the presenting configuration, so one
/// handler serves every web view of a content controller.
@MainActor
final class PresentationMessages: NSObject, WKScriptMessageHandler {
  static let name = "nativeIslandsPresentation"
  private static var key: UInt8 = 0
  private struct Entry { weak var controller: PresentedPageController? }
  private var entries: [ObjectIdentifier: Entry] = [:]

  static func of(_ controller: WKUserContentController) -> PresentationMessages {
    if let existing = objc_getAssociatedObject(controller, &key) as? PresentationMessages { return existing }
    let messages = PresentationMessages()
    controller.add(messages, name: name)
    objc_setAssociatedObject(controller, &key, messages, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
    return messages
  }

  func add(_ controller: PresentedPageController) {
    entries[ObjectIdentifier(controller.webView)] = Entry(controller: controller)
  }

  func remove(_ controller: PresentedPageController) {
    entries[ObjectIdentifier(controller.webView)] = nil
  }

  nonisolated func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    MainActor.assumeIsolated {
      guard let webView = message.webView else { return }
      entries[ObjectIdentifier(webView)]?.controller?.receive(message.body)
    }
  }
}

extension UIView {
  /// The web view this view sits in, found by walking up its superviews.
  var enclosingWebView: WKWebView? {
    var view = superview
    while let current = view {
      if let webView = current as? WKWebView { return webView }
      view = current.superview
    }
    return nil
  }

  /// The controller to present from: the frontmost one of this view's window.
  var frontController: UIViewController? {
    var front = window?.rootViewController
    while let presented = front?.presentedViewController, !presented.isBeingDismissed {
      front = presented
    }
    return front ?? Presenter.front()
  }
}

/// A view that takes no touches and stands in for an element of the page, to
/// anchor a presentation.
final class AnchorView: UIView {
  override init(frame: CGRect) {
    super.init(frame: frame)
    isUserInteractionEnabled = false
    backgroundColor = .clear
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
}
