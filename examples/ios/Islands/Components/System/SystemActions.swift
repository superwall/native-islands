import NativeIslands
import SwiftUI
import UIKit

/// Where an island presents a system sheet. Islands are hosted outside the
/// view controller tree, so they present from the window's frontmost controller.
enum Presenter {
  @MainActor
  static func front() -> UIViewController? {
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
@available(iOS 26.0, *)
struct GlassActionLabel: View {
  let props: NativeComponentProps

  var body: some View {
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

/// A glass button that plays haptic feedback the moment it is pressed, with no
/// round trip to the page. `feedback` is an impact (`light`, `medium`, `heavy`,
/// `soft`, `rigid`), a notification (`success`, `warning`, `error`) or `selection`.
@available(iOS 26.0, *)
struct HapticButtonView: View {
  @ObservedObject var component: NativeComponentContext

  static func play(_ feedback: String?) {
    let impacts: [String: UIImpactFeedbackGenerator.FeedbackStyle] = [
      "light": .light, "medium": .medium, "heavy": .heavy, "soft": .soft, "rigid": .rigid
    ]
    let notifications: [String: UINotificationFeedbackGenerator.FeedbackType] = [
      "success": .success, "warning": .warning, "error": .error
    ]
    if let style = feedback.flatMap({ impacts[$0] }) {
      UIImpactFeedbackGenerator(style: style).impactOccurred()
    } else if let type = feedback.flatMap({ notifications[$0] }) {
      UINotificationFeedbackGenerator().notificationOccurred(type)
    } else {
      UISelectionFeedbackGenerator().selectionChanged()
    }
  }

  var body: some View {
    Button {
      Self.play(component.props.string("feedback"))
      component.emit("press")
    } label: {
      GlassActionLabel(props: component.props)
    }
    .buttonStyle(.plain)
  }
}

/// A glass button that opens the system share sheet with the page's `text` and
/// `url`, and sends `complete` with the activity chosen, or `null` if cancelled.
@available(iOS 26.0, *)
struct ShareButtonView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    Button(action: share) {
      GlassActionLabel(props: component.props)
    }
    .buttonStyle(.plain)
    .background(SourceView(view: $source))
  }

  @State private var source: UIView?

  private func share() {
    let props = component.props
    var items: [Any] = []
    if let text = props.string("text"), !text.isEmpty { items.append(text) }
    if let url = props.string("url").flatMap(URL.init(string:)) { items.append(url) }
    guard !items.isEmpty, let front = Presenter.front() else { return }
    let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
    sheet.popoverPresentationController?.sourceView = source
    sheet.completionWithItemsHandler = { [component] activity, completed, _, _ in
      let chosen: Any = completed ? activity?.rawValue ?? "done" : NSNull()
      component.emit("complete", payload: ["activity": chosen])
    }
    front.present(sheet, animated: true)
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
