import UIKit

extension NativeIslandManager {
  func attach(_ island: NativeIsland, to container: UIView) {
    island.container = container
    watchScrolling(of: container)
    adopt(island)
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
      island.raiseShades()
    }
  }
}

// MARK: - Touches

extension NativeIslandManager {
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
      ) { [weak self] scrolled, _ in
        MainActor.assumeIsolated {
          self?.followSticky(in: scrolled)
          self?.updateObscured(in: scrolled)
        }
      }
    }
  }

  func followSticky(in scrollView: UIScrollView) {
    for island in islands.values where island.sticky != nil {
      if island.view.superview?.enclosingScrollView === scrollView {
        island.layOut()
      }
    }
  }

  func updateObscured(in scrollView: UIScrollView? = nil) {
    guard let viewport = surface?.viewport else { return }
    let top = viewport.safeAreaInsets.top
    for island in islands.values {
      if let scrollView, !island.view.isDescendant(of: scrollView) { continue }
      var cut: CGFloat = 0
      if case .screen = island.anchor {
        cut = 0
      } else if top > 0 {
        let rect = island.view.convert(island.view.bounds, to: viewport)
        let scrolled = Self.scrolledDistance(from: island.view, to: viewport)
        let atRest = rect.minY + scrolled
        if scrolled > NativeScrollerMatcher.tolerance,
           atRest >= top - NativeScrollerMatcher.tolerance,
           rect.minY < top - NativeScrollerMatcher.tolerance {
          cut = top - rect.minY
        }
      }
      _ = island.cutTop(cut)
    }
  }

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
