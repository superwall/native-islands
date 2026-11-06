import NativeIslands
import SwiftUI
import UIKit
import WebKit

/// Native interactions over an element of the page, which stays the web
/// element: its native view is clear and only takes the touches.
///
/// - With `items`, a long press opens a system context menu, lifting a
///   snapshot of the element as its preview; a choice sends `select`.
/// - With `longPress`, a press held for `minimumDuration` seconds plays a
///   haptic and sends `longPress`.
/// - A tap sends `press`, since the element under it no longer gets it.
struct InteractionView: UIViewRepresentable {
  @ObservedObject var component: NativeComponentContext

  func makeCoordinator() -> Coordinator { Coordinator(component: component) }

  func makeUIView(context: Context) -> UIView {
    let view = UIView()
    view.backgroundColor = .clear
    let coordinator = context.coordinator
    coordinator.view = view
    let tap = UITapGestureRecognizer(target: coordinator, action: #selector(Coordinator.tapped))
    view.addGestureRecognizer(tap)
    let hold = UILongPressGestureRecognizer(target: coordinator, action: #selector(Coordinator.held(_:)))
    coordinator.hold = hold
    view.addGestureRecognizer(hold)
    return view
  }

  func updateUIView(_ view: UIView, context: Context) {
    let coordinator = context.coordinator
    coordinator.component = component
    let props = component.props
    let hasMenu = !(props["items"] as? [Any] ?? []).isEmpty
    if hasMenu, coordinator.menu == nil {
      let menu = UIContextMenuInteraction(delegate: coordinator)
      coordinator.menu = menu
      view.addInteraction(menu)
    } else if !hasMenu, let menu = coordinator.menu {
      view.removeInteraction(menu)
      coordinator.menu = nil
    }
    coordinator.hold?.isEnabled = props.bool("longPress") == true && !hasMenu
    coordinator.hold?.minimumPressDuration = props.double("minimumDuration") ?? 0.5
    view.accessibilityLabel = component.accessibility?.label
  }

  @MainActor
  final class Coordinator: NSObject, UIContextMenuInteractionDelegate {
    var component: NativeComponentContext
    weak var view: UIView?
    var menu: UIContextMenuInteraction?
    var hold: UILongPressGestureRecognizer?

    init(component: NativeComponentContext) {
      self.component = component
    }

    @objc func tapped() {
      component.emit("press")
    }

    @objc func held(_ gesture: UILongPressGestureRecognizer) {
      guard gesture.state == .began else { return }
      if component.props.string("haptic") != "none" {
        HapticButtonView.play(component.props.string("haptic") ?? "medium")
      }
      component.emit("longPress")
    }

    func contextMenuInteraction(
      _ interaction: UIContextMenuInteraction,
      configurationForMenuAtLocation location: CGPoint
    ) -> UIContextMenuConfiguration? {
      let props = component.props
      let items = (props["items"] as? [Any] ?? []).compactMap(MenuView.Item.init)
      component.emit("longPress")
      return UIContextMenuConfiguration(identifier: nil, previewProvider: nil) { [weak self] _ in
        let children = Self.elements(items) { self?.component.emit("select", payload: ["id": $0]) }
        return UIMenu(title: props.string("title") ?? "", children: children)
      }
    }

    func contextMenuInteraction(
      _ interaction: UIContextMenuInteraction,
      configuration: UIContextMenuConfiguration,
      highlightPreviewForItemWithIdentifier identifier: any NSCopying
    ) -> UITargetedPreview? {
      preview()
    }

    func contextMenuInteraction(
      _ interaction: UIContextMenuInteraction,
      previewForHighlightingMenuWithConfiguration configuration: UIContextMenuConfiguration
    ) -> UITargetedPreview? {
      preview()
    }

    /// A snapshot of the element as the page draws it, lifted from where it sits.
    private func preview() -> UITargetedPreview? {
      guard let view, let webView = view.enclosingWebView, view.window != nil else { return nil }
      let rect = view.convert(view.bounds, to: webView)
      guard let snapshot = webView.resizableSnapshotView(from: rect, afterScreenUpdates: false, withCapInsets: .zero)
      else { return nil }
      let parameters = UIPreviewParameters()
      let radius = component.props.double("cornerRadius") ?? 12
      parameters.visiblePath = UIBezierPath(roundedRect: view.bounds, cornerRadius: radius)
      parameters.backgroundColor = .clear
      let target = UIPreviewTarget(container: view, center: CGPoint(x: view.bounds.midX, y: view.bounds.midY))
      return UITargetedPreview(view: snapshot, parameters: parameters, target: target)
    }

    static func elements(_ items: [MenuView.Item], select: @escaping @MainActor (String) -> Void) -> [UIMenuElement] {
      items.map { item in
        let image = item.systemImage.flatMap { UIImage(systemName: $0) }
        if !item.children.isEmpty {
          return UIMenu(title: item.title, image: image, children: elements(item.children, select: select))
        }
        let action = UIAction(title: item.title, image: image) { _ in
          MainActor.assumeIsolated { select(item.id) }
        }
        if item.destructive { action.attributes = .destructive }
        if item.checked == true { action.state = .on }
        return action
      }
    }
  }
}

/// A system material filling the island: `ultraThin`, `thin`, `regular`,
/// `thick`, `ultraThick` and `bar` are SwiftUI materials; `glass` and
/// `clearGlass` are Liquid Glass on iOS 26 and the regular material before.
/// `cornerRadius` rounds it. Islands draw above the page, so what sits on the
/// material is drawn here, in its vibrant colours: `systemImage`, `title`
/// and `subtitle`.
struct MaterialView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let props = component.props
    let shape = RoundedRectangle(cornerRadius: props.double("cornerRadius") ?? 0, style: .continuous)
    Group {
      switch props.string("material") {
      case "glass", "clearGlass":
        // The host draws the glass around this island.
        Color.clear
      default:
        shape.fill(Self.material(props.string("material")))
      }
    }
    .overlay {
      if let tint = props.color("tint") { shape.fill(tint) }
    }
    .overlay {
      VStack(spacing: 2) {
        if let symbol = props.string("systemImage") {
          Image(systemName: symbol).font(.title2)
        }
        if let title = props.string("title") {
          Text(title).font(.subheadline.weight(.semibold))
        }
        if let subtitle = props.string("subtitle") {
          Text(subtitle).font(.footnote).foregroundStyle(.secondary)
        }
      }
      .foregroundStyle(.primary)
      .multilineTextAlignment(.center)
      .padding(8)
    }
    .allowsHitTesting(false)
  }

  static func material(_ name: String?) -> Material {
    switch name {
    case "ultraThin": .ultraThinMaterial
    case "thin": .thinMaterial
    case "thick": .thickMaterial
    case "ultraThick": .ultraThickMaterial
    case "bar": .bar
    default: .regularMaterial
    }
  }

  @MainActor
  static func glass(_ props: NativeComponentProps) -> NativeGlass? {
    let name = props.string("material")
    guard name == "glass" || name == "clearGlass" else { return nil }
    return NativeGlass(
      style: name == "clearGlass" ? .clear : .regular,
      shape: .rounded(CGFloat(props.double("cornerRadius") ?? 0)),
      tint: props.uiColor("glassTint"),
      isInteractive: false
    )
  }
}
