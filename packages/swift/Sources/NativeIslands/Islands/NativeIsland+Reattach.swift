import UIKit

extension NativeIsland {
  /// Before iOS 18, SwiftUI hit-tests its content where the hosting view sat
  /// when it last entered the window. WebKit slides a page in by animating a
  /// layer far above the island, so its controls would take no taps there;
  /// attaching the hosting view again makes SwiftUI place it anew. Scrolling
  /// is not such a move, and a host holding the first responder is left alone,
  /// since leaving the window would end its editing; the move stays pending
  /// until the next touch after it lets go. Returns whether it did.
  @discardableResult
  func reattachHostIfMoved() -> Bool {
    if #available(iOS 18.0, *) { return false }
    guard host.view.window != nil, let parent = host.view.superview,
          let index = parent.subviews.firstIndex(of: host.view) else { return false }
    let origin = Self.unscrolledOrigin(of: host.view)
    guard origin != attachedOrigin, !Self.holdsFirstResponder(host.view) else { return false }
    attachedOrigin = origin
    host.view.removeFromSuperview()
    parent.insertSubview(host.view, at: index)
    return true
  }

  /// The view's origin in its window as if no scroll view above it were
  /// scrolled: SwiftUI follows scrolling, so only other moves count.
  static func unscrolledOrigin(of view: UIView) -> CGPoint {
    var origin = view.convert(CGPoint.zero, to: nil)
    var ancestor = view.superview
    while let current = ancestor {
      if let scrollView = current as? UIScrollView {
        origin.x += scrollView.contentOffset.x
        origin.y += scrollView.contentOffset.y
      }
      ancestor = current.superview
    }
    return origin
  }

  static func holdsFirstResponder(_ view: UIView) -> Bool {
    view.isFirstResponder || view.subviews.contains { holdsFirstResponder($0) }
  }
}
