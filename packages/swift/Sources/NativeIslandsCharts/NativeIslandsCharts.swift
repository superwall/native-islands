import NativeIslands
import SwiftUI

/// The Swift Charts island, `chart`, apart from `NativeIslandsComponents` so
/// an app links Swift Charts only when its pages draw charts. It needs no
/// Info.plist key, and draws from iOS 16; before that it is not offered, so
/// the page keeps its web version.
public enum NativeIslandsCharts {
  /// The name pages mount it by.
  public static let name = "chart"

  /// Whether this iOS can draw a chart.
  public static var isAvailable: Bool {
    if #available(iOS 16.0, *) { return true }
    return false
  }

  @MainActor
  public static func register(in registry: NativeComponentRegistry? = nil) {
    guard #available(iOS 16.0, *) else { return }
    (registry ?? .shared).register(name, accessibilityChildren: .contain) { ChartView(component: $0) }
  }
}
