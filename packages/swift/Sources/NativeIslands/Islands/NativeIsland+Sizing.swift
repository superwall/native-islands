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

  /// Measures the content at its ideal size, or for `nativeHeight` at the
  /// page's width, and returns it when it differs from the last report.
  func measure() -> NativeSize? {
    let fitsWidth = sizing == .nativeHeight
    // A box the page has not laid out yet has no width to wrap text in.
    if fitsWidth, frame.width <= 0 { return nil }
    var fitted = host.sizeThatFits(
      in: CGSize(
        width: fitsWidth ? CGFloat(frame.width) : CGFloat.greatestFiniteMagnitude,
        height: CGFloat.greatestFiniteMagnitude
      )
    )
    if fitsWidth {
      fitted.width = CGFloat(frame.width)
    }
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
