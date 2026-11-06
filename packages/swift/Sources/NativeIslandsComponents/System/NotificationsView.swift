import NativeIslands
import SwiftUI
import UserNotifications

/// Local notifications, scheduled by the page, with no view of its own.
/// Commands: `requestAuthorization` (answers the status), `schedule` (`id`,
/// `title`, `subtitle`, `body`, and `after` seconds or a local `date` as
/// `yyyy-MM-ddTHH:mm`, `repeats`, `sound`, `badge`, `data`), `cancel` (`ids`),
/// `cancelAll`, `pending` (the ids still to come) and `setBadge` (`count`).
/// `status` flows as state. A notification the person taps sends `open`
/// with its id and `data`; one arriving while the app is open sends `deliver`
/// and shows as a banner. Push notifications need a server and are not here.
struct NotificationsView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    Color.clear
      .allowsHitTesting(false)
      .accessibilityHidden(true)
      .onAppear {
        NotificationRelay.shared.add(component)
        Task { component.setState(["status": await Self.status()]) }
        component.onCommand { [component] name, args in
          let args = args as? [String: Any] ?? [:]
          let center = UNUserNotificationCenter.current()
          switch name {
          case "requestAuthorization":
            var options: UNAuthorizationOptions = [.alert, .sound, .badge]
            if args["provisional"] as? Bool == true { options.insert(.provisional) }
            _ = try? await center.requestAuthorization(options: options)
            let status = await Self.status()
            component.setState(["status": status])
            return ["status": status]
          case "schedule":
            guard let request = Self.request(args) else {
              throw NativeComponentError.refused("A notification needs an id and a title.")
            }
            try await center.add(request)
            return nil
          case "cancel":
            let ids = args["ids"] as? [String] ?? []
            center.removePendingNotificationRequests(withIdentifiers: ids)
            center.removeDeliveredNotifications(withIdentifiers: ids)
            return nil
          case "cancelAll":
            center.removeAllPendingNotificationRequests()
            return nil
          case "pending":
            return ["ids": await center.pendingNotificationRequests().map(\.identifier)]
          case "setBadge":
            let count = (args["count"] as? NSNumber)?.intValue ?? 0
            if #available(iOS 16.0, *) {
              try await center.setBadgeCount(count)
            } else {
              UIApplication.shared.applicationIconBadgeNumber = count
            }
            return nil
          default:
            throw NativeComponentError.refused("Unknown command \(name).")
          }
        }
      }
      .onDisappear { NotificationRelay.shared.remove(component) }
  }

  static func status() async -> String {
    switch await UNUserNotificationCenter.current().notificationSettings().authorizationStatus {
    case .authorized: "granted"
    case .provisional, .ephemeral: "limited"
    case .denied: "denied"
    default: "notDetermined"
    }
  }

  static func request(_ args: [String: Any]) -> UNNotificationRequest? {
    guard let id = args["id"] as? String, let title = args["title"] as? String else { return nil }
    let content = UNMutableNotificationContent()
    content.title = title
    content.subtitle = args["subtitle"] as? String ?? ""
    content.body = args["body"] as? String ?? ""
    if args["sound"] as? Bool != false { content.sound = .default }
    if let badge = args["badge"] as? NSNumber { content.badge = NSNumber(value: badge.intValue) }
    if let thread = args["threadId"] as? String { content.threadIdentifier = thread }
    if let data = args["data"] { content.userInfo = ["nativeIslands": data] }
    let repeats = args["repeats"] as? Bool ?? false
    let trigger: UNNotificationTrigger
    if let date = (args["date"] as? String).flatMap(DatePickerView.format.date(from:)) {
      let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
      trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: repeats)
    } else {
      let after = max((args["after"] as? NSNumber)?.doubleValue ?? 1, repeats ? 60 : 1)
      trigger = UNTimeIntervalNotificationTrigger(timeInterval: after, repeats: repeats)
    }
    return UNNotificationRequest(identifier: id, content: content, trigger: trigger)
  }
}

/// Becomes the notification centre's delegate when the app has none, to show
/// banners while the app is open and tell pages which notification was tapped.
@MainActor
final class NotificationRelay: NSObject, UNUserNotificationCenterDelegate {
  static let shared = NotificationRelay()
  private var components: [WeakComponent] = []

  private struct WeakComponent { weak var component: NativeComponentContext? }

  func add(_ component: NativeComponentContext) {
    components.removeAll { $0.component == nil || $0.component === component }
    components.append(WeakComponent(component: component))
    let center = UNUserNotificationCenter.current()
    if center.delegate == nil { center.delegate = self }
  }

  func remove(_ component: NativeComponentContext) {
    components.removeAll { $0.component == nil || $0.component === component }
  }

  private func send(_ event: String, _ notification: UNNotification) {
    let payload: [String: Any] = [
      "id": notification.request.identifier,
      "data": notification.request.content.userInfo["nativeIslands"] ?? NSNull()
    ]
    for entry in components { entry.component?.emit(event, payload: payload) }
  }

  nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification
  ) async -> UNNotificationPresentationOptions {
    await MainActor.run { send("deliver", notification) }
    return [.banner, .list, .sound]
  }

  nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse
  ) async {
    await MainActor.run { send("open", response.notification) }
  }
}
