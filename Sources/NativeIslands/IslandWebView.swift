import UIKit
import WebKit

/// A `WKWebView` with a ``NativeIslandsHost`` attached, which routes touches
/// on islands to the islands.
///
/// WebKit never hands touches to views inside its own scroll views, so an
/// island in an inner scrolling area could not be tapped in a plain web view.
/// This one asks the host first and gives WebKit everything else.
@MainActor
open class IslandWebView: WKWebView {
  /// The host drawing this web view's islands.
  public private(set) var islands: NativeIslandsHost?

  /// Creates a web view offering what `registry` holds to its pages, or
  /// ``NativeComponentRegistry/shared`` when it is `nil`.
  public init(
    frame: CGRect = .zero,
    configuration: WKWebViewConfiguration = WKWebViewConfiguration(),
    registry: NativeComponentRegistry? = nil
  ) {
    super.init(frame: frame, configuration: configuration)
    islands = NativeIslandsHost(webView: self, registry: registry)
  }

  @available(*, unavailable)
  public required init?(coder: NSCoder) {
    fatalError("IslandWebView is created in code.")
  }

  override open func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    if let island = islands?.hitTest(point, with: event, webHit: { super.hitTest(point, with: event) }) {
      return island
    }
    return super.hitTest(point, with: event)
  }
}
