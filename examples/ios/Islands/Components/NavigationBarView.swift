import NativeIslands
import SwiftUI

/// The navigation bar over every screen: a glass Back button while
/// the stack can go back, the inline title, and the View Mode menu. It stays
/// put as screens slide under it, as UINavigationBar does, and animates its
/// items when the page changes them. `back` and `select` go to the page.
struct NavigationBarView: View {
  @ObservedObject var component: NativeComponentContext

  private static let button: CGFloat = 44

  var body: some View {
    let props = component.props
    let showsBack = props.bool("showsBack") == true
    let title = props.string("title") ?? ""
    let titleShown = props.bool("titleShown") != false
    let items = (props["items"] as? [Any] ?? []).compactMap(MenuView.Item.init)
    GlassGroup(spacing: 8) {
      HStack(spacing: 8) {
        ZStack(alignment: .leading) {
          if showsBack {
            Button {
              component.emit("back")
            } label: {
              Image(systemName: "chevron.left")
                .font(.system(size: 19, weight: .semibold))
                .frame(width: Self.button, height: Self.button)
                .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .glassOrMaterial(in: Circle())
            .accessibilityLabel("Back")
            .transition(.opacity.combined(with: .scale(scale: 0.6)))
          }
        }
        .frame(width: Self.button, alignment: .leading)
        Text(title)
          .font(.headline)
          .lineLimit(1)
          .frame(maxWidth: .infinity)
          .opacity(titleShown ? 1 : 0)
          .id(title)
          .transition(.opacity)
          .accessibilityAddTraits(.isHeader)
          .accessibilityHidden(!titleShown)
        Menu {
          MenuView.entries(items) { component.emit("select", payload: ["id": $0]) }
        } label: {
          Image(systemName: props.string("systemImage") ?? "ellipsis")
            .font(.system(size: 17, weight: .semibold))
            .frame(width: Self.button, height: Self.button)
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .menuOrder(.fixed)
        .glassOrMaterial(in: Circle())
        .accessibilityLabel(props.string("menuLabel") ?? "More")
      }
      .foregroundStyle(Color.primary)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    .animation(.smoothly(duration: 0.35), value: showsBack)
    .animation(.easeInOut(duration: 0.2), value: title)
    .animation(.easeInOut(duration: 0.15), value: titleShown)
  }
}
