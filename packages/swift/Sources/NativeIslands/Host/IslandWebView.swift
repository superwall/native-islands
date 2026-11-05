import UIKit
import WebKit

@MainActor
open class IslandWebView: WKWebView {
  public private(set) var islands: NativeIslandsHost?

  public init(
    frame: CGRect = .zero,
    configuration: WKWebViewConfiguration? = nil,
    registry: NativeComponentRegistry? = nil,
    reveal: NativeIslandsReveal = .whenIslandsReady(timeout: 2)
  ) {
    super.init(frame: frame, configuration: configuration ?? WKWebViewConfiguration())
    islands = NativeIslandsHost(webView: self, registry: registry, reveal: reveal)
  }

  @available(*, unavailable)
  public required init?(coder: NSCoder) {
    fatalError("IslandWebView is created in code.")
  }

  override open func didMoveToWindow() {
    super.didMoveToWindow()
    islands?.webViewDidMoveToWindow()
  }

  override open func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    if let island = islands?.hitTest(point, with: event, webHit: { super.hitTest(point, with: event) }) {
      return island
    }
    return super.hitTest(point, with: event)
  }
}
