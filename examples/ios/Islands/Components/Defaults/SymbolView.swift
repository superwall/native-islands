import NativeIslands
import SwiftUI

struct SymbolView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let props = component.props
    let weight = props.string("weight").flatMap { DefaultComponents.weights[$0] } ?? .regular
    Group {
      if let size = props.double("pointSize") {
        Image(systemName: props.string("name") ?? "questionmark")
          .font(.system(size: size, weight: weight))
      } else {
        Image(systemName: props.string("name") ?? "questionmark")
          .resizable()
          .scaledToFit()
          .fontWeight(weight)
      }
    }
    .foregroundStyle(props.color("tint") ?? Color.primary)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}
