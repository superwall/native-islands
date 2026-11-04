import NativeIslands
import SwiftUI

struct SegmentedControlView: View {
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
    .onChangeOf(value) { next in
      selected = next
    }
  }
}
