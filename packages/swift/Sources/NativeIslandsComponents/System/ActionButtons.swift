import NativeIslands
import SwiftUI
import UIKit

/// A glass button that plays haptic feedback the moment it is pressed, with no
/// round trip to the page. `feedback` is an impact (`light`, `medium`, `heavy`,
/// `soft`, `rigid`), a notification (`success`, `warning`, `error`) or `selection`.
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
