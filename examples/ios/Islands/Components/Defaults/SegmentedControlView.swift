import NativeIslands
import SwiftUI

/// A segmented control whose selection is state, like `ToggleView`.
struct SegmentedControlView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let props = component.props
    let segments = props.strings("segments") ?? []
    Picker(
      "",
      selection: Binding(
        get: { props.int("selectedIndex") ?? 0 },
        set: { component.setState(["selectedIndex": $0]) }
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
  }
}
