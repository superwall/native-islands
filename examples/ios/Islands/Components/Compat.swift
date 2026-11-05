import SwiftUI

/// The SwiftUI shim the showcase's own islands need on iOS 16; the rest come
/// from `NativeIslandsComponents`.
extension Animation {
  /// `.smooth(duration:)` on iOS 17; the matching ease before.
  static func smoothly(duration: TimeInterval = 0.5) -> Animation {
    if #available(iOS 17.0, *) {
      return .smooth(duration: duration)
    }
    return .easeInOut(duration: duration)
  }
}
