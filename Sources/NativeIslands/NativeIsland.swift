import SwiftUI
import UIKit

/// One native view drawn over a web element.
@MainActor
final class NativeIsland {
  static let fadeDuration: TimeInterval = 0.12

  let context: NativeComponentContext
  let host: UIHostingController<NativeIslandRoot>
  let sizing: NativeSizing
  private let glassFor: (@MainActor (NativeComponentProps) -> NativeGlass?)?
  private(set) var glassView: NativeGlassView?
  /// The scroll view or layer the island lives in, directly or through a
  /// glass group.
  weak var container: UIView?
  private(set) var anchor: NativeAnchor
  private(set) var frame: NativeFrame
  private(set) var order: Int
  private(set) var sticky: NativeSticky?
  private(set) var clip: NativeFrame?
  private(set) var holes: [NativeFrame]?
  private(set) var shades: [NativeShade]?
  private var shadeViews: [UIView] = []
  private var shadeHost: UIView?
  var reportedSize: CGSize?
  /// How much of the view's top scrolling has carried under the status bar,
  /// in its own points. That part is cut away, so the view slides under the
  /// bar like the page does instead of drawing sharp on top of it.
  private(set) var topCut: CGFloat = 0

  /// Whether the view should be on screen: the page wants it shown.
  var isShown: Bool {
    context.isVisible
  }

  /// The view placed on the page: the glass when the component sits on
  /// glass, otherwise the SwiftUI view itself.
  var view: UIView { glassView ?? host.view }

  /// The `glassGroup` this island's glass merges with, when it is on glass.
  var glassGroup: String? {
    guard glassView != nil, let group = context.props.string("glassGroup"), !group.isEmpty else {
      return nil
    }
    return group
  }

  init(
    context: NativeComponentContext,
    host: UIHostingController<NativeIslandRoot>,
    mount: NativeMount,
    glass: (@MainActor (NativeComponentProps) -> NativeGlass?)? = nil
  ) {
    self.context = context
    self.host = host
    glassFor = glass
    sizing = mount.sizing
    anchor = mount.anchor
    frame = mount.frame
    sticky = mount.sticky
    clip = mount.clip
    holes = mount.holes
    shades = mount.shades
    order = mount.order
    if let initial = glass?(context.props), NativeGlassView.effect(for: initial) != nil {
      glassView = NativeGlassView(glass: initial, content: host.view)
    }
  }

  /// Follows the props: the glass's tint and shape change with them. Glass is
  /// chosen at mount, so a view never moves between glass and no glass.
  func refreshGlass() {
    guard let glassView, let next = glassFor?(context.props), next != glassView.glass else { return }
    glassView.apply(next)
  }

  func move(to anchor: NativeAnchor) {
    self.anchor = anchor
  }

  func place(
    _ frame: NativeFrame,
    sticky: NativeSticky? = nil,
    clip: NativeFrame? = nil,
    holes: [NativeFrame]? = nil,
    shades: [NativeShade]? = nil
  ) {
    self.frame = frame
    self.sticky = sticky
    self.clip = clip
    self.holes = holes
    self.shades = shades
  }

  /// The part of the view to draw, in its own points, with the covered
  /// parts left out, or `nil` when all of it is drawn.
  var drawnShape: (area: CGRect, holes: [CGRect])? {
    let bounds = CGRect(origin: .zero, size: CGSize(width: frame.width, height: frame.height))
    var area = clip?.cgRect ?? bounds
    if topCut > 0 {
      let cut = min(topCut, area.maxY)
      let minY = max(area.minY, cut)
      area = CGRect(x: area.minX, y: minY, width: area.width, height: max(0, area.maxY - minY))
    }
    let cutouts = (holes ?? []).map(\.cgRect).filter { $0.intersects(area) }
    if area == bounds && cutouts.isEmpty { return nil }
    return (area, cutouts)
  }

  /// Puts the view at its frame, moved as far as its sticky box is stuck in
  /// the scroll view it lives in, and cut to its clip.
  func layOut() {
    var rect = frame.cgRect
    if let sticky, let scrollView = view.superview?.enclosingScrollView {
      rect.origin.y += sticky.shift(
        offset: Double(scrollView.contentOffset.y),
        height: Double(scrollView.bounds.height)
      )
    }
    UIView.performWithoutAnimation {
      view.frame = rect
      applyShape()
      applyShades()
    }
  }

  /// Lays the page's see-through covers over the view in their colour,
  /// rounded like its glass.
  private func applyShades() {
    let wanted = shades ?? []
    guard !wanted.isEmpty || shadeHost != nil else { return }
    let container = shadeHost ?? {
      let container = UIView()
      container.isUserInteractionEnabled = false
      container.clipsToBounds = true
      host.view.addSubview(container)
      shadeHost = container
      return container
    }()
    container.frame = view.convert(view.bounds, to: host.view)
    container.layer.cornerRadius = glassView.map {
      NativeGlassView.cornerRadius(for: $0.glass.shape, in: view.bounds.size)
    } ?? 0
    container.layer.cornerCurve = .continuous
    host.view.bringSubviewToFront(container)
    while shadeViews.count > wanted.count {
      shadeViews.removeLast().removeFromSuperview()
    }
    while shadeViews.count < wanted.count {
      let shade = UIView()
      container.addSubview(shade)
      shadeViews.append(shade)
    }
    for (shadeView, shade) in zip(shadeViews, wanted) {
      shadeView.frame = shade.frame.cgRect
      shadeView.backgroundColor = NativeComponentProps.rgba(shade.color).map {
        UIColor(red: $0.red, green: $0.green, blue: $0.blue, alpha: $0.alpha)
      }
    }
  }

  /// The colour views laid over the view, for tests.
  var shadeLayers: [UIView] { shadeViews }

  /// Cuts the view to its shape. Glass ignores a mask view, so glass is cut
  /// through its layer's mask instead.
  private func applyShape() {
    guard let shape = drawnShape else {
      view.mask = nil
      view.layer.mask = nil
      return
    }
    if glassView != nil {
      let mask = (view.layer.mask as? CAShapeLayer) ?? NativeIslandMask.shapeLayer()
      NativeIslandMask.draw(mask, in: view.bounds, area: shape.area, holes: shape.holes)
      view.layer.mask = mask
      return
    }
    let mask = (view.mask as? NativeIslandMask) ?? NativeIslandMask()
    mask.frame = CGRect(origin: .zero, size: view.bounds.size)
    mask.draw(area: shape.area, holes: shape.holes)
    view.mask = mask
  }

  func reorder(_ order: Int) {
    self.order = order
  }

  /// Cuts `cut` points off the view's top; `true` when it changed.
  func cutTop(_ cut: CGFloat) -> Bool {
    let cut = max(0, cut)
    guard abs(cut - topCut) > 0.01 else { return false }
    topCut = cut
    UIView.performWithoutAnimation { applyShape() }
    return true
  }

  func applyVisibility(animated: Bool) {
    let visible = isShown
    view.isUserInteractionEnabled = visible
    let change = { [view] in view.alpha = visible ? 1 : 0 }
    if animated {
      UIView.animate(
        withDuration: Self.fadeDuration,
        delay: 0,
        options: [.beginFromCurrentState, .allowUserInteraction],
        animations: change
      )
    } else {
      change()
    }
  }

  func applyAccessibility() {
    view.accessibilityElementsHidden = context.accessibility?.isHidden == true
  }

  /// The size the view wants, when it changed since it was last reported.
  func measure() -> NativeSize? {
    let fitted = host.sizeThatFits(
      in: CGSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
    )
    guard
      fitted.width.isFinite,
      fitted.height.isFinite,
      fitted.width >= 0,
      fitted.height >= 0,
      fitted != reportedSize
    else {
      return nil
    }
    reportedSize = fitted
    return NativeSize(width: Double(fitted.width), height: Double(fitted.height))
  }
}

extension UIView {
  /// The nearest scroll view at or above this view.
  var enclosingScrollView: UIScrollView? {
    var current: UIView? = self
    while let view = current {
      if let scrollView = view as? UIScrollView { return scrollView }
      current = view.superview
    }
    return nil
  }
}

/// Draws the visible part of an island: its area, with the holes the page
/// covers left out.
final class NativeIslandMask: UIView {
  private let shape = CAShapeLayer()

  override init(frame: CGRect) {
    super.init(frame: frame)
    shape.fillRule = .evenOdd
    shape.fillColor = UIColor.black.cgColor
    layer.addSublayer(shape)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("NativeIslandMask is created in code.")
  }

  func draw(area: CGRect, holes: [CGRect]) {
    Self.draw(shape, in: bounds, area: area, holes: holes)
  }

  static func shapeLayer() -> CAShapeLayer {
    let layer = CAShapeLayer()
    layer.fillRule = .evenOdd
    layer.fillColor = UIColor.black.cgColor
    return layer
  }

  /// Fills `area` of `layer`, less `holes`.
  static func draw(_ layer: CAShapeLayer, in bounds: CGRect, area: CGRect, holes: [CGRect]) {
    let path = CGMutablePath()
    path.addRect(area)
    for hole in holes {
      let cut = hole.intersection(area)
      if !cut.isNull, !cut.isEmpty { path.addRect(cut) }
    }
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    layer.frame = bounds
    layer.path = path
    CATransaction.commit()
  }
}
