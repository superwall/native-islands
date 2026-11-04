import UIKit

// MARK: - Following a scroller to its scroll view

extension NativeIslandManager {
  // WebKit can give a scroller a new scroll view without the page noticing,
  // such as a screen parked off to the side that slides in: the old one stays
  // at the parked spot. Once the island's scroll view has left the viewport
  // and another one matches the scroller, the island follows it. One still on
  // screen is kept while its size and content size still match: while it
  // scrolls, the page's anchor lags its offset and a parked twin could match
  // better. Two screens stacked in one spot can have the same scroll view
  // geometry when an island mounts, and it can land in the wrong one; once
  // their content sizes differ, it moves to its own.
  // The page measures before WebKit gives the scroll view its new content
  // size, so an island found in the wrong one looks again a few times.
  func reanchor(_ island: NativeIsland, to anchor: NativeAnchor, attempt: Int = 0) {
    guard case .scroller(let scroller) = anchor, let surface else { return }
    let misplaced = !hasShape(island.container, of: scroller)
    guard misplaced || !isOnScreen(island.container, in: surface.viewport) else { return }
    guard let container = container(for: anchor, in: surface) else {
      if misplaced, attempt < Self.parkingAttempts {
        retry { [weak self, weak island] in
          guard let self, let island, self.islands.values.contains(where: { $0 === island }) else { return }
          self.reanchor(island, to: island.anchor, attempt: attempt + 1)
        }
      }
      return
    }
    guard container !== island.container else { return }
    let previous = island.container
    attach(island, to: container)
    pruneGroups(in: previous)
  }

  // A scroll view's content can grow while the scroller an island in it
  // belongs to keeps its size, so the page sends nothing: look again at the
  // islands in it once the page had its turn to update their anchors.
  // WebKit rebuilds scroll views as screens slide, and a new one can reuse a
  // freed one's address, so a watch counts only while its view is alive.
  func watchContentSize(of scrollView: UIScrollView) {
    let key = ObjectIdentifier(scrollView)
    guard contentSizeObservations[key]?.scrollView !== scrollView else { return }
    contentSizeObservations = contentSizeObservations.filter { $0.value.scrollView != nil }
    let observation = scrollView.observe(
      \.contentSize,
      options: [.old, .new]
    ) { [weak self] resized, change in
      guard change.oldValue != change.newValue else { return }
      MainActor.assumeIsolated {
        self?.retry { [weak self, weak resized] in
          guard let self, let resized else { return }
          for island in self.islands.values where island.container === resized {
            self.reanchor(island, to: island.anchor)
          }
        }
      }
    }
    contentSizeObservations[key] = ContentSizeObservation(scrollView: scrollView, observation: observation)
  }

  private func hasShape(_ container: UIView?, of scroller: NativeScroller) -> Bool {
    guard let scrollView = container as? UIScrollView else { return false }
    let tolerance = NativeScrollerMatcher.tolerance
    return abs(scrollView.bounds.width - scroller.frame.width) <= tolerance &&
      abs(scrollView.bounds.height - scroller.frame.height) <= tolerance &&
      abs(scrollView.contentSize.width - scroller.contentSize.width) <= tolerance &&
      abs(scrollView.contentSize.height - scroller.contentSize.height) <= tolerance
  }

  private func isOnScreen(_ container: UIView?, in viewport: UIView) -> Bool {
    guard let container, container.isDescendant(of: viewport) else { return false }
    return container.convert(container.bounds, to: viewport).intersects(viewport.bounds)
  }
}

struct ContentSizeObservation {
  weak var scrollView: UIScrollView?
  let observation: NSKeyValueObservation
}

// MARK: - Anchors

extension NativeIslandManager {
  func needsMove(_ island: NativeIsland, to anchor: NativeAnchor) -> Bool {
    switch (island.anchor, anchor) {
    case (.page, .page), (.screen, .screen):
      return false
    case let (.scroller(current), .scroller(next)):
      return current.id != next.id
    default:
      return true
    }
  }

  func container(for anchor: NativeAnchor, in surface: NativeHostSurface) -> UIView? {
    switch anchor {
    case .page:
      return surface.pageScrollView
    case .screen:
      return surface.screenLayer
    case .scroller(let scroller):
      return NativeScrollerMatcher.match(
        scroller,
        among: NativeScrollerMatcher.candidates(in: surface.pageScrollView),
        in: surface.viewport
      ) { self.holdsIslands(of: $0, otherThan: scroller.id) }
    }
  }

  func holdsIslands(of scrollView: UIView, otherThan scrollerID: String) -> Bool {
    islands.values.contains { island in
      guard island.container === scrollView, case .scroller(let other) = island.anchor else { return false }
      return other.id != scrollerID
    }
  }
}
