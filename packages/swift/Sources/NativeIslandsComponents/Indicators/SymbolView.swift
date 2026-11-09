import NativeIslands
import SwiftUI

public struct SymbolView: View {
  @ObservedObject var component: NativeComponentContext

  public init(component: NativeComponentContext) {
    self.component = component
  }

  public var body: some View {
    let props = component.props
    let weight = props.string("weight").flatMap { NativeIslandsComponents.weights[$0] } ?? .regular
    Group {
      if let size = props.double("pointSize") {
        Image(systemName: props.string("name") ?? "questionmark")
          .font(.system(size: size, weight: weight))
      } else {
        Image(systemName: props.string("name") ?? "questionmark")
          .resizable()
          .scaledToFit()
          .symbolWeight(weight)
      }
    }
    .foregroundStyle(props.color("tint") ?? Color.primary)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

private extension View {
  /// The symbol's stroke weight; iOS 15 reads it from the font.
  @ViewBuilder
  func symbolWeight(_ weight: Font.Weight) -> some View {
    if #available(iOS 16.0, *) {
      fontWeight(weight)
    } else {
      font(.body.weight(weight))
    }
  }
}
