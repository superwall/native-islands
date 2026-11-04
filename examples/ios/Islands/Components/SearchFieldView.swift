import NativeIslands
import SwiftUI

/// The search field of an iOS 26 search tab, on a glass capsule: what the
/// user types flows to the page as state, so the page filters as they type.
struct SearchFieldView: View {
  @ObservedObject var component: NativeComponentContext
  @FocusState private var focused: Bool

  var body: some View {
    let props = component.props
    let text = props.string("text") ?? ""
    HStack(spacing: 6) {
      Image(systemName: "magnifyingglass")
        .foregroundStyle(.secondary)
      TextField(
        props.string("placeholder") ?? "Search",
        text: Binding(get: { component.props.string("text") ?? "" }, set: { component.setState(["text": $0]) })
      )
      .focused($focused)
      .submitLabel(.search)
      .autocorrectionDisabled()
      .textInputAutocapitalization(.never)
      .onSubmit { component.emit("submit", payload: ["text": component.props.string("text") ?? ""]) }
      if !text.isEmpty {
        Button {
          component.setState(["text": ""])
        } label: {
          Image(systemName: "xmark.circle.fill")
            .foregroundStyle(.secondary)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Clear text")
      }
    }
    .font(.body)
    .tint(props.color("tint"))
    .padding(.horizontal, 14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .contentShape(Capsule())
    .onTapGesture { focused = true }
    .onAppear {
      component.onCommand { name, _ in
        switch name {
        case "focus": focused = true
        case "blur": focused = false
        default: throw NativeComponentError.refused("Unknown command \(name).")
        }
        return nil
      }
    }
  }
}
