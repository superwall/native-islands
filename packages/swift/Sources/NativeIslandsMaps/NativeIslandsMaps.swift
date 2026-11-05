import NativeIslands
import SwiftUI

/// The MapKit map island, `map`, apart from `NativeIslandsComponents` so an
/// app links Core Location only when it uses it. A map needs no Info.plist key
/// unless the page sets `showsUser`, which needs `NSLocationWhenInUseUsageDescription`.
public enum NativeIslandsMaps {
  /// The name pages mount it by.
  public static let name = "map"

  @MainActor
  public static func register(in registry: NativeComponentRegistry? = nil) {
    (registry ?? .shared).register(name) { MapView(component: $0) }
  }
}
