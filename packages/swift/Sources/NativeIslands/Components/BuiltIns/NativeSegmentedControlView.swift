import SwiftUI

@available(iOS 26.0, macCatalyst 26.0, *)

struct NativeSegmentedControlView: View {
  @ObservedObject var component: NativeComponentContext
  @State private var selected: Int?

  var body: some View {
    let props = component.props
    let segments = props.strings("segments") ?? []
    let value = props.int("selectedIndex") ?? 0
    Picker(
      "",
      selection: Binding(
        get: { selected ?? value },
        set: { next in
          selected = next
          component.emit("change", payload: ["selectedIndex": next])
        }
      )
    ) {
      ForEach(Array(segments.enumerated()), id: \.offset) { index, segment in
        Text(segment).tag(index)
      }
    }
    .pickerStyle(.segmented)
    .labelsHidden()
    .disabled(props.bool("disabled") == true)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .onChange(of: value) { _, next in
      selected = next
    }
  }
}
