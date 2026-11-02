import UIKit

/// The Liquid Glass a native component sits on.
///
/// The host draws it behind the component's SwiftUI view with UIKit's
/// `UIGlassEffect`, so components that share a `glassGroup` prop in one place
/// on the page merge and morph into each other through a shared
/// `UIGlassContainerEffect`. Draw the component's content without glass of
/// its own.
public struct NativeGlass: Equatable, Sendable {
  /// How see-through the glass is.
  public enum Style: Equatable, Sendable {
    /// The standard material.
    case regular
    /// A more transparent material, for use over rich backgrounds.
    case clear
  }

  /// The outline of the glass.
  public enum Shape: Equatable, Sendable {
    /// Fully rounded ends, the shape of a system glass button.
    case capsule
    /// A circle, for icon-only buttons.
    case circle
    /// A rectangle with the given corner radius, in points.
    case rounded(CGFloat)
  }

  public var style: Style
  public var shape: Shape
  /// Colours the glass, as the page's tint does for a prominent button.
  public var tint: UIColor?
  /// Whether the glass reacts to touches the way system glass buttons do.
  public var isInteractive: Bool

  public init(
    style: Style = .regular,
    shape: Shape = .capsule,
    tint: UIColor? = nil,
    isInteractive: Bool = true
  ) {
    self.style = style
    self.shape = shape
    self.tint = tint
    self.isInteractive = isInteractive
  }
}

/// The glass behind one island, with its SwiftUI content inside.
@MainActor
final class NativeGlassView: UIVisualEffectView {
  private(set) var glass: NativeGlass

  init(glass: NativeGlass, content: UIView) {
    self.glass = glass
    super.init(effect: nil)
    backgroundColor = .clear
    clipsToBounds = false
    content.frame = contentView.bounds
    content.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    contentView.addSubview(content)
    apply(glass)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func apply(_ glass: NativeGlass) {
    self.glass = glass
    effect = Self.effect(for: glass)
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    layer.cornerRadius = Self.cornerRadius(for: glass.shape, in: bounds.size)
    layer.cornerCurve = .continuous
  }

  static func cornerRadius(for shape: NativeGlass.Shape, in size: CGSize) -> CGFloat {
    switch shape {
    case .capsule, .circle:
      return min(size.width, size.height) / 2
    case .rounded(let radius):
      return max(0, min(radius, min(size.width, size.height) / 2))
    }
  }

  static func effect(for glass: NativeGlass) -> UIVisualEffect? {
    #if os(visionOS)
    return nil
    #else
    guard #available(iOS 26.0, *) else { return nil }
    let effect = UIGlassEffect(style: glass.style == .clear ? .clear : .regular)
    effect.tintColor = glass.tint
    effect.isInteractive = glass.isInteractive
    return effect
    #endif
  }
}

/// A layer that merges the glass of every island sharing a `glassGroup` in
/// one container, sized to the container's content, and passes touches
/// through everywhere there is no island.
@MainActor
final class NativeGlassGroupView: UIVisualEffectView {
  static let mergeSpacing: CGFloat = 16

  let name: String

  init(name: String) {
    self.name = name
    super.init(effect: Self.containerEffect())
    backgroundColor = .clear
    contentView.backgroundColor = .clear
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  /// Covers everything the container can show: its bounds and, for a scroll
  /// view, all of its content.
  func fit(to container: UIView) {
    var size = container.bounds.size
    if let scrollView = container as? UIScrollView {
      size.width = max(size.width, scrollView.contentSize.width)
      size.height = max(size.height, scrollView.contentSize.height)
    }
    let frame = CGRect(origin: .zero, size: size)
    if self.frame != frame {
      self.frame = frame
    }
  }

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let hit = super.hitTest(point, with: event)
    return hit === self || hit === contentView ? nil : hit
  }

  static func containerEffect() -> UIVisualEffect? {
    #if os(visionOS)
    return nil
    #else
    guard #available(iOS 26.0, *) else { return nil }
    let effect = UIGlassContainerEffect()
    effect.spacing = mergeSpacing
    return effect
    #endif
  }
}
