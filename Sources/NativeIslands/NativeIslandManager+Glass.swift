import UIKit

extension NativeIslandManager {
  /// Puts the island in its container, inside the container's glass group
  /// when it has one, and keeps every view there in page order.
  func attach(_ island: NativeIsland, to container: UIView) {
    island.container = container
    watchScrolling(of: container)
    let parent = island.glassGroup.map { group(named: $0, in: container).contentView } ?? container
    if island.view.superview !== parent {
      island.view.removeFromSuperview()
      parent.addSubview(island.view)
    }
    pruneGroups(in: container)
    arrange(parent)
  }

  func group(named name: String, in container: UIView) -> NativeGlassGroupView {
    let existing = container.subviews
      .compactMap { $0 as? NativeGlassGroupView }
      .first { $0.name == name }
    let group = existing ?? NativeGlassGroupView(name: name)
    if existing == nil {
      container.addSubview(group)
    }
    group.fit(to: container)
    return group
  }

  func pruneGroups(in container: UIView?) {
    guard let container else { return }
    for group in container.subviews.compactMap({ $0 as? NativeGlassGroupView })
    where group.contentView.subviews.isEmpty {
      group.removeFromSuperview()
    }
  }

  func arrange(_ parent: UIView) {
    let ordered = islands.values
      .filter { $0.view.superview === parent }
      .sorted { $0.order < $1.order }
    for island in ordered {
      parent.bringSubviewToFront(island.view)
    }
  }
}

// MARK: - Touches

extension NativeIslandManager {
  /// The view inside a visible island under `point`, topmost first.
  ///
  /// WebKit finds touch targets in its own views and skips views an app adds
  /// to its inner scroll views, so islands there would never be tapped. The
  /// web view asks this first instead.
  ///
  /// An island in an inner scroller lives inside WebKit's layer for it, so
  /// web content above that scroller, such as a footer, covers part of it.
  /// `webHit` is what WebKit itself would take the touch with: a scroller
  /// island only takes the touch when that is its scroller, so a tap on the
  /// covered part goes to whatever covers it.
  func hitTest(
    _ point: CGPoint,
    in view: UIView,
    with event: UIEvent?,
    webHit: () -> UIView? = { nil }
  ) -> UIView? {
    var web: UIView?
    var askedWeb = false
    let candidates = islands.values
      .filter { $0.context.isVisible && $0.view.window != nil && !$0.view.isHidden && $0.view.alpha > 0.01 }
      .sorted { lhs, rhs in
        if lhs.anchor.isScreen != rhs.anchor.isScreen {
          return lhs.anchor.isScreen
        }
        return lhs.order > rhs.order
      }
    for island in candidates {
      let local = view.convert(point, to: island.view)
      guard island.view.bounds.contains(local) else { continue }
      if case .scroller = island.anchor, let container = island.container {
        if !askedWeb {
          web = webHit()
          askedWeb = true
        }
        if let web, !web.isDescendant(of: container) {
          continue
        }
      }
      if let hit = island.view.hitTest(local, with: event) {
        Self.holdWebGestures(above: island.view, upTo: view)
        return hit
      }
    }
    return nil
  }
}

extension NativeIslandManager {
  /// Islands in an inner scroller live inside WebKit's content view, whose
  /// gesture recognizers would take a touch meant for the island and cancel
  /// it. For the touch that is starting, those recognizers are switched off,
  /// and back on as soon as the touch has begun. A scroll view's own pan and
  /// pinch stay on, so a drag that starts on an island still scrolls.
  static func holdWebGestures(above island: UIView, upTo root: UIView) {
    var held: [UIGestureRecognizer] = []
    var view = island.superview
    while let current = view, current !== root.superview {
      let scrollView = current as? UIScrollView
      for recognizer in current.gestureRecognizers ?? []
      where recognizer.isEnabled
        && recognizer !== scrollView?.panGestureRecognizer
        && recognizer !== scrollView?.pinchGestureRecognizer {
        recognizer.isEnabled = false
        held.append(recognizer)
      }
      view = current.superview
    }
    guard !held.isEmpty else { return }
    DispatchQueue.main.async {
      for recognizer in held {
        recognizer.isEnabled = true
      }
    }
  }
}

extension NativeAnchor {
  var isScreen: Bool {
    if case .screen = self { return true }
    return false
  }
}

extension NativeIslandManager {
  // MARK: - Status bar

  /// Follows every scroll view an island lives in, and the page, so islands
  /// that scroll under the status bar can be hidden as they reach it.
  func watchScrolling(of container: UIView) {
    var scrollViews: [UIScrollView] = []
    if let page = surface?.pageScrollView {
      scrollViews.append(page)
    }
    if let scrollView = container as? UIScrollView {
      scrollViews.append(scrollView)
    }
    for scrollView in scrollViews where scrollObservations[ObjectIdentifier(scrollView)] == nil {
      scrollObservations[ObjectIdentifier(scrollView)] = scrollView.observe(
        \.contentOffset,
        options: [.new]
      ) { [weak self] _, _ in
        MainActor.assumeIsolated { self?.updateObscured() }
      }
    }
  }

  /// Hides islands that scrolling carried under the viewport's top safe
  /// area. The system blurs web content there; a native view would stay sharp
  /// on top of the status bar. An island that sits in the top inset at rest,
  /// such as a full-screen page's close button, is meant to be there and
  /// stays. Islands on the screen layer are left alone.
  func updateObscured() {
    guard let viewport = surface?.viewport else { return }
    let top = viewport.safeAreaInsets.top
    for island in islands.values {
      let obscured: Bool
      if case .screen = island.anchor {
        obscured = false
      } else {
        let rect = island.view.convert(island.view.bounds, to: viewport)
        let scrolled = Self.scrolledDistance(from: island.view, to: viewport)
        let atRest = rect.minY + scrolled
        obscured = top > 0 &&
          scrolled > NativeScrollerMatcher.tolerance &&
          rect.minY < top - NativeScrollerMatcher.tolerance &&
          atRest >= top - NativeScrollerMatcher.tolerance
      }
      if island.obscure(obscured) {
        island.applyVisibility(animated: true)
      }
    }
  }

  /// How far every scroll view between `view` and `viewport` has scrolled
  /// down from its resting position, added up.
  static func scrolledDistance(from view: UIView, to viewport: UIView) -> CGFloat {
    var distance: CGFloat = 0
    var current = view.superview
    while let next = current, next !== viewport {
      if let scrollView = next as? UIScrollView {
        distance += scrollView.contentOffset.y + scrollView.adjustedContentInset.top
      }
      current = next.superview
    }
    return distance
  }
}
