import UIKit

/// The app lifecycle notifications a manager watches, removed when the
/// manager goes away.
final class NativeLifecycleObservers {
  private let center: NotificationCenter
  private var tokens: [NSObjectProtocol] = []

  init(center: NotificationCenter) {
    self.center = center
  }

  func observe(_ name: Notification.Name, _ handler: @escaping @MainActor () -> Void) {
    tokens.append(
      center.addObserver(forName: name, object: nil, queue: .main) { _ in
        MainActor.assumeIsolated { handler() }
      }
    )
  }

  deinit {
    tokens.forEach(center.removeObserver)
  }
}

extension NativeIslandManager {
  func watchLifecycle() {
    lifecycle.observe(UIApplication.didEnterBackgroundNotification) { [weak self] in
      self?.wentToBackground = true
    }
    lifecycle.observe(UIApplication.didBecomeActiveNotification) { [weak self] in
      guard let self, wentToBackground else { return }
      wentToBackground = false
      reseatGlass()
    }
  }

  /// In the background WebKit takes its view tree, islands and all, out of
  /// the window, and puts it back while the app is still inactive. Glass
  /// that joins the window then keeps its press highlight but loses its
  /// interactive scale, and a fresh effect does not bring it back, so each
  /// glass island is taken out and put back in place once the app is active.
  func reseatGlass() {
    var parents: [UIView] = []
    UIView.performWithoutAnimation {
      for island in islands.values {
        guard let glass = island.glassView,
          island.sliding.motion == nil,
          glass.window != nil,
          let parent = glass.superview,
          let index = parent.subviews.firstIndex(of: glass)
        else { continue }
        glass.removeFromSuperview()
        parent.insertSubview(glass, at: index)
        if !parents.contains(where: { $0 === parent }) {
          parents.append(parent)
        }
      }
    }
    parents.forEach(arrange)
  }
}
