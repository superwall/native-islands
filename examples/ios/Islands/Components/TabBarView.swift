import NativeIslands
import SwiftUI

/// The floating tab bar of iOS 26: the page sets its tabs and selection, and
/// a tap selects at once, before the page hears of it.
@available(iOS 26.0, *)
struct TabBarView: View {
  @ObservedObject var component: NativeComponentContext
  @State private var selected: Int?
  @Namespace private var selection

  var body: some View {
    let props = component.props
    let titles = props.strings("titles") ?? []
    let symbols = props.strings("symbols") ?? []
    let current = selected ?? props.int("selectedIndex") ?? 0
    let tint = props.color("tint") ?? .accentColor
    HStack(spacing: 0) {
      ForEach(Array(titles.enumerated()), id: \.offset) { index, title in
        Button {
          withAnimation(.spring(duration: 0.35, bounce: 0.2)) { selected = index }
          component.emit("select", payload: ["index": index])
        } label: {
          VStack(spacing: 2) {
            Image(systemName: symbols.indices.contains(index) ? symbols[index] : "circle")
              .font(.system(size: 22, weight: .medium))
              .frame(height: 28)
            Text(title)
              .font(.system(size: 10, weight: .semibold))
              .lineLimit(1)
          }
          .foregroundStyle(index == current ? tint : Color.primary)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .background {
            if index == current {
              Capsule()
                .fill(Color.primary.opacity(0.08))
                .matchedGeometryEffect(id: "selection", in: selection)
            }
          }
          .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(index == current ? .isSelected : [])
      }
    }
    .padding(4)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .onChange(of: props.int("selectedIndex")) { _, next in
      withAnimation(.spring(duration: 0.35, bounce: 0.2)) { selected = next }
    }
  }
}
