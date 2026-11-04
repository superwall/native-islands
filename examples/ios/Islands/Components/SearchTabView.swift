import NativeIslands
import SwiftUI

/// The Search tab beside the tab bar: a glass circle whose symbol matches the
/// bar's items, tinted like a selected tab while Search is showing.
@available(iOS 26.0, *)
struct SearchTabView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let props = component.props
    let selected = props.bool("selected") == true
    Button {
      component.emit("press")
    } label: {
      Image(systemName: "magnifyingglass")
        .font(.system(size: 24, weight: .medium))
        .foregroundStyle(selected ? props.color("tint") ?? .accentColor : .primary)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Circle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Search")
    .accessibilityAddTraits(selected ? .isSelected : [])
  }
}
