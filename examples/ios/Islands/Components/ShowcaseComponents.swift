import NativeIslands
import NativeIslandsCharts
import NativeIslandsComponents
import NativeIslandsMaps

/// Everything the showcase draws natively comes from the package: the
/// ready-made components, app chrome and presentations, plus the map and the
/// chart. The app has no Swift components of its own.
enum ShowcaseComponents {
  @MainActor
  static func register(in registry: NativeComponentRegistry = .shared) {
    NativeIslandsComponents.register(in: registry)
    NativeIslandsMaps.register(in: registry)
    NativeIslandsCharts.register(in: registry)
  }
}
