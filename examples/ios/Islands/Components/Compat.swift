import SwiftUI

/// The SwiftUI shims the showcase's own islands need on iOS 16; the glass
/// fallbacks come from `NativeIslandsComponents`.
extension View {
  /// Calls `action` with the new value whenever `value` changes, on iOS 16 too.
  @ViewBuilder
  func onChangeOf<Value: Equatable>(_ value: Value, perform action: @escaping (Value) -> Void) -> some View {
    if #available(iOS 17.0, *) {
      onChange(of: value) { _, next in action(next) }
    } else {
      onChange(of: value, perform: action)
    }
  }

  /// A symbol that swaps with the Replace effect on iOS 17 and cross-fades before.
  @ViewBuilder
  func symbolReplaceTransition() -> some View {
    if #available(iOS 17.0, *) {
      contentTransition(.symbolEffect(.replace))
    } else {
      self
    }
  }
}

extension Animation {
  /// `.smooth(duration:)` on iOS 17; the matching ease before.
  static func smoothly(duration: TimeInterval = 0.5) -> Animation {
    if #available(iOS 17.0, *) {
      return .smooth(duration: duration)
    }
    return .easeInOut(duration: duration)
  }
}
