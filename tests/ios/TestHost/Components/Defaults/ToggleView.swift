import NativeIslands
import SwiftUI

@available(iOS 26.0, macCatalyst 26.0, *)
struct ToggleView: View {
  @ObservedObject var component: NativeComponentContext
  @State private var isOn: Bool?

  var body: some View {
    let props = component.props
    let value = props.bool("isOn") ?? false
    Toggle(
      "",
      isOn: Binding(
        get: { isOn ?? value },
        set: { next in
          isOn = next
          component.emit("change", payload: ["isOn": next])
        }
      )
    )
    .labelsHidden()
    .tint(props.color("tint"))
    .disabled(props.bool("disabled") == true)
    .fixedSize()
    .onChange(of: value) { _, next in
      isOn = next
    }
  }
}
