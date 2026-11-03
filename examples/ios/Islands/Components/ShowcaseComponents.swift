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
  }

  @MainActor
  static func tabBarGlass(_ props: NativeComponentProps) -> NativeGlass {
    NativeGlass(shape: .capsule)
  }
}
