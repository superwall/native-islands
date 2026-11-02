import UIKit

extension NativeIsland {
  /// The colour views laid over the view, for tests.
  var shadeLayers: [UIView] { shadeViews }

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
