import SwiftUI

/// How VoiceOver reaches what a component draws.
public enum NativeAccessibilityChildren: Sendable {
  /// One element: the page's label, hint, value and traits describe the whole
  /// island. For a single control whose view hides its own label.
  case combine
  /// Each control the view draws is its own element, and the page's label
  /// names the group. For a tab bar, a toolbar, segments or a list.
  case contain
}

struct NativeAccessibilityModifier: ViewModifier {
  let accessibility: NativeComponentAccessibility?
  var children: NativeAccessibilityChildren = .combine

  func body(content: Content) -> some View {
    switch children {
    case .combine:
      content
        .accessibilityElement(children: .combine)
        .accessibilityLabel(ifPresent: accessibility?.label)
        .accessibilityHint(ifPresent: accessibility?.hint)
        .accessibilityValue(ifPresent: accessibility?.value)
        .accessibilityAddTraits(Self.traits(for: accessibility?.traits ?? []))
        .accessibilityHidden(accessibility?.isHidden ?? false)
    case .contain:
      content
        .accessibilityElement(children: .contain)
        .accessibilityLabel(ifPresent: accessibility?.label)
        .accessibilityHidden(accessibility?.isHidden ?? false)
    }
  }

  static func traits(for names: [String]) -> AccessibilityTraits {
    var traits: AccessibilityTraits = []
    for name in names {
      switch name {
      case "button": traits.formUnion(.isButton)
      case "link": traits.formUnion(.isLink)
      case "image": traits.formUnion(.isImage)
      case "header": traits.formUnion(.isHeader)
      case "selected": traits.formUnion(.isSelected)
      case "switch":
        if #available(iOS 17, *) {
          traits.formUnion(.isToggle)
        } else {
          traits.formUnion(.isButton)
        }
      default: break
      }
    }
    return traits
  }
}

// An empty override would replace what the control says itself, such as a
// toggle's on/off or a slider's percentage, so a missing one is left unset.
// Before iOS 18 that takes a branch, which rebuilds the island's view when the
// page starts or stops sending one.
private extension View {
  @ViewBuilder
  func accessibilityLabel(ifPresent text: String?) -> some View {
    if #available(iOS 18, *) {
      accessibilityLabel(Text(text ?? ""), isEnabled: !(text ?? "").isEmpty)
    } else if let text, !text.isEmpty {
      accessibilityLabel(Text(text))
    } else {
      self
    }
  }

  @ViewBuilder
  func accessibilityHint(ifPresent text: String?) -> some View {
    if #available(iOS 18, *) {
      accessibilityHint(Text(text ?? ""), isEnabled: !(text ?? "").isEmpty)
    } else if let text, !text.isEmpty {
      accessibilityHint(Text(text))
    } else {
      self
    }
  }

  @ViewBuilder
  func accessibilityValue(ifPresent text: String?) -> some View {
    if #available(iOS 18, *) {
      accessibilityValue(Text(text ?? ""), isEnabled: !(text ?? "").isEmpty)
    } else if let text, !text.isEmpty {
      accessibilityValue(Text(text))
    } else {
      self
    }
  }
}
