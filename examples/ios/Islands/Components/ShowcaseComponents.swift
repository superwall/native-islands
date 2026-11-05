import NativeIslands
import NativeIslandsComponents
import SwiftUI

/// The native components the showcase uses: the ready-made ones from
/// `NativeIslandsComponents` and the app's own, by the names in
/// `examples/showcase/src/islands/definitions.ts`.
enum ShowcaseComponents {
  typealias Glass = @MainActor (NativeComponentProps) -> NativeGlass?

  @MainActor
  static func register(in registry: NativeComponentRegistry = .shared) {
    NativeIslandsComponents.register(in: registry)
    let glassButton = NativeIslandsComponents.buttonGlass
    add("tabBar", in: registry) { TabBarView(component: $0) }
    add("searchTab", in: registry, glass: searchTabGlass) { SearchTabView(component: $0) }
    add("searchField", in: registry, glass: tabBarGlass) { SearchFieldView(component: $0) }
    add("navigationBar", in: registry) { NavigationBarView(component: $0) }
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
    registry.register(name, glass: glass, content: content)
  }

  @MainActor
  static func searchTabGlass(_ props: NativeComponentProps) -> NativeGlass {
    NativeGlass(shape: .circle)
  }

  @MainActor
  static func tabBarGlass(_ props: NativeComponentProps) -> NativeGlass {
    NativeGlass(shape: .capsule)
  }
}
