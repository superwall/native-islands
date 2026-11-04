import NativeIslands
import UIKit
import WebKit

/// Shows the showcase edge to edge. The page draws its own bars and scrolls in
/// its own scrolling areas, so the web view itself never scrolls.
final class ShowcaseViewController: UIViewController, WKNavigationDelegate {
  private let url: URL
  private var webView: IslandWebView?

  init(url: URL) {
    self.url = url
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("ShowcaseViewController is created in code.")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground
    let configuration = WKWebViewConfiguration()
    configuration.setURLSchemeHandler(BundledPagesHandler(), forURLScheme: ShowcaseLocation.scheme)
    configuration.allowsInlineMediaPlayback = true
    configuration.mediaTypesRequiringUserActionForPlayback = []
    let bridge = AppBridge { [weak self] message in self?.receive(message) }
    configuration.userContentController.add(bridge, name: AppBridge.name)
    let webView = IslandWebView(frame: view.bounds, configuration: configuration)
    webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    webView.isOpaque = false
    webView.backgroundColor = .clear
    webView.scrollView.contentInsetAdjustmentBehavior = .never
    webView.scrollView.bounces = false
    webView.scrollView.isScrollEnabled = false
    webView.navigationDelegate = self
    webView.accessibilityIdentifier = "showcase"
    #if DEBUG
    if #available(iOS 16.4, *) {
      webView.isInspectable = true
    }
    #endif
    view.addSubview(webView)
    self.webView = webView
    webView.load(URLRequest(url: url))
  }

  private func receive(_ message: AppBridge.Message) {
    switch message {
    case let .appearance(style):
      view.window?.overrideUserInterfaceStyle = style
    case let .outlines(shown):
      IslandOutlines.shared.isShown = shown
    }
  }

  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    self.webView?.islands?.webContentProcessDidTerminate()
    webView.reload()
  }
}
