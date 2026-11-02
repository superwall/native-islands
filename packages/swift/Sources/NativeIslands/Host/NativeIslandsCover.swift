import UIKit

/// Hides a held web view with the colour behind it.
final class NativeIslandsCover: UIView {
  override init(frame: CGRect) {
    super.init(frame: frame)
    autoresizingMask = [.flexibleWidth, .flexibleHeight]
    isUserInteractionEnabled = false
    accessibilityElementsHidden = true
    backgroundColor = .systemBackground
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    backgroundColor = Self.colorBehind(self) ?? .systemBackground
  }

  static func colorBehind(_ view: UIView) -> UIColor? {
    var current = view.superview
    while let candidate = current {
      if let color = candidate.backgroundColor, color.cgColor.alpha > 0 { return color }
      current = candidate.superview
    }
    return nil
  }
}
