import NativeIslands
import SwiftUI

enum DefaultComponents {
  @MainActor
  static func register(in registry: NativeComponentRegistry = .shared) {
    guard #available(iOS 26.0, macCatalyst 26.0, *) else { return }
    registry.register("glassButton", glass: glassButtonGlass) { component in
      GlassButtonView(component: component)
    }
    registry.register("closeButton", glass: closeButtonGlass) { component in
      CloseButtonView(component: component)
    }
    registry.register("toggle") { component in
      ToggleView(component: component)
    }
    registry.register("segmentedControl") { component in
      SegmentedControlView(component: component)
    }
    registry.register("symbol") { component in
      SymbolView(component: component)
    }
  }

  @MainActor
  static func glassButtonGlass(_ props: NativeComponentProps) -> NativeGlass {
    let prominent = props.string("prominence") == "prominent"
    let iconOnly = (props.string("title") ?? "").isEmpty && props.string("systemImage") != nil
    return NativeGlass(
      shape: iconOnly ? .circle : .capsule,
      tint: prominent ? props.uiColor("tint") ?? .tintColor : props.uiColor("tint")?.withAlphaComponent(0.3),
      isInteractive: props.bool("disabled") != true
    )
  }

  @MainActor
  static func closeButtonGlass(_ props: NativeComponentProps) -> NativeGlass {
    NativeGlass(shape: .circle, tint: props.uiColor("tint")?.withAlphaComponent(0.3))
  }

  static let weights: [String: Font.Weight] = [
    "ultraLight": .ultraLight,
    "thin": .thin,
    "light": .light,
    "regular": .regular,
    "medium": .medium,
    "semibold": .semibold,
    "bold": .bold,
    "heavy": .heavy,
    "black": .black
  ]
}
