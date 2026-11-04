import NativeIslands
import SwiftUI

public struct CloseButtonView: View {
  @ObservedObject var component: NativeComponentContext

  public init(component: NativeComponentContext) {
    self.component = component
  }

  public var body: some View {
    Button {
      component.emit("press")
    } label: {
      Image(systemName: "xmark")
        .font(.body.weight(.semibold))
        .foregroundStyle(Color.primary)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(Text("Close"))
  }
}
