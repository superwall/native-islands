import NativeIslands
import SwiftUI

/// The navigation bar of iOS 26 over every screen: a glass Back button while
/// the stack can go back, the inline title, and the View Mode menu. It stays
/// put as screens slide under it, as UINavigationBar does, and animates its
/// items when the page changes them. `back` and `select` go to the page.
@available(iOS 26.0, *)
struct NavigationBarView: View {
  @ObservedObject var component: NativeComponentContext

  private static let button: CGFloat = 44

  var body: some View {
    let props = component.props
    let showsBack = props.bool("showsBack") == true
    let title = props.string("title") ?? ""
    let titleShown = props.bool("titleShown") != false
    let items = (props["items"] as? [Any] ?? []).compactMap(MenuView.Item.init)
    GlassEffectContainer(spacing: 8) {
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
            .glassEffect(.regular.interactive(), in: .circle)
            .accessibilityLabel("Back")
            .transition(.blurReplace.combined(with: .scale(0.6)))
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
        .glassEffect(.regular.interactive(), in: .circle)
        .accessibilityLabel(props.string("menuLabel") ?? "More")
      }
      .foregroundStyle(Color.primary)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    .animation(.smooth(duration: 0.35), value: showsBack)
    .animation(.easeInOut(duration: 0.2), value: title)
    .animation(.easeInOut(duration: 0.15), value: titleShown)
  }
}
