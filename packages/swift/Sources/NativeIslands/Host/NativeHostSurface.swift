import UIKit

@MainActor
protocol NativeHostSurface: AnyObject {
  var pageScrollView: UIScrollView { get }
  var screenLayer: UIView { get }
  var viewport: UIView { get }
}

final class NativePassthroughView: UIView {
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let hit = super.hitTest(point, with: event)
    return hit === self ? nil : hit
  }
}

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

  /// How far from the scroller's spot a scroll view may sit and still be its
  /// own when an island first mounts: half the scroller's size. A screen
  /// parked off to the side sits a whole screen away.
  static func reach(of scroller: NativeScroller) -> CGFloat {
    CGFloat(min(scroller.frame.width, scroller.frame.height)) / 2
  }

  /// The scroll view that matches the scroller, the nearest when several do.
  /// With `within`, only one that far from the scroller's spot counts.
  static func match(
    _ scroller: NativeScroller,
    among candidates: [UIScrollView],
    in viewport: UIView,
    within: CGFloat = .greatestFiniteMagnitude
  ) -> UIScrollView? {
    var best: UIScrollView?
    var bestDistance = CGFloat.greatestFiniteMagnitude
    for candidate in candidates where matches(candidate, scroller) {
      let origin = candidate.convert(candidate.bounds, to: viewport).origin
      let distance = hypot(origin.x - scroller.frame.x, origin.y - scroller.frame.y)
      if distance <= within, distance < bestDistance {
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
