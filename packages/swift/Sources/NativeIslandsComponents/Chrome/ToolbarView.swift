import NativeIslands
import SwiftUI

/// A toolbar the page lays out from `items`: buttons and menus grouped on
/// glass the way iOS 26 groups toolbar items, with `spacer` and
/// `flexibleSpace` between groups. Use it along the top, the bottom or
/// anywhere on the page; a tap sends `select` with the item's id.
struct ToolbarView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let props = component.props
    GlassGroup(spacing: 8) {
      BarItemsView(
        items: BarItem.list(props["items"]),
        select: { [component] in component.emit("select", payload: ["id": $0]) },
        height: CGFloat(props.double("itemHeight") ?? 44)
      )
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    .tint(props.color("tint"))
  }
}

/// The bottom accessory of an iOS 26 tab view: a glass capsule above the tab
/// bar with a symbol, a title and subtitle, and buttons, such as a mini
/// player. A tap on it sends `press`, a button `action` with its id.
struct TabAccessoryView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let props = component.props
    let actions = BarItem.list(props["actions"])
    HStack(spacing: 10) {
      Button {
        component.emit("press")
      } label: {
        HStack(spacing: 10) {
          if let symbol = props.string("systemImage") {
            Image(systemName: symbol)
              .font(.system(size: 17, weight: .semibold))
              .frame(width: 32, height: 32)
              .background(RoundedRectangle(cornerRadius: 7, style: .continuous).fill(.quaternary))
          }
          VStack(alignment: .leading, spacing: 0) {
            Text(props.string("title") ?? "")
              .font(.subheadline.weight(.semibold))
              .lineLimit(1)
            if let subtitle = props.string("subtitle"), !subtitle.isEmpty {
              Text(subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
          }
          Spacer(minLength: 0)
        }
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      ForEach(actions) { item in
        BarItemButton(item: item, height: 36, onTint: false) { [component] in
          component.emit("action", payload: ["id": $0])
        }
      }
    }
    .foregroundStyle(Color.primary)
    .padding(.leading, 12)
    .padding(.trailing, 6)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .tint(props.color("tint"))
  }
}
