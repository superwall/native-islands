import NativeIslands
import SwiftUI

public struct GlassButtonView: View {
  @ObservedObject var component: NativeComponentContext

  /// Near-black on a light tint, white on a dark one, so a prominent title
  /// stays readable on any accent.
  public static func ink(on tint: UIColor?) -> Color {
    var red: CGFloat = 0
    var green: CGFloat = 0
    var blue: CGFloat = 0
    guard let tint, tint.getRed(&red, green: &green, blue: &blue, alpha: nil) else {
      return .white
    }
    let luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    return luminance > 0.6 ? Color(white: 0.08) : .white
  }

  public init(component: NativeComponentContext) {
    self.component = component
  }

  public var body: some View {
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
          FittingTitle(title)
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

/// The title on one line at full size, else one line a size smaller, else on
/// two lines; iOS 15 shrinks it to fit.
private struct FittingTitle: View {
  let title: String

  init(_ title: String) {
    self.title = title
  }

  var body: some View {
    if #available(iOS 16.0, *) {
      ViewThatFits(in: .horizontal) {
        Text(title)
          .lineLimit(1)
          .fixedSize(horizontal: true, vertical: false)
        Text(title)
          .font(.subheadline.weight(.semibold))
          .lineLimit(1)
          .fixedSize(horizontal: true, vertical: false)
        wrapped
      }
    } else {
      wrapped
    }
  }

  private var wrapped: some View {
    Text(title)
      .lineLimit(2)
      .multilineTextAlignment(.center)
      .minimumScaleFactor(0.8)
  }
}
