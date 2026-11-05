import NativeIslands
import NativeIslandsCamera
import NativeIslandsComponents
import NativeIslandsMaps
import NativeIslandsPermissions
import SwiftUI

/// The native components the showcase uses: every ready-made one from the
/// package and the app's own chrome, by the names in
/// `examples/showcase/src/islands/definitions.ts`.
enum ShowcaseComponents {
  typealias Glass = @MainActor (NativeComponentProps) -> NativeGlass?

  @MainActor
  static func register(in registry: NativeComponentRegistry = .shared) {
    NativeIslandsComponents.register(in: registry)
    NativeIslandsMaps.register(in: registry)
    NativeIslandsCamera.register(in: registry)
    NativeIslandsPermissions.register(in: registry)
    add("tabBar", in: registry) { TabBarView(component: $0) }
    add("searchTab", in: registry, glass: searchTabGlass) { SearchTabView(component: $0) }
    add("searchField", in: registry, glass: tabBarGlass) { SearchFieldView(component: $0) }
    add("navigationBar", in: registry) { NavigationBarView(component: $0) }
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
