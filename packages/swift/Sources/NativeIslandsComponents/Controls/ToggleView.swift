import NativeIslands
import SwiftUI

public struct ToggleView: View {
  @ObservedObject var component: NativeComponentContext
  @State private var isOn: Bool?

  public init(component: NativeComponentContext) {
    self.component = component
  }

  public var body: some View {
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
    .onChangeOf(value) { next in
      isOn = next
    }
  }
}
