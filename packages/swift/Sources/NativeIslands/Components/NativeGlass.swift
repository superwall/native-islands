import UIKit

public struct NativeGlass: Equatable, Sendable {
  public enum Style: Equatable, Sendable {
    case regular
    case clear
  }

  public enum Shape: Equatable, Sendable {
    case capsule
    case circle
    case rounded(CGFloat)
  }

  public var style: Style
  public var shape: Shape
  public var tint: UIColor?
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
    fatalError("NativeGlassView is created in code.")
  }

  /// While its island slides with a page, the glass takes no touches: its
  /// press highlight is drawn where the view rests and would stay behind.
  var isSliding = false {
    didSet {
      guard isSliding != oldValue, glass.isInteractive else { return }
      var shown = glass
      shown.isInteractive = !isSliding
      UIView.performWithoutAnimation { effect = Self.effect(for: shown) }
    }
  }

  func apply(_ glass: NativeGlass) {
    self.glass = glass
    var shown = glass
    shown.isInteractive = glass.isInteractive && !isSliding
    effect = Self.effect(for: shown)
    #if !os(visionOS)
    if #available(iOS 26.0, *) {
      // The system morphs a menu or popover back into its source view's
      // corner configuration, which reads as a rectangle when only the
      // layer's corner radius is set.
      cornerConfiguration = Self.cornerConfiguration(for: glass.shape)
    }
    #endif
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    #if !os(visionOS)
    if #available(iOS 26.0, *) { return }
    #endif
    layer.cornerRadius = Self.cornerRadius(for: glass.shape, in: bounds.size)
    layer.cornerCurve = .continuous
  }

  #if !os(visionOS)
  @available(iOS 26.0, *)
  static func cornerConfiguration(for shape: NativeGlass.Shape) -> UICornerConfiguration {
    switch shape {
    case .capsule, .circle:
      return .capsule()
    case .rounded(let radius):
      return .uniformCorners(radius: .fixed(max(0, radius)))
    }
  }
  #endif

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
    fatalError("NativeGlassGroupView is created in code.")
  }

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
