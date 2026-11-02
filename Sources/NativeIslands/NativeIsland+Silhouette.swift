import UIKit

/// A drawn silhouette, with the size and props it was drawn for.
struct NativeSilhouette {
  let size: CGSize
  let props: NativeComponentProps
  let mask: CALayer
}

extension NativeIsland {
  /// Keeps the shades just above the view after the views around it moved.
  func raiseShades() {
    guard let shadeHost, let parent = view.superview, shadeHost.superview === parent else { return }
    parent.insertSubview(shadeHost, aboveSubview: view)
  }

  /// Takes the shades off the page, as when the island is removed.
  func removeShades() {
    shadeHost?.removeFromSuperview()
    shadeHost = nil
    shadeViews.removeAll()
    silhouetteCache = nil
  }

  /// The colour views laid over the view, for tests.
  var shadeLayers: [UIView] { shadeViews }

  /// The silhouette for the view's current size and props, drawn again only
  /// when one of them changes, so a shade over a moving control does not
  /// render the control on every frame.
  func cachedSilhouette(drawing draw: () -> CALayer? = { nil }) -> CALayer? {
    let size = view.bounds.size
    if let cache = silhouetteCache, cache.size == size, cache.props == context.props {
      return cache.mask
    }
    guard let mask = draw() ?? silhouette() else { return nil }
    silhouetteCache = NativeSilhouette(size: size, props: context.props, mask: mask)
    return mask
  }

  /// A mask in the shape the view draws, from its pixels' alpha, so a shade
  /// over a switch or a segmented control dims the control and not the
  /// rectangle around it. `nil` when the view cannot be drawn yet.
  func silhouette() -> CALayer? {
    let size = view.bounds.size
    guard size.width > 0, size.height > 0, view.window != nil else { return nil }
    let format = UIGraphicsImageRendererFormat.preferred()
    format.opaque = false
    var drawn = false
    let image = UIGraphicsImageRenderer(size: size, format: format).image { _ in
      drawn = view.drawHierarchy(in: CGRect(origin: .zero, size: size), afterScreenUpdates: false)
    }
    guard drawn, let cgImage = image.cgImage else { return nil }
    let mask = CALayer()
    mask.frame = CGRect(origin: .zero, size: size)
    mask.contents = cgImage
    mask.contentsScale = image.scale
    return mask
  }
}
