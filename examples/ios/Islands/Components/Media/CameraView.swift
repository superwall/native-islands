@preconcurrency import AVFoundation
import NativeIslands
import SwiftUI

/// A capture session on its own queue, as AVFoundation asks, with a still
/// photo output for `capture`.
final class CameraSession: NSObject, ObservableObject, @unchecked Sendable, AVCapturePhotoCaptureDelegate {
  let session = AVCaptureSession()
  /// `starting`, `running`, `unavailable` (no camera, as on the simulator) or `denied`.
  @MainActor @Published private(set) var state = "starting"
  private let queue = DispatchQueue(label: "Islands.camera")
  private let output = AVCapturePhotoOutput()
  private var position: AVCaptureDevice.Position?
  private var pending: CheckedContinuation<Data?, Never>?

  @MainActor
  func start(_ next: AVCaptureDevice.Position) async {
    guard await AVCaptureDevice.requestAccess(for: .video) else {
      state = "denied"
      return
    }
    let running = await withCheckedContinuation { continuation in
      queue.async { continuation.resume(returning: self.configure(next)) }
    }
    state = running ? "running" : "unavailable"
  }

  func stop() {
    queue.async { self.session.stopRunning() }
  }

  private func configure(_ next: AVCaptureDevice.Position) -> Bool {
    if position != next {
      session.beginConfiguration()
      session.inputs.forEach(session.removeInput)
      if let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: next),
        let input = try? AVCaptureDeviceInput(device: device), session.canAddInput(input) {
        session.addInput(input)
        position = next
      } else {
        position = nil
      }
      if session.outputs.isEmpty, session.canAddOutput(output) { session.addOutput(output) }
      session.commitConfiguration()
    }
    guard position != nil else { return false }
    if !session.isRunning { session.startRunning() }
    return session.isRunning
  }

  /// A JPEG of the next frame, or nil without a running camera.
  func capture() async -> Data? {
    await withCheckedContinuation { continuation in
      queue.async {
        guard self.session.isRunning, self.pending == nil else {
          continuation.resume(returning: nil)
          return
        }
        self.pending = continuation
        self.output.capturePhoto(with: AVCapturePhotoSettings(), delegate: self)
      }
    }
  }

  func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
    queue.async {
      self.pending?.resume(returning: photo.fileDataRepresentation())
      self.pending = nil
    }
  }
}

final class PreviewLayerView: UIView {
  override static var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }

  var preview: AVCaptureVideoPreviewLayer {
    guard let layer = layer as? AVCaptureVideoPreviewLayer else {
      fatalError("PreviewLayerView's layer is a preview layer.")
    }
    return layer
  }
}

struct CameraPreview: UIViewRepresentable {
  let session: AVCaptureSession

  func makeUIView(context: Context) -> PreviewLayerView {
    let view = PreviewLayerView()
    view.backgroundColor = .black
    view.preview.videoGravity = .resizeAspectFill
    view.preview.session = session
    return view
  }

  func updateUIView(_ view: PreviewLayerView, context: Context) {}
}

/// The live camera, `back` or `front` by `position`, while `running`. It sends `status` with
/// the camera's state, and the `capture` command answers with a photo as a
/// JPEG data URL, scaled down for the page.
struct CameraView: View {
  @ObservedObject var component: NativeComponentContext
  @StateObject private var camera = CameraSession()

  var body: some View {
    let position: AVCaptureDevice.Position = component.props.string("position") == "front" ? .front : .back
    let running = component.props.bool("running") == true
    ZStack {
      CameraPreview(session: camera.session)
      if camera.state != "running" {
        Color.black
        VStack(spacing: 8) {
          Image(systemName: camera.state == "denied" ? "video.slash.fill" : "camera.fill")
            .font(.largeTitle)
          Text(Self.message(camera.state))
            .font(.subheadline)
            .multilineTextAlignment(.center)
        }
        .foregroundStyle(.white.opacity(0.7))
        .padding()
      }
    }
    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    .task(id: running ? "\(position.rawValue)" : "off") {
      if running {
        await camera.start(position)
      } else {
        camera.stop()
      }
    }
    .onDisappear { camera.stop() }
    .onChangeOf(camera.state) { state in
      component.emit("status", payload: ["state": state])
    }
    .onAppear {
      component.onCommand { [camera] name, _ in
        guard name == "capture" else { throw NativeComponentError.refused("Unknown command \(name).") }
        guard let data = await camera.capture() else { throw NativeComponentError.refused("No camera is running.") }
        return ["image": PhotoPickerView.dataURL(from: data, side: 720) ?? ""]
      }
    }
  }

  static func message(_ state: String) -> String {
    switch state {
    case "denied": "Camera access is off for Islands. Turn it on in Settings."
    case "unavailable": "This device has no camera. Run Islands on an iPhone to see it live."
    default: "Starting the camera…"
    }
  }
}
