import NativeIslands
import SwiftUI

/// The permission button island, `permission`, apart from
/// `NativeIslandsComponents` because it links the frameworks behind each
/// prompt. The app needs the usage description of every kind its pages ask
/// for: `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`,
/// `NSLocationWhenInUseUsageDescription` and `NSPhotoLibraryUsageDescription`;
/// notifications need none.
public enum NativeIslandsPermissions {
  /// The name pages mount it by.
  public static let name = "permission"

  @MainActor
  public static func register(in registry: NativeComponentRegistry? = nil) {
    (registry ?? .shared).register(name) { PermissionView(component: $0) }
  }
}
