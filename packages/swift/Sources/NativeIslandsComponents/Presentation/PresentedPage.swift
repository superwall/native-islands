import NativeIslands
import UIKit
import WebKit

/// The page a presentation shows: another page in its own `IslandWebView`,
/// with its own `NativeIslandsHost`, sharing the presenting web view's
/// configuration so it loads the same schemes and sees the same components.
/// The presentation's background shows while the page loads, and the page
/// fades in once its islands are drawn.
@MainActor
final class PresentedPageController: UIViewController, WKNavigationDelegate {
  let webView: IslandWebView
  private(set) var url: URL
  let style: String
  /// Whether the page waits behind the app, loaded ahead of time.
  private var waiting = false
  /// Whether the person has scrolled the page; until then it rests at its top.
  private var scrolled = false
  private let background: UIColor?
  var onMessage: (@MainActor (Any?) -> Void)?
  var onDismissRequest: (@MainActor (Any?) -> Void)?
  var onDetentRequest: (@MainActor (String) -> Void)?
  var onDone: (@MainActor () -> Void)?

  /// The detent the sheet rests at; the page hears each change.
  var detent: String? {
    didSet {
      guard detent != oldValue, let detent else { return }
      dispatch(["type": "detent", "detent": detent])
    }
  }

  /// The height of the sheet's tallest detent, once UIKit resolved it. The
  /// web view keeps that height while the sheet moves between detents: a
  /// web view that changes height lays its page out again on every frame of
  /// the drag and moves its scroll position, so the page would jump and the
  /// sheet would lose track of whether it is at the top.
  var tallestDetent: CGFloat? {
    didSet {
      guard tallestDetent != oldValue, isViewLoaded else { return }
      view.setNeedsLayout()
    }
  }

  var showsDone = true {
    didSet { updateDone() }
  }

  init(url: URL, configuration: WKWebViewConfiguration, style: String, background: UIColor?) {
    self.url = url
    self.style = style
    self.background = background
    webView = IslandWebView(configuration: configuration)
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError("PresentedPageController is created in code.") }

  override func viewDidLoad() {
    super.viewDidLoad()
    // Behind the navigation bar, as in any native sheet: the web view's own
    // scroll view is the sheet's content, so a drag scrolls the page until it
    // reaches the top and only then moves the sheet, and the bar's edge
    // effect follows the page under it.
    view.backgroundColor = background ?? .systemGroupedBackground
    webView.frame = view.bounds
    webView.isOpaque = false
    webView.backgroundColor = .clear
    webView.scrollView.backgroundColor = .clear
    webView.scrollView.contentInsetAdjustmentBehavior = .automatic
    webView.scrollView.alwaysBounceVertical = true
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
    webView.scrollView.panGestureRecognizer.addTarget(self, action: #selector(panned))
    updateDone()
    navigationItem.largeTitleDisplayMode = .never
    setContentScrollView(webView.scrollView)
    webView.load(URLRequest(url: url))
  }

  private func configureBar() {
    guard let bar = navigationController?.navigationBar else { return }
    bar.prefersLargeTitles = false
    // One appearance for the bar: no separate band where the page meets it.
    let appearance = UINavigationBarAppearance()
    appearance.configureWithTransparentBackground()
    if #unavailable(iOS 26.0) {
      // Before Liquid Glass a bar over scrolled content needs its material.
      let scrolled = UINavigationBarAppearance()
      scrolled.configureWithDefaultBackground()
      bar.standardAppearance = scrolled
      bar.compactAppearance = scrolled
    } else {
      bar.standardAppearance = appearance
      bar.compactAppearance = appearance
    }
    bar.scrollEdgeAppearance = appearance
    bar.compactScrollEdgeAppearance = appearance
  }

  /// Loads the page ahead of time, behind everything else in `window`: a
  /// web view outside a window draws no islands and never says it is ready,
  /// so the page waits there, out of sight and out of reach, fully drawn.
  /// Presenting it moves its view into the presentation.
  func preload(in window: UIWindow?, size: CGSize) {
    loadViewIfNeeded()
    view.frame = CGRect(origin: .zero, size: size)
    view.isUserInteractionEnabled = false
    view.accessibilityElementsHidden = true
    waiting = true
    window?.insertSubview(view, at: 0)
    view.layoutIfNeeded()
  }

  override func willMove(toParent parent: UIViewController?) {
    super.willMove(toParent: parent)
    guard parent != nil else { return }
    view.isUserInteractionEnabled = true
    view.accessibilityElementsHidden = false
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    // Waiting behind the app also brings the view into a window; only a
    // presentation shows the page.
    guard parent != nil || presentingViewController != nil else { return }
    waiting = false
    view.isHidden = false
    view.isUserInteractionEnabled = true
    view.accessibilityElementsHidden = false
    configureBar()
  }

  @objc private func panned() {
    scrolled = true
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    let height = webViewHeight
    webView.frame = CGRect(origin: .zero, size: CGSize(width: view.bounds.width, height: height))
    // What lies below the screen at a smaller detent is still in reach: it
    // scrolls up like content under a toolbar. Only the inset follows the
    // drag, which moves no content while the page rests at its top.
    let hidden = max(0, height - view.bounds.height).rounded()
    if abs(webView.scrollView.contentInset.bottom - hidden) >= 0.5 {
      webView.scrollView.contentInset.bottom = hidden
      webView.scrollView.verticalScrollIndicatorInsets.bottom = hidden
    }
    restAtTop()
  }

  /// The sheet's height at its tallest detent: the detent plus the home
  /// indicator's strip below it. At a smaller detent the rest of the web view
  /// lies below the screen.
  private var webViewHeight: CGFloat {
    guard !waiting, let tallestDetent, let window = view.window else { return view.bounds.height }
    return tallestDetent + window.safeAreaInsets.bottom
  }

  /// The bar's inset arrives after the page first lays out (and after a
  /// preloaded page loaded with none); until the person scrolls, the page
  /// starts at its top, below the bar, not under it.
  private func restAtTop() {
    guard !scrolled else { return }
    let scroll = webView.scrollView
    let top = CGPoint(x: 0, y: -scroll.adjustedContentInset.top)
    if scroll.contentOffset != top { scroll.setContentOffset(top, animated: false) }
  }

  private func updateDone() {
    navigationItem.rightBarButtonItem = showsDone
      ? UIBarButtonItem(systemItem: .done, primaryAction: UIAction { [weak self] _ in self?.onDone?() })
      : nil
  }

  func load(_ next: URL) {
    guard next != url else { return }
    url = next
    webView.alpha = 0
    webView.load(URLRequest(url: next))
  }

  /// Hands `data` to the presented page as a `nativeislandspresentation` event.
  func post(_ data: Any?) {
    dispatch(["type": "message", "data": data ?? NSNull()])
  }

  private func dispatch(_ detail: [String: Any]) {
    guard let json = Self.json(detail) else { return }
    webView.evaluateJavaScript(
      "window.dispatchEvent(new CustomEvent('nativeislandspresentation', { detail: \(json) }))"
    )
  }

  func receive(_ body: Any) {
    guard let body = body as? [String: Any] else { return }
    switch body["type"] as? String {
    case "dismiss": onDismissRequest?(body["result"])
    case "message": onMessage?(body["data"])
    case "detent": (body["detent"] as? String).map { onDetentRequest?($0) }
    default: break
    }
  }

  func close() {
    if parent == nil, presentingViewController == nil { view.removeFromSuperview() }
    webView.islands?.detach()
    PresentationMessages.of(webView.configuration.userContentController).remove(self)
  }

  private func reveal() {
    // Drawn while it waited: hide it, so a page nobody opened costs the app
    // nothing while it waits. Its islands stay as they are.
    if waiting, presentingViewController == nil { view.isHidden = true }
    guard webView.alpha < 1 else { return }
    restAtTop()
    UIView.animate(withDuration: 0.15) { self.webView.alpha = 1 }
  }

  func webView(_ webView: WKWebView, didCommit navigation: WKNavigation?) {
    var info: [String: Any] = ["style": style]
    if let detent { info["detent"] = detent }
    let json = Self.json(info) ?? "{}"
    webView.evaluateJavaScript(
      "window.__NATIVE_ISLANDS_PRESENTED__ = \(json); window.dispatchEvent(new Event('nativeislandspresented'))"
    )
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation?) {
    // A page without the library never says it is ready.
    if self.webView.islands?.isOffering != true { reveal() }
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in self?.reveal() }
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
