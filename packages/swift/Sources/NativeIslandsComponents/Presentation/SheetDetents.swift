import UIKit

/// Sheet detents by the names the page uses: `medium`, `large`, or a height
/// in points such as `"240"`.
@MainActor
enum SheetDetents {
  /// `medium`, `large`, or a height in points such as `"240"`.
  static func detent(_ name: String) -> UISheetPresentationController.Detent? {
    switch name {
    case "medium": return .medium()
    case "large": return .large()
    default:
      guard let height = Double(name), height > 0 else { return nil }
      if #available(iOS 16.0, *) {
        return .custom(identifier: identifier(name)) { _ in height }
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
