import NativeIslands
import SwiftUI

/// A switch whose value is state, so the page's echo of an older value
/// never flips it back.
public struct ToggleView: View {
  @ObservedObject var component: NativeComponentContext

  public init(component: NativeComponentContext) {
    self.component = component
  }

  public var body: some View {
    let props = component.props
    Toggle(
      "",
      isOn: Binding(
        get: { props.bool("isOn") ?? false },
        set: { component.setState(["isOn": $0]) }
      )
    )
    .labelsHidden()
    .tint(props.color("tint"))
    .disabled(props.bool("disabled") == true)
    .fixedSize()
  }
}
