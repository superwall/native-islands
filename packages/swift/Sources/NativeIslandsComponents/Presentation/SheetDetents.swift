import UIKit

/// Sheet detents by the names the page uses: `medium`, `large`, or a height
/// in points such as `"240"`.
@MainActor
enum SheetDetents {
  /// `medium`, `large`, or a height in points such as `"240"`.
  /// `resolved` hears the height UIKit gives `large` and every height in
  /// points, each time it lays the sheet out (from iOS 16).
  static func detent(
    _ name: String,
    resolved: @escaping @MainActor (CGFloat) -> Void = { _ in }
  ) -> UISheetPresentationController.Detent? {
    switch name {
    case "medium": return .medium()
    case "large":
      guard #available(iOS 16.0, *) else { return .large() }
      // The same height as `.large()`, told to the page.
      return .custom(identifier: .large) { context in
        let height = context.maximumDetentValue
        MainActor.assumeIsolated { resolved(height) }
        return height
      }
    default:
      guard let height = Double(name), height > 0 else { return nil }
      if #available(iOS 16.0, *) {
        return .custom(identifier: identifier(name)) { _ in
          MainActor.assumeIsolated { resolved(height) }
          return height
        }
      }
      return .medium()
    }
  }

  static func identifier(_ name: String) -> UISheetPresentationController.Detent.Identifier {
    switch name {
    case "medium": return .medium
    case "large": return .large
    default: return .init(name)
    }
  }

  static func name(of identifier: UISheetPresentationController.Detent.Identifier?) -> String? {
    guard let identifier else { return nil }
    switch identifier {
    case .medium: return "medium"
    case .large: return "large"
    default: return identifier.rawValue
    }
  }
}
