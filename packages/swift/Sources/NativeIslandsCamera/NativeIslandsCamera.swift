import NativeIslands
import SwiftUI

/// The live camera island, `camera`, apart from `NativeIslandsComponents`
/// because it needs `NSCameraUsageDescription` in the app's Info.plist.
public enum NativeIslandsCamera {
  /// The name pages mount it by.
  public static let name = "camera"

  @MainActor
  public static func register(in registry: NativeComponentRegistry? = nil) {
    (registry ?? .shared).register(name) { CameraView(component: $0) }
  }
}
