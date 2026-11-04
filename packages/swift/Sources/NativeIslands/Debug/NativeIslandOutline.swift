import SwiftUI

/// Whether a host outlines its islands, shared by every island it mounts so a
/// change reaches the ones already on screen.
@MainActor
final class NativeIslandOutlines: ObservableObject {
  static let argument = "NativeIslandsOutlines"

  @Published var isShown = false

  static func isRequested(_ arguments: [String] = ProcessInfo.processInfo.arguments) -> Bool {
    guard let index = arguments.firstIndex(of: "-\(argument)") else { return false }
    let value = arguments.indices.contains(index + 1) ? arguments[index + 1] : "YES"
    return ["YES", "1", "true"].contains(value)
  }
}

/// Draws the browser simulator's outline and the component's name over an island.
struct NativeIslandOutline: ViewModifier {
  static let color = Color(red: 214 / 255, green: 58 / 255, blue: 249 / 255)

  let name: String
  @ObservedObject var outlines: NativeIslandOutlines

  func body(content: Content) -> some View {
    content.overlay(alignment: .topLeading) {
      if outlines.isShown {
        ZStack(alignment: .topLeading) {
          Rectangle().fill(Self.color.opacity(0.18))
          Rectangle().strokeBorder(Self.color, lineWidth: 2)
          Text(name)
            .font(.system(size: 10, weight: .semibold, design: .monospaced))
            .foregroundStyle(Self.color)
            .lineLimit(1)
            .padding(.horizontal, 4)
            .padding(.vertical, 2)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
      }
    }
  }
}
