import NativeIslands
import SwiftUI
import UIKit

/// Where an island presents a system sheet. Islands are hosted outside the
/// view controller tree, so they present from the window's frontmost controller.
package enum Presenter {
  @MainActor
  package static func front() -> UIViewController? {
    let window = UIApplication.shared.connectedScenes
      .compactMap { ($0 as? UIWindowScene)?.keyWindow }
      .first
    var front = window?.rootViewController
    while let presented = front?.presentedViewController, !presented.isBeingDismissed {
      front = presented
    }
    return front
  }
}

/// The label of a glass button whose action happens natively: a symbol and
/// a title, drawn like `GlassButtonView`.
package struct GlassActionLabel: View {
  let props: NativeComponentProps

  package init(props: NativeComponentProps) {
    self.props = props
  }

  package var body: some View {
    let prominent = props.string("prominence") == "prominent"
    HStack(spacing: 6) {
      if let symbol = props.string("systemImage") {
        Image(systemName: symbol)
      }
      if let title = props.string("title"), !title.isEmpty {
        Text(title).lineLimit(1)
      }
    }
    .font(.body.weight(.semibold))
    .foregroundStyle(prominent ? GlassButtonView.ink(on: props.uiColor("tint")) : Color.primary)
    .padding(.horizontal, 12)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .contentShape(Capsule())
  }
}

/// Hands back the UIKit view behind a SwiftUI view, for anchoring a popover.
struct SourceView: UIViewRepresentable {
  @Binding var view: UIView?

  func makeUIView(context: Context) -> UIView {
    let view = UIView()
    view.isUserInteractionEnabled = false
    DispatchQueue.main.async { self.view = view }
    return view
  }

  func updateUIView(_ uiView: UIView, context: Context) {}
}

package enum ImageData {
  /// A JPEG data URL of the image, no longer than `side` points on its long edge.
  package static func dataURL(from image: UIImage, side: CGFloat) -> String? {
    let scale = min(side / max(image.size.width, image.size.height, 1), 1)
    let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let scaled = UIGraphicsImageRenderer(size: size, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }
    return scaled.jpegData(compressionQuality: 0.8).map { "data:image/jpeg;base64,\($0.base64EncodedString())" }
  }

  package static func dataURL(from data: Data, side: CGFloat) -> String? {
    UIImage(data: data).flatMap { dataURL(from: $0, side: side) }
  }
}
