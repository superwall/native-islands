import NativeIslands
import SwiftUI

/// A navigation bar the page drives: a glass Back button while `showsBack`,
/// the inline title, and `leading` and `trailing` bar items. It stays put as
/// screens slide under it, as `UINavigationBar` does, and animates its items
/// when the page changes them. `back` and `select` go to the page; the page
/// pushes and pops its own screens.
///
/// Pages written for the first version can still pass `items`, `systemImage`
/// and `menuLabel` for a single trailing menu.
struct NavigationBarView: View {
  @ObservedObject var component: NativeComponentContext

  private static let button: CGFloat = 44

  var body: some View {
    let props = component.props
    let showsBack = props.bool("showsBack") == true
    let title = props.string("title") ?? ""
    let titleShown = props.bool("titleShown") != false
    let leading = BarItem.list(props["leading"])
    let trailing = trailingItems(props)
    let select: @MainActor (String) -> Void = { [component] in component.emit("select", payload: ["id": $0]) }
    GlassGroup(spacing: 8) {
      HStack(spacing: 8) {
        HStack(spacing: 8) {
          if showsBack {
            Button {
              component.emit("back")
            } label: {
              HStack(spacing: 4) {
                Image(systemName: "chevron.left")
                  .font(.system(size: 19, weight: .semibold))
                if let back = props.string("backTitle"), !back.isEmpty {
                  Text(back).font(.body).lineLimit(1)
                }
              }
              .padding(.horizontal, props.string("backTitle")?.isEmpty == false ? 12 : 0)
              .frame(minWidth: Self.button, minHeight: Self.button)
              .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .glassOrMaterial(in: Capsule())
            .accessibilityLabel("Back")
            .transition(.opacity.combined(with: .scale(scale: 0.6)))
          }
          BarItemsView(items: leading, select: select, height: Self.button)
        }
        .frame(minWidth: Self.button, maxWidth: .infinity, alignment: .leading)
        Text(title)
          .font(.headline)
          .lineLimit(1)
          .fixedSize()
          .opacity(titleShown ? 1 : 0)
          .id(title)
          .transition(.opacity)
          .accessibilityAddTraits(.isHeader)
          .accessibilityHidden(!titleShown)
        BarItemsView(items: trailing, select: select, height: Self.button)
          .frame(minWidth: Self.button, maxWidth: .infinity, alignment: .trailing)
      }
      .foregroundStyle(Color.primary)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    .tint(props.color("tint"))
    .animation(.smoothly(duration: 0.35), value: showsBack)
    .animation(.easeInOut(duration: 0.2), value: title)
    .animation(.easeInOut(duration: 0.15), value: titleShown)
  }

  private func trailingItems(_ props: NativeComponentProps) -> [BarItem] {
    if props["trailing"] != nil { return BarItem.list(props["trailing"]) }
    guard let items = props["items"] as? [Any] else { return [] }
    let menu: [String: Any] = [
      "id": "menu",
      "kind": "menu",
      "title": "",
      "systemImage": props.string("systemImage") ?? "ellipsis",
      "items": items
    ]
    return BarItem(menu).map { [$0] } ?? []
  }
}
