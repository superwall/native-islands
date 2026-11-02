import UIKit

struct NativeSilhouette {
  let size: CGSize
  let props: NativeComponentProps
  let mask: CALayer
}

extension NativeIsland {
  func raiseShades() {
    guard let shadeHost, let parent = view.superview, shadeHost.superview === parent else { return }
    parent.insertSubview(shadeHost, aboveSubview: view)
  }

  func removeShades() {
    shadeHost?.removeFromSuperview()
    shadeHost = nil
    shadeViews.removeAll()
    silhouetteCache = nil
  }

  var shadeLayers: [UIView] { shadeViews }

  func cachedSilhouette(drawing draw: () -> CALayer? = { nil }) -> CALayer? {
    let size = view.bounds.size
    if let cache = silhouetteCache, cache.size == size, cache.props == context.props {
      return cache.mask
    }
    guard let mask = draw() ?? silhouette() else { return nil }
    silhouetteCache = NativeSilhouette(size: size, props: context.props, mask: mask)
    return mask
  }

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
