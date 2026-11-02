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
  var reportedSize: CGSize?
  /// Whether the view sits under the status bar, where the system blurs the
  /// page and a sharp native view would draw over it.
  private(set) var isObscured = false

  /// Whether the view should be on screen: the page wants it shown and it
  /// isn't under the status bar.
  var isShown: Bool {
    context.isVisible && !isObscured
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

  func place(_ frame: NativeFrame) {
    self.frame = frame
  }

  func reorder(_ order: Int) {
    self.order = order
  }

  /// Updates ``isObscured``; `true` when it changed.
  func obscure(_ obscured: Bool) -> Bool {
    guard obscured != isObscured else { return false }
    isObscured = obscured
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
