import NativeIslands
import PhotosUI
import SwiftUI
import UIKit

/// Presents the system photo picker, which runs out of process and needs no
/// photo library permission, and hands back what was chosen.
@MainActor
final class PhotoPickerPresenter: NSObject, PHPickerViewControllerDelegate {
  private var finish: (([UIImage]) -> Void)?

  func present(limit: Int, finish: @escaping ([UIImage]) -> Void) {
    guard let front = Presenter.front() else { return }
    var configuration = PHPickerConfiguration()
    configuration.filter = .images
    configuration.selectionLimit = limit
    configuration.selection = .ordered
    let picker = PHPickerViewController(configuration: configuration)
    picker.delegate = self
    self.finish = finish
    front.present(picker, animated: true)
  }

  nonisolated func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
    let group = DispatchGroup()
    let lock = NSLock()
    nonisolated(unsafe) var images = [UIImage?](repeating: nil, count: results.count)
    for (index, result) in results.enumerated() where result.itemProvider.canLoadObject(ofClass: UIImage.self) {
      group.enter()
      _ = result.itemProvider.loadObject(ofClass: UIImage.self) { image, _ in
        lock.withLock { images[index] = image as? UIImage }
        group.leave()
      }
    }
    MainActor.assumeIsolated { picker.dismiss(animated: true) }
    group.notify(queue: .main) {
      MainActor.assumeIsolated {
        let finish = self.finish
        self.finish = nil
        finish?(lock.withLock { images.compactMap { $0 } })
      }
    }
  }
}

/// A glass button that opens the system photo picker and sends `pick` with
/// the photos chosen, as JPEG data URLs scaled to fit the page.
struct PhotoPickerView: View {
  @ObservedObject var component: NativeComponentContext
  @State private var presenter = PhotoPickerPresenter()

  var body: some View {
    Button {
      presenter.present(limit: max(component.props.int("limit") ?? 1, 1)) { images in
        let urls = images.compactMap { Self.dataURL(from: $0, side: 900) }
        component.emit("pick", payload: ["images": urls])
      }
    } label: {
      GlassActionLabel(props: component.props)
    }
    .buttonStyle(.plain)
  }

  /// A JPEG data URL of the image, no longer than `side` points on its long edge.
  static func dataURL(from image: UIImage, side: CGFloat) -> String? {
    let scale = min(side / max(image.size.width, image.size.height, 1), 1)
    let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let scaled = UIGraphicsImageRenderer(size: size, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }
    return scaled.jpegData(compressionQuality: 0.8).map { "data:image/jpeg;base64,\($0.base64EncodedString())" }
  }

  static func dataURL(from data: Data, side: CGFloat) -> String? {
    UIImage(data: data).flatMap { dataURL(from: $0, side: side) }
  }
}
