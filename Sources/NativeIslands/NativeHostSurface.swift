import UIKit

/// Where islands go: the three coordinate spaces a page measures in.
@MainActor
protocol NativeHostSurface: AnyObject {
  /// The page's scroll view. `page` islands live in it, at document
  /// coordinates, and every inner scroller is one of its descendants.
  var pageScrollView: UIScrollView { get }
  /// A layer above the page, the size of the viewport. `screen` islands live
  /// in it, at viewport coordinates.
  var screenLayer: UIView { get }
  /// The view whose bounds are the page's viewport.
  var viewport: UIView { get }
}

/// A view that only takes touches its subviews take, so the page underneath
/// stays interactive everywhere there is no island.
final class NativePassthroughView: UIView {
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let hit = super.hitTest(point, with: event)
    return hit === self ? nil : hit
  }
}

/// Finds the native scroll view WebKit made for a page's inner scrolling
/// area, from what the page measured.
///
/// Size, content size and scroll offset decide the match, since those don't
/// move while a route slides in. Where several scroll views match, as when two
/// routes overlap during a push, the one closest to the measured position wins.
/// This mirrors `scrollerFor` in the reference simulator.
enum NativeScrollerMatcher {
  static let tolerance: CGFloat = 1

  static func candidates(in pageScrollView: UIScrollView) -> [UIScrollView] {
    var found: [UIScrollView] = []
    var queue: [UIView] = pageScrollView.subviews
    while !queue.isEmpty {
      let view = queue.removeFirst()
      if let scrollView = view as? UIScrollView {
        found.append(scrollView)
      }
      queue.append(contentsOf: view.subviews)
    }
    return found
  }

  static func match(
    _ scroller: NativeScroller,
    among candidates: [UIScrollView],
    in viewport: UIView
  ) -> UIScrollView? {
    var best: UIScrollView?
    var bestDistance = CGFloat.greatestFiniteMagnitude
    for candidate in candidates where matches(candidate, scroller) {
      let origin = candidate.convert(candidate.bounds, to: viewport).origin
      let distance = hypot(origin.x - scroller.frame.x, origin.y - scroller.frame.y)
      if distance < bestDistance {
        best = candidate
        bestDistance = distance
      }
    }
    return best
  }

  private static func matches(_ candidate: UIScrollView, _ scroller: NativeScroller) -> Bool {
    near(candidate.bounds.width, scroller.frame.width) &&
      near(candidate.bounds.height, scroller.frame.height) &&
      near(candidate.contentSize.width, scroller.contentSize.width) &&
      near(candidate.contentSize.height, scroller.contentSize.height) &&
      near(candidate.contentOffset.x, scroller.scrollOffset.x) &&
      near(candidate.contentOffset.y, scroller.scrollOffset.y)
  }

  private static func near(_ left: CGFloat, _ right: Double) -> Bool {
    abs(left - CGFloat(right)) <= tolerance
  }
}
