import SwiftUI

/// What the components draw before iOS 26, the way Apple's own
/// controls fall back: glass becomes the system material in the same shape,
/// glass button styles become bordered ones, and effects iOS 16 lacks are left
/// out rather than imitated.
public extension View {
  /// Liquid Glass in `shape` on iOS 26; before, the regular material, tinted
  /// when asked, with the hairline edge UIKit's floating bars have.
  @ViewBuilder
  func glassOrMaterial(
    in shape: some Shape,
    tint: Color? = nil,
    interactive: Bool = true
  ) -> some View {
    if #available(iOS 26.0, *) {
      glassEffect(
        interactive ? Glass.regular.tint(tint).interactive() : Glass.regular.tint(tint),
        in: shape
      )
    } else {
      background {
        shape.fill(.regularMaterial)
        if let tint {
          shape.fill(tint)
        }
        shape.stroke(Color(uiColor: .separator), lineWidth: 1 / UIScreen.main.scale)
      }
      .contentShape(shape)
    }
  }

  /// `.glass` on iOS 26; `.bordered` before.
  @ViewBuilder
  func glassButtonStyle() -> some View {
    if #available(iOS 26.0, *) {
      buttonStyle(.glass)
    } else {
      buttonStyle(.bordered)
    }
  }

  /// `.glassProminent` on iOS 26; `.borderedProminent` before.
  @ViewBuilder
  func glassProminentButtonStyle() -> some View {
    if #available(iOS 26.0, *) {
      buttonStyle(.glassProminent)
    } else {
      buttonStyle(.borderedProminent)
    }
  }
}

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

/// Merges the glass of its content on iOS 26; lays it out unchanged before,
/// where each piece draws its own material.
public struct GlassGroup<Content: View>: View {
  var spacing: CGFloat
  var content: Content

  public init(spacing: CGFloat, @ViewBuilder content: () -> Content) {
    self.spacing = spacing
    self.content = content()
  }

  public var body: some View {
    if #available(iOS 26.0, *) {
      GlassEffectContainer(spacing: spacing) { content }
    } else {
      content
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
