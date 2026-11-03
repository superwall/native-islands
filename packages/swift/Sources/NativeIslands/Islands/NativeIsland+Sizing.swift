import UIKit

extension NativeIsland {
  /// Calls `changed` whenever the SwiftUI content's ideal size changes, so a
  /// natively sized island that grows or shrinks on its own (its state, an
  /// async load) is measured again.
  func watchSize(_ changed: @escaping @MainActor () -> Void) {
    guard #available(iOS 16, *) else { return }
    host.sizingOptions = .preferredContentSize
    sizeObservation = host.observe(\.preferredContentSize) { _, _ in
      MainActor.assumeIsolated { changed() }
    }
  }

  func measure() -> NativeSize? {
    let fitted = host.sizeThatFits(
      in: CGSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
    )
    guard
      fitted.width.isFinite,
      fitted.height.isFinite,
      fitted.width >= 0,
      fitted.height >= 0,
      fitted != reportedSize
    else {
      return nil
    }
    reportedSize = fitted
    return NativeSize(width: Double(fitted.width), height: Double(fitted.height))
  }
}
