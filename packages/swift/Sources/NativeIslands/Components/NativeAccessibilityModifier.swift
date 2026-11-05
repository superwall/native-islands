import SwiftUI

struct NativeAccessibilityModifier: ViewModifier {
  let accessibility: NativeComponentAccessibility?

  func body(content: Content) -> some View {
    if let accessibility {
      content
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibility.label.map(Text.init) ?? Text(""))
        .accessibilityHint(accessibility.hint.map(Text.init) ?? Text(""))
        .accessibilityValue(accessibility.value.map(Text.init) ?? Text(""))
        .accessibilityAddTraits(Self.traits(for: accessibility.traits))
        .accessibilityHidden(accessibility.isHidden)
    } else {
      content
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
      default: break
      }
    }
    return traits
  }
}
