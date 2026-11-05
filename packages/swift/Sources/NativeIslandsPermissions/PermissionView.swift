import AVFoundation
import CoreLocation
import NativeIslands
import NativeIslandsComponents
import Photos
import SwiftUI
import UserNotifications

/// One system permission, as the app holds it now.
enum Permission: String, CaseIterable {
  case camera, microphone, location, photos, notifications

  /// `notDetermined`, `granted`, `limited`, `denied` or `restricted`.
  @MainActor
  func status() async -> String {
    switch self {
    case .camera: return Self.name(of: AVCaptureDevice.authorizationStatus(for: .video))
    case .microphone: return Self.name(of: AVCaptureDevice.authorizationStatus(for: .audio))
    case .location: return Self.name(of: CLLocationManager().authorizationStatus)
    case .photos: return Self.name(of: PHPhotoLibrary.authorizationStatus(for: .readWrite))
    case .notifications:
      return Self.name(of: await UNUserNotificationCenter.current().notificationSettings().authorizationStatus)
    }
  }

  /// Shows the system prompt, once; after that iOS answers with the stored choice.
  @MainActor
  func request() async -> String {
    switch self {
    case .camera: _ = await AVCaptureDevice.requestAccess(for: .video)
    case .microphone: _ = await AVCaptureDevice.requestAccess(for: .audio)
    case .location: await LocationAuthorization.shared.request()
    case .photos: _ = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
    case .notifications:
      _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
    }
    return await status()
  }

  static func name(of status: AVAuthorizationStatus) -> String {
    switch status {
    case .authorized: "granted"
    case .denied: "denied"
    case .restricted: "restricted"
    default: "notDetermined"
    }
  }

  static func name(of status: CLAuthorizationStatus) -> String {
    switch status {
    case .authorizedAlways, .authorizedWhenInUse: "granted"
    case .denied: "denied"
    case .restricted: "restricted"
    default: "notDetermined"
    }
  }

  static func name(of status: PHAuthorizationStatus) -> String {
    switch status {
    case .authorized: "granted"
    case .limited: "limited"
    case .denied: "denied"
    case .restricted: "restricted"
    default: "notDetermined"
    }
  }

  static func name(of status: UNAuthorizationStatus) -> String {
    switch status {
    case .authorized, .provisional, .ephemeral: "granted"
    case .denied: "denied"
    default: "notDetermined"
    }
  }
}

/// Asks for location while in use and waits for the answer, which arrives on
/// the delegate rather than as a return value.
@MainActor
final class LocationAuthorization: NSObject, CLLocationManagerDelegate {
  static let shared = LocationAuthorization()

  private let manager = CLLocationManager()
  private var waiting: [CheckedContinuation<Void, Never>] = []

  override init() {
    super.init()
    manager.delegate = self
  }

  func request() async {
    guard manager.authorizationStatus == .notDetermined else { return }
    await withCheckedContinuation { continuation in
      waiting.append(continuation)
      manager.requestWhenInUseAuthorization()
    }
  }

  nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    let status = manager.authorizationStatus
    MainActor.assumeIsolated {
      guard status != .notDetermined else { return }
      let resumed = waiting
      waiting.removeAll()
      resumed.forEach { $0.resume() }
    }
  }
}

/// The button a permission row ends in: Allow while iOS has not asked yet,
/// the answer once it has, and a way to Settings when it was denied. The
/// status lives as state, so the page reads what the system says.
struct PermissionView: View {
  @ObservedObject var component: NativeComponentContext
  @State private var status: String?
  @State private var asking = false

  var body: some View {
    let permission = Permission(rawValue: component.props.string("kind") ?? "") ?? .camera
    Group {
      switch status {
      case nil:
        ProgressView()
      case "notDetermined":
        Button("Allow") {
          asking = true
          Task {
            update(await permission.request())
            asking = false
          }
        }
        .glassProminentButtonStyle()
        .disabled(asking)
      case "denied":
        Button("Settings") {
          if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
          }
        }
        .glassButtonStyle()
      default:
        Label(
          status == "limited" ? "Limited" : status == "restricted" ? "Restricted" : "Allowed",
          systemImage: status == "restricted" ? "lock.fill" : "checkmark.circle.fill"
        )
          .labelStyle(.titleAndIcon)
          .foregroundStyle(status == "restricted" ? Color.secondary : Color.green)
          .font(.body.weight(.medium))
      }
    }
    .tint(component.props.color("tint"))
    .fixedSize()
    .task(id: permission) { update(await permission.status()) }
    .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
      Task { update(await permission.status()) }
    }
  }

  private func update(_ next: String) {
    status = next
    component.setState(["status": next])
  }
}
