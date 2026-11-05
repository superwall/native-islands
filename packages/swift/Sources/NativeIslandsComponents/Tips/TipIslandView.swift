import NativeIslands
import SwiftUI
import TipKit

/// A tip the page writes: `id` names it, so TipKit remembers across launches
/// that it was closed, and `title`, `message`, `systemImage` and `actions`
/// (`[{ id, title }]`) are what it shows.
@available(iOS 17.0, *)
struct PageTip: Tip {
  let id: String
  let titleText: String
  let messageText: String?
  let symbol: String?
  let buttons: [(id: String, title: String)]

  init(props: NativeComponentProps) {
    id = props.string("id") ?? "tip"
    titleText = props.string("title") ?? ""
    messageText = props.string("message")
    symbol = props.string("systemImage")
    buttons = (props["actions"] as? [Any] ?? []).compactMap { value in
      guard let value = value as? [String: Any],
            let id = value["id"] as? String,
            let title = value["title"] as? String else { return nil }
      return (id, title)
    }
  }

  var title: Text { Text(titleText) }
  var message: Text? { messageText.map(Text.init) }
  var image: Image? { symbol.map { Image(systemName: $0) } }
  var actions: [Action] { buttons.map { Action(id: $0.id, title: $0.title) } }
}

/// TipKit's inline tip. It sends `action` with the button's id when one is
/// tapped and `dismiss` when it is closed, and keeps `shown` as state so the
/// page collapses its box once TipKit stops showing it; the `invalidate`
/// command closes it for good from the page. It fills the box the page gives it.
@available(iOS 17.0, *)
struct TipIslandView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let tip = PageTip(props: component.props)
    TipView(tip, arrowEdge: Self.edge(component.props.string("arrowEdge"))) { action in
      component.emit("action", payload: ["id": action.id])
    }
    .tint(component.props.color("tint"))
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    .id(tip.id)
    .task(id: tip.id) {
      for await shown in tip.shouldDisplayUpdates {
        component.setState(["shown": shown])
        if !shown, tip.status == .invalidated(.tipClosed) {
          component.emit("dismiss")
        }
      }
    }
    .onAppear {
      component.onCommand { name, _ in
        guard name == "invalidate" else { throw NativeComponentError.refused("Unknown command \(name).") }
        PageTip(props: component.props).invalidate(reason: .actionPerformed)
        return nil
      }
    }
  }

  static func edge(_ name: String?) -> Edge? {
    switch name {
    case "top": .top
    case "bottom": .bottom
    case "leading": .leading
    case "trailing": .trailing
    default: nil
    }
  }
}
