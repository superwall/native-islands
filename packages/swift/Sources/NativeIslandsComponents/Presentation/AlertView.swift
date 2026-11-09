import NativeIslands
import SwiftUI
import UIKit

/// A system alert or confirmation dialog built from props: `title`,
/// `message`, `buttons` with roles (`cancel`, `destructive`) and optional
/// `textFields`. `open` shows it; a button closes it, sets `open` to false and
/// sends `action` with the button's id and what was typed.
struct AlertView: UIViewRepresentable {
  @ObservedObject var component: NativeComponentContext

  func makeCoordinator() -> Coordinator { Coordinator(component: component) }

  func makeUIView(context: Context) -> AnchorView {
    let anchor = AnchorView()
    context.coordinator.anchor = anchor
    return anchor
  }

  func updateUIView(_ anchor: AnchorView, context: Context) {
    context.coordinator.component = component
    DispatchQueue.main.async { context.coordinator.update() }
  }

  static func dismantleUIView(_ anchor: AnchorView, coordinator: Coordinator) {
    coordinator.alert?.presentingViewController?.dismiss(animated: false)
  }

  @MainActor
  final class Coordinator {
    var component: NativeComponentContext
    weak var anchor: AnchorView?
    private(set) var alert: UIAlertController?

    init(component: NativeComponentContext) {
      self.component = component
    }

    func update() {
      let props = component.props
      let open = props.bool("open") == true && component.isVisible
      if !open {
        if let alert {
          self.alert = nil
          alert.presentingViewController?.dismiss(animated: true)
        }
        return
      }
      guard alert == nil, let anchor, let front = anchor.frontController else { return }
      let dialog = props.string("style") == "confirmationDialog"
      let title = props.string("title")
      let message = props.string("message")
      let alert = UIAlertController(
        title: title?.isEmpty == false ? title : nil,
        message: message?.isEmpty == false ? message : nil,
        preferredStyle: dialog ? .actionSheet : .alert
      )
      let fields = dialog ? [] : (props["textFields"] as? [Any] ?? []).compactMap { $0 as? [String: Any] }
      for field in fields {
        alert.addTextField { text in
          text.placeholder = field["placeholder"] as? String
          text.text = field["text"] as? String
          text.isSecureTextEntry = field["secure"] as? Bool ?? false
        }
      }
      var buttons = (props["buttons"] as? [Any] ?? []).compactMap { $0 as? [String: Any] }
      if buttons.isEmpty { buttons = [["id": "ok", "title": "OK", "role": "cancel"]] }
      for button in buttons {
        let id = button["id"] as? String ?? button["title"] as? String ?? "ok"
        let style: UIAlertAction.Style = switch button["role"] as? String {
        case "cancel": .cancel
        case "destructive": .destructive
        default: .default
        }
        let action = UIAlertAction(title: button["title"] as? String ?? id, style: style) { [weak self, weak alert] _ in
          self?.chose(id, in: alert, fields: fields)
        }
        alert.addAction(action)
        if button["preferred"] as? Bool == true { alert.preferredAction = action }
      }
      alert.view.tintColor = props.uiColor("tint")
      alert.popoverPresentationController?.sourceView = anchor
      alert.popoverPresentationController?.sourceRect = anchor.bounds
      self.alert = alert
      front.present(alert, animated: true)
    }

    private func chose(_ id: String, in alert: UIAlertController?, fields: [[String: Any]]) {
      var values: [String: Any] = [:]
      for (index, field) in fields.enumerated() {
        let key = field["id"] as? String ?? String(index)
        values[key] = alert?.textFields?[safe: index]?.text ?? ""
      }
      self.alert = nil
      component.setState(["open": false])
      component.emit("action", payload: ["id": id, "values": values])
    }
  }
}

extension Array {
  subscript(safe index: Int) -> Element? {
    indices.contains(index) ? self[index] : nil
  }
}
