import NativeIslands
import SwiftUI

/// The native components the showcase uses, by the names in
/// `examples/showcase/src/islands/definitions.ts`.
enum ShowcaseComponents {
  @MainActor
  static func register(in registry: NativeComponentRegistry = .shared) {
    DefaultComponents.register(in: registry)
    guard #available(iOS 26.0, *) else { return }
    registry.register("tabBar", glass: tabBarGlass) { component in
      TabBarView(component: component)
    }
    registry.register("searchField", glass: tabBarGlass) { SearchFieldView(component: $0) }
    registry.register("menu", glass: DefaultComponents.glassButtonGlass) { MenuView(component: $0) }
    registry.register("slider") { SliderView(component: $0) }
    registry.register("stepper") { StepperView(component: $0) }
    registry.register("picker") { PickerView(component: $0) }
    registry.register("datePicker") { DatePickerView(component: $0) }
    registry.register("colorPicker") { ColorPickerView(component: $0) }
    registry.register("textField") { TextFieldView(component: $0) }
    registry.register("gauge") { GaugeView(component: $0) }
    registry.register("symbolEffect") { SymbolEffectView(component: $0) }
    registry.register("chart") { ChartView(component: $0) }
    registry.register("map") { MapView(component: $0) }
    registry.register("video") { VideoView(component: $0) }
    registry.register("camera") { CameraView(component: $0) }
    registry.register("photoPicker", glass: DefaultComponents.glassButtonGlass) { PhotoPickerView(component: $0) }
    registry.register("permission") { PermissionView(component: $0) }
    registry.register("hapticButton", glass: DefaultComponents.glassButtonGlass) { HapticButtonView(component: $0) }
    registry.register("shareButton", glass: DefaultComponents.glassButtonGlass) { ShareButtonView(component: $0) }
  }

  @MainActor
  static func tabBarGlass(_ props: NativeComponentProps) -> NativeGlass {
    NativeGlass(shape: .capsule)
  }
}
