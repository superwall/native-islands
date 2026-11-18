import NativeIslands
import UIKit
import WebKit

/// Shows the test pages edge to edge. The web view stays hidden until the
/// page's islands are drawn, so the view controller's background matches the
/// page's.
final class PagesViewController: UIViewController, WKNavigationDelegate {
  private let url: URL
  private var webView: IslandWebView?
  private var report: TestReport?

  init(url: URL) {
    self.url = url
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("PagesViewController is created in code.")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor { traits in
      traits.userInterfaceStyle == .dark
        ? UIColor(red: 0x1C / 255, green: 0x1B / 255, blue: 0x19 / 255, alpha: 1)
        : UIColor(red: 0xFD / 255, green: 0xFE / 255, blue: 0xF6 / 255, alpha: 1)
    }
    let configuration = WKWebViewConfiguration()
    configuration.setURLSchemeHandler(BundledPagesHandler(), forURLScheme: PagesLocation.scheme)
    if TestReport.isRequested("UITestReport") {
      configuration.userContentController.addUserScript(TestReport.consoleScript)
    }
    let webView = IslandWebView(frame: view.bounds, configuration: configuration)
    webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    webView.isOpaque = false
    webView.backgroundColor = .clear
    webView.scrollView.contentInsetAdjustmentBehavior = .never
    webView.scrollView.bounces = false
    webView.navigationDelegate = self
    webView.accessibilityIdentifier = "pages"
    #if DEBUG
    if #available(iOS 16.4, *) {
      webView.isInspectable = true
    }
    #endif
    view.addSubview(webView)
    self.webView = webView
    if TestReport.isRequested("UITestReport") {
      report = TestReport(in: view, webView: webView, measuresPerformance: TestReport.isRequested("perf"))
    }
    webView.load(URLRequest(url: url))
    if UserDefaults.standard.bool(forKey: "slideIn") {
      slideIn(webView)
    }
  }

  /// `-slideIn YES` starts the web view lower and slides it up while the page
  /// loads, as a paywall presented over an app does.
  private func slideIn(_ webView: UIView) {
    let resting = view.bounds
    webView.frame = resting.offsetBy(dx: 0, dy: resting.height / 3)
    UIView.animate(withDuration: 0.6, delay: 0.2, options: [.curveEaseOut]) {
      webView.frame = resting
    }
  }

  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    self.webView?.islands?.webContentProcessDidTerminate()
    webView.reload()
  }
}
