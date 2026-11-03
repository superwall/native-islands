import SwiftUI
import UIKit

@MainActor
final class NativeIsland {
  static let fadeDuration: TimeInterval = 0.12

  let context: NativeComponentContext
  let host: UIHostingController<NativeIslandRoot>
  let sizing: NativeSizing
  private let glassFor: (@MainActor (NativeComponentProps) -> NativeGlass?)?
  private(set) var glassView: NativeGlassView?
  weak var container: UIView?
  private(set) var anchor: NativeAnchor
  private(set) var frame: NativeFrame
  private(set) var order: Int
  private(set) var sticky: NativeSticky?
  private(set) var clip: NativeFrame?
  private(set) var holes: [NativeFrame]?
  private(set) var shades: [NativeShade]?
  private(set) var transform: NativeTransform?
  private(set) var opacity: Double?
  private(set) var motion: NativeMotion?
  var sliding = NativeIslandSlide()
  var shadeViews: [UIView] = []
  var shadeHost: UIView?
  var silhouetteCache: NativeSilhouette?
  var reportedSize: CGSize?
  private(set) var topCut: CGFloat = 0

  var isShown: Bool {
    context.isVisible
  }

  var view: UIView { glassView ?? host.view }

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
    transform = mount.transform
    opacity = mount.opacity
    motion = mount.motion
    order = mount.order
    if let initial = glass?(context.props), NativeGlassView.effect(for: initial) != nil {
      glassView = NativeGlassView(glass: initial, content: host.view)
    }
  }

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
    shades: [NativeShade]? = nil,
    transform: NativeTransform? = nil,
    opacity: Double? = nil,
    motion: NativeMotion? = nil
  ) {
    self.frame = frame
    self.sticky = sticky
    self.clip = clip
    self.holes = holes
    self.shades = shades
    self.transform = transform
    self.opacity = opacity
    self.motion = motion
  }

  func place(_ frame: NativeFrame, geometryOf update: NativeUpdate) {
    place(
      frame,
      sticky: update.sticky,
      clip: update.clip,
      holes: update.holes,
      shades: update.shades,
      transform: update.transform,
      opacity: update.opacity,
      motion: update.motion
    )
  }

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

  func layOut() {
    var rect = frame.cgRect
    if let sticky, let scrollView = view.superview?.enclosingScrollView {
      rect.origin.y += sticky.shift(
        offset: Double(scrollView.contentOffset.y),
        height: Double(scrollView.bounds.height)
      )
    }
    UIView.performWithoutAnimation {
      // A turned view is placed by centre and bounds, since UIKit's frame
      // is its turned bounding box.
      view.transform = .identity
      view.frame = rect
      if let transform {
        view.transform = transform.affine
      }
      applyShape()
      applyShades()
      applyMotion()
    }
  }

  private func applyShades() {
    let wanted = shades ?? []
    guard !wanted.isEmpty || shadeHost != nil else { return }
    if wanted.isEmpty {
      removeShades()
      return
    }
    guard let parent = view.superview else { return }
    let container = shadeHost ?? {
      let container = UIView()
      container.isUserInteractionEnabled = false
      container.clipsToBounds = true
      container.layer.cornerCurve = .continuous
      shadeHost = container
      return container
    }()
    if container.superview !== parent {
      container.removeFromSuperview()
      parent.insertSubview(container, aboveSubview: view)
    } else if let index = parent.subviews.firstIndex(of: view),
              parent.subviews.firstIndex(of: container) != index + 1 {
      parent.insertSubview(container, aboveSubview: view)
    }
    container.frame = view.frame
    container.alpha = view.alpha
    if let glassView {
      container.layer.mask = nil
      container.layer.cornerRadius = NativeGlassView.cornerRadius(
        for: glassView.glass.shape,
        in: view.bounds.size
      )
    } else {
      container.layer.cornerRadius = 0
      container.layer.mask = cachedSilhouette() ?? container.layer.mask
    }
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

  func applyShape() {
    guard let shape = drawnShape else {
      view.mask = nil
      view.layer.mask = nil
      view.isHidden = sliding.coverHidden
      shadeHost?.isHidden = sliding.coverHidden
      return
    }
    // Glass does not always honour a mask drawn with nothing in it, so an
    // island covered all over is taken off the screen outright.
    let covered = sliding.coverHidden || NativeIslandMask.visibleParts(of: shape.area, less: shape.holes).isEmpty
    view.isHidden = covered
    shadeHost?.isHidden = covered
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

  func cutTop(_ cut: CGFloat) -> Bool {
    let cut = max(0, cut)
    guard abs(cut - topCut) > 0.01 else { return false }
    topCut = cut
    UIView.performWithoutAnimation { applyShape() }
    return true
  }

  var shownAlpha: CGFloat {
    isShown ? CGFloat(opacity ?? 1) : 0
  }

  func applyVisibility(animated: Bool) {
    let visible = isShown
    let alpha = shownAlpha
    view.isUserInteractionEnabled = visible
    let change = { [view, shadeHost] in
      view.alpha = alpha
      shadeHost?.alpha = view.alpha
    }
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
  var enclosingScrollView: UIScrollView? {
    var current: UIView? = self
    while let view = current {
      if let scrollView = view as? UIScrollView { return scrollView }
      current = view.superview
    }
    return nil
  }
}
