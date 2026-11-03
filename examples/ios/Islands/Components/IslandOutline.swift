import NativeIslands
import SwiftUI

/// Whether the app outlines its native views, as the browser simulator marks
/// where they sit. The page's View Mode menu turns it on with Outlines.
@MainActor
final class IslandOutlines: ObservableObject {
  static let shared = IslandOutlines()

  @Published var isShown = false
}

/// Draws the simulator's outline and the component's name over a native view.
struct IslandOutline: ViewModifier {
  static let color = Color(red: 214 / 255, green: 58 / 255, blue: 249 / 255)

  let name: String
  @ObservedObject var outlines = IslandOutlines.shared

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
