import NativeIslands
import SwiftUI
import UIKit
import WebKit

/// A native presentation of another page: a `sheet` (with `detents`, a
/// `grabber` and interactive dismiss unless `dismissible` is false), a
/// `fullScreenCover`, a `popover` anchored to the element, or an
/// `inspector`, which is a sheet on iPhone and a form sheet on iPad. `url` is
/// read relative to the presenting page.
///
/// Sheets, covers and inspectors get a system navigation bar with `title`
/// and a Done button (no Done when `dismissible` is false); `header: false`
/// leaves the whole page to the presented page. `background` colours the
/// presentation while its page loads, so nothing flashes white.
///
/// The page opens and closes it with `open`. A user dismissal (a swipe, a tap
/// outside or Done) sets `open` to false and sends `dismiss` with
/// `reason: "user"`; the presented page can close it too (`reason: "page"`
/// and its `result`), move it to another detent and send `message`s up;
/// `post` sends data down to it.
struct PresentationView: UIViewRepresentable {
  @ObservedObject var component: NativeComponentContext

  func makeCoordinator() -> Coordinator { Coordinator(component: component) }

  func makeUIView(context: Context) -> AnchorView {
    let anchor = AnchorView()
    context.coordinator.anchor = anchor
    let coordinator = context.coordinator
    component.onCommand { [weak coordinator] name, args in
      switch name {
      case "post": coordinator?.page?.post(args)
      default: throw NativeComponentError.refused("Unknown command \(name).")
      }
      return nil
    }
    return anchor
  }

  func updateUIView(_ anchor: AnchorView, context: Context) {
    context.coordinator.component = component
    // The anchor joins the web view only after this pass.
    DispatchQueue.main.async { context.coordinator.update() }
  }

  static func dismantleUIView(_ anchor: AnchorView, coordinator: Coordinator) {
    coordinator.close(animated: true, report: false)
  }

  @MainActor
  final class Coordinator: NSObject, UISheetPresentationControllerDelegate, UIPopoverPresentationControllerDelegate {
    var component: NativeComponentContext
    weak var anchor: AnchorView?
    private(set) var page: PresentedPageController?
    private var shown: UIViewController?
    private var shownStyle: String?
    private var applied: [String: String] = [:]

    init(component: NativeComponentContext) {
      self.component = component
    }

    private var props: NativeComponentProps { component.props }

    func update() {
      // Once shown, only `open` closes it: the presenting page's islands can
      // report themselves hidden while a sheet covers them, and that must
      // never close it.
      guard props.bool("open") == true else {
        if page != nil { close(animated: true, report: false) }
        return
      }
      if let page {
        if let url = resolvedURL() { page.load(url) }
        configure(page)
        return
      }
      guard component.isVisible else { return }
      present()
    }

    private func resolvedURL() -> URL? {
      guard let string = props.string("url") else { return nil }
      return URL(string: string, relativeTo: anchor?.enclosingWebView?.url)?.absoluteURL
    }

    private var presenterHost: NativeIslandsHost? {
      anchor?.enclosingWebView.flatMap(NativeIslandsHost.of)
    }

    private func present() {
      guard let anchor, let webView = anchor.enclosingWebView, let url = resolvedURL(),
        let front = anchor.frontController
      else { return }
      let style = props.string("style") ?? "sheet"
      let page = PresentedPageController(
        url: url,
        configuration: webView.configuration,
        style: style,
        background: props.uiColor("background")
      )
      page.webView.islands?.showsOutlines = presenterHost?.showsOutlines ?? false
      page.onDismissRequest = { [weak self] result in
        self?.close(animated: true, report: true, reason: "page", result: result)
      }
      page.onMessage = { [weak self] data in self?.component.emit("message", payload: ["data": data ?? NSNull()]) }
      page.onDetentRequest = { [weak self] name in self?.select(detent: name) }
      page.onDone = { [weak self] in self?.close(animated: true, report: true, reason: "user") }
      shownStyle = style
      applied = [:]
      let header = props.bool("header") ?? (style != "popover")
      let shown: UIViewController = header ? PresentationNavigationController(rootViewController: page) : page
      // Opaque under the transparent bar too: a cover leaves the presenting
      // page in place behind it.
      shown.view.backgroundColor = props.uiColor("background") ?? .systemGroupedBackground
      switch style {
      case "fullScreenCover":
        // Over, not instead of, the presenting page: `.fullScreen` takes the
        // presenting web view out of the window, and its islands with it.
        shown.modalPresentationStyle = .overFullScreen
      case "popover":
        shown.modalPresentationStyle = .popover
        shown.preferredContentSize = CGSize(
          width: props.double("width") ?? 320,
          height: props.double("height") ?? 360
        )
        shown.popoverPresentationController?.sourceView = anchor
        shown.popoverPresentationController?.sourceRect = anchor.bounds
        shown.popoverPresentationController?.delegate = self
      case "inspector" where anchor.traitCollection.horizontalSizeClass == .regular:
        shown.modalPresentationStyle = .formSheet
      default:
        shown.modalPresentationStyle = .pageSheet
      }
      shown.presentationController?.delegate = self
      self.page = page
      self.shown = shown
      configure(page)
      front.present(shown, animated: true)
    }

    /// Applies the props that changed since the last pass, so a re-render of
    /// the presenting page never resets a sheet the person is dragging.
    private func configure(_ page: PresentedPageController) {
      func changed(_ key: String, _ value: String) -> Bool {
        guard applied[key] != value else { return false }
        applied[key] = value
        return true
      }
      let dismissible = props.bool("dismissible") != false
      if changed("dismissible", "\(dismissible)") {
        shown?.isModalInPresentation = !dismissible
        page.showsDone = dismissible
      }
      if changed("title", props.string("title") ?? "") { page.title = props.string("title") }
      guard let sheet = shown?.sheetPresentationController else { return }
      sheet.delegate = self
      let names = props.strings("detents") ?? (shownStyle == "inspector" ? ["medium", "large"] : ["large"])
      let grabber = props.bool("grabber") ?? (names.count > 1)
      let shape = "\(names)|\(grabber)|\(props.bool("undimmed") == true)|\(props.double("cornerRadius") ?? -1)"
      if changed("shape", shape) {
        let detents = names.compactMap(Self.detent)
        sheet.animateChanges {
          sheet.detents = detents.isEmpty ? [.large()] : detents
          sheet.prefersGrabberVisible = grabber
          sheet.prefersScrollingExpandsWhenScrolledToEdge = props.bool("expandsOnScroll") ?? true
          if let radius = props.double("cornerRadius") { sheet.preferredCornerRadius = radius }
          if props.bool("undimmed") == true {
            // Dims nothing up to the tallest detent but the full height.
            let tallest = names.last.map(Self.identifier) ?? .large
            sheet.largestUndimmedDetentIdentifier = tallest == .large ? .medium : tallest
          } else {
            sheet.largestUndimmedDetentIdentifier = nil
          }
        }
      }
      if let selected = props.string("selectedDetent"), changed("selected", selected),
        sheet.selectedDetentIdentifier != Self.identifier(selected) {
        sheet.animateChanges { sheet.selectedDetentIdentifier = Self.identifier(selected) }
      }
      page.detent = Self.name(of: sheet.selectedDetentIdentifier) ?? names.first ?? "large"
    }

    private func select(detent name: String) {
      guard let sheet = shown?.sheetPresentationController else { return }
      if #available(iOS 16.0, *), !sheet.detents.contains(where: { $0.identifier == Self.identifier(name) }) {
        return
      }
      sheet.animateChanges { sheet.selectedDetentIdentifier = Self.identifier(name) }
      sheetPresentationControllerDidChangeSelectedDetentIdentifier(sheet)
    }

    /// `medium`, `large`, or a height in points such as `"240"`.
    static func detent(_ name: String) -> UISheetPresentationController.Detent? {
      switch name {
      case "medium": return .medium()
      case "large": return .large()
      default:
        guard let height = Double(name), height > 0 else { return nil }
        if #available(iOS 16.0, *) {
          return .custom(identifier: identifier(name)) { _ in height }
        }
        return .medium()
      }
    }

    static func identifier(_ name: String) -> UISheetPresentationController.Detent.Identifier {
      switch name {
      case "medium": return .medium
      case "large": return .large
      default: return .init(name)
      }
    }

    static func name(of identifier: UISheetPresentationController.Detent.Identifier?) -> String? {
      guard let identifier else { return nil }
      switch identifier {
      case .medium: return "medium"
      case .large: return "large"
      default: return identifier.rawValue
      }
    }

    func close(animated: Bool, report: Bool, reason: String = "page", result: Any? = nil) {
      guard let page else { return }
      let shown = self.shown
      self.page = nil
      self.shown = nil
      page.close()
      if let shown, shown.presentingViewController != nil, !shown.isBeingDismissed {
        shown.presentingViewController?.dismiss(animated: animated)
      }
      guard report else { return }
      component.setState(["open": false])
      component.emit("dismiss", payload: ["reason": reason, "result": result ?? NSNull()])
    }

    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
      guard let page, presentationController.presentedViewController === shown else { return }
      self.page = nil
      shown = nil
      page.close()
      component.setState(["open": false])
      component.emit("dismiss", payload: ["reason": "user", "result": NSNull()])
    }

    func sheetPresentationControllerDidChangeSelectedDetentIdentifier(
      _ sheet: UISheetPresentationController
    ) {
      guard let name = Self.name(of: sheet.selectedDetentIdentifier) else { return }
      applied["selected"] = name
      page?.detent = name
      component.setState(["selectedDetent": name])
    }

    func adaptivePresentationStyle(
      for controller: UIPresentationController,
      traitCollection: UITraitCollection
    ) -> UIModalPresentationStyle {
      // A popover stays a popover on iPhone, as with SwiftUI's
      // `presentationCompactAdaptation(.popover)`, unless the page asks for a sheet.
      props.string("compact") == "sheet" ? .pageSheet : .none
    }
  }
}

/// The navigation controller around a presented page, so it gets the system
/// sheet header: the title and Done in a real navigation bar.
final class PresentationNavigationController: UINavigationController {
  override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
    presentingViewController?.supportedInterfaceOrientations ?? .all
  }
}

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
