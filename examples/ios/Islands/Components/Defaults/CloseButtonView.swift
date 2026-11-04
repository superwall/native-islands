import NativeIslands
import SwiftUI

struct CloseButtonView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
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
