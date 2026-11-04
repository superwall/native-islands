import NativeIslands
import SwiftUI

struct GlassButtonView: View {
  @ObservedObject var component: NativeComponentContext

  static func ink(on tint: UIColor?) -> Color {
    var red: CGFloat = 0
    var green: CGFloat = 0
    var blue: CGFloat = 0
    guard let tint, tint.getRed(&red, green: &green, blue: &blue, alpha: nil) else {
      return .white
    }
    let luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    return luminance > 0.6 ? Color(white: 0.08) : .white
  }

  var body: some View {
    let props = component.props
    let prominent = props.string("prominence") == "prominent"
    let disabled = props.bool("disabled") == true
    Button {
      component.emit("press")
    } label: {
      HStack(spacing: 6) {
        if let symbol = props.string("systemImage") {
          Image(systemName: symbol)
        }
        if let title = props.string("title"), !title.isEmpty {
          ViewThatFits(in: .horizontal) {
            Text(title)
              .lineLimit(1)
              .fixedSize(horizontal: true, vertical: false)
            Text(title)
              .font(.subheadline.weight(.semibold))
              .lineLimit(1)
              .fixedSize(horizontal: true, vertical: false)
            Text(title)
              .lineLimit(2)
              .multilineTextAlignment(.center)
              .minimumScaleFactor(0.8)
          }
        }
      }
      .font(.body.weight(.semibold))
      .foregroundStyle(prominent ? Self.ink(on: props.uiColor("tint")) : Color.primary)
      .padding(.horizontal, 12)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .disabled(disabled)
    .opacity(disabled ? 0.5 : 1)
  }
}
