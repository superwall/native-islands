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
      self?.reseatedGlass = []
    }
    // WebKit puts its tree back just before the app enters the foreground,
    // which is as early as the glass can be put back: on unlock that is
    // about a second before the app becomes active.
    lifecycle.observe(UIApplication.willEnterForegroundNotification) { [weak self] in
      guard let self, reseatedGlass != nil else { return }
      schedule { [weak self] in self?.reseatGlass() }
    }
    // Catches glass the first pass missed: back in the window later, or
    // sliding then.
    lifecycle.observe(UIApplication.didBecomeActiveNotification) { [weak self] in
      guard let self, reseatedGlass != nil else { return }
      reseatGlass()
      reseatedGlass = nil
    }
  }

  /// In the background WebKit takes its view tree, islands and all, out of
  /// the window, and puts it back while the app is still in the background.
  /// Glass that joins the window then keeps its press highlight but loses
  /// its interactive scale, and a fresh effect does not bring it back, so
  /// each glass island is taken out and put back in place once the app is
  /// on its way back, and only once per trip, as taking a view out cancels
  /// a touch on it.
  func reseatGlass() {
    guard var reseated = reseatedGlass else { return }
    var parents: [UIView] = []
    UIView.performWithoutAnimation {
      for island in islands.values {
        guard let glass = island.glassView,
          !reseated.contains(ObjectIdentifier(glass)),
          island.sliding.motion == nil,
          glass.window != nil,
          let parent = glass.superview,
          let index = parent.subviews.firstIndex(of: glass)
        else { continue }
        glass.removeFromSuperview()
        parent.insertSubview(glass, at: index)
        reseated.insert(ObjectIdentifier(glass))
        if !parents.contains(where: { $0 === parent }) {
          parents.append(parent)
        }
      }
    }
    reseatedGlass = reseated
    parents.forEach(arrange)
  }
}
