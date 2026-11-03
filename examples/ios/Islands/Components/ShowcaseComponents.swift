import NativeIslands
import SwiftUI

/// The native components the showcase uses, by the names in
/// `examples/showcase/src/islands/definitions.ts`. Each can draw the
/// outline the page's Outlines mode asks for.
enum ShowcaseComponents {
  typealias Glass = @MainActor (NativeComponentProps) -> NativeGlass?

  @MainActor
  static func register(in registry: NativeComponentRegistry = .shared) {
    guard #available(iOS 26.0, *) else { return }
    let glassButton = DefaultComponents.glassButtonGlass
    add("glassButton", in: registry, glass: glassButton) { GlassButtonView(component: $0) }
    add("closeButton", in: registry, glass: DefaultComponents.closeButtonGlass) { CloseButtonView(component: $0) }
    add("toggle", in: registry) { ToggleView(component: $0) }
    add("segmentedControl", in: registry) { SegmentedControlView(component: $0) }
    add("symbol", in: registry) { SymbolView(component: $0) }
    add("tabBar", in: registry, glass: tabBarGlass) { TabBarView(component: $0) }
    add("searchField", in: registry, glass: tabBarGlass) { SearchFieldView(component: $0) }
    add("menu", in: registry, glass: glassButton) { MenuView(component: $0) }
    add("slider", in: registry) { SliderView(component: $0) }
    add("stepper", in: registry) { StepperView(component: $0) }
    add("picker", in: registry) { PickerView(component: $0) }
    add("datePicker", in: registry) { DatePickerView(component: $0) }
    add("colorPicker", in: registry) { ColorPickerView(component: $0) }
    add("textField", in: registry) { TextFieldView(component: $0) }
    add("gauge", in: registry) { GaugeView(component: $0) }
    add("symbolEffect", in: registry) { SymbolEffectView(component: $0) }
    add("chart", in: registry) { ChartView(component: $0) }
    add("map", in: registry) { MapView(component: $0) }
    add("video", in: registry) { VideoView(component: $0) }
    add("camera", in: registry) { CameraView(component: $0) }
    add("photoPicker", in: registry, glass: glassButton) { PhotoPickerView(component: $0) }
    add("permission", in: registry) { PermissionView(component: $0) }
    add("hapticButton", in: registry, glass: glassButton) { HapticButtonView(component: $0) }
    add("shareButton", in: registry, glass: glassButton) { ShareButtonView(component: $0) }
  }

  @MainActor
  private static func add<Content: View>(
    _ name: String,
    in registry: NativeComponentRegistry,
    glass: Glass? = nil,
    @ViewBuilder content: @escaping @MainActor (NativeComponentContext) -> Content
  ) {
    registry.register(name, glass: glass) { component in
      content(component).modifier(IslandOutline(name: name))
    }
  }

  @MainActor
  static func tabBarGlass(_ props: NativeComponentProps) -> NativeGlass {
    NativeGlass(shape: .capsule)
  }
}
