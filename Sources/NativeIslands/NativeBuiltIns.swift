import SwiftUI

/// The components every host offers pages without registering anything:
/// the React bindings' `GlassButton`, `CloseButton`, `Toggle`, `SegmentedControl`
/// and `SystemSymbol`. Their names and props match
/// `js/src/react/builtins.ts`.
enum NativeBuiltIns {
  static let names = ["glassButton", "closeButton", "toggle", "segmentedControl", "symbol"]

  @MainActor
  static func register(in registry: NativeComponentRegistry) {
    guard #available(iOS 26.0, macCatalyst 26.0, *) else { return }
    registry.register("glassButton", glass: glassButtonGlass) { component in
      NativeGlassButtonView(component: component)
    }
    registry.register("closeButton", glass: closeButtonGlass) { component in
      NativeCloseButtonView(component: component)
    }
    registry.register("toggle") { component in
      NativeToggleView(component: component)
    }
    registry.register("segmentedControl") { component in
      NativeSegmentedControlView(component: component)
    }
    registry.register("symbol") { component in
      NativeSymbolView(component: component)
    }
  }

  @MainActor
  static func glassButtonGlass(_ props: NativeComponentProps) -> NativeGlass {
    let prominent = props.string("prominence") == "prominent"
    let iconOnly = (props.string("title") ?? "").isEmpty && props.string("systemImage") != nil
    return NativeGlass(
      shape: iconOnly ? .circle : .capsule,
      tint: prominent ? props.uiColor("tint") ?? .tintColor : props.uiColor("tint")?.withAlphaComponent(0.3),
      isInteractive: props.bool("disabled") != true
    )
  }

  @MainActor
  static func closeButtonGlass(_ props: NativeComponentProps) -> NativeGlass {
    NativeGlass(shape: .circle, tint: props.uiColor("tint")?.withAlphaComponent(0.3))
  }

  static let weights: [String: Font.Weight] = [
    "ultraLight": .ultraLight,
    "thin": .thin,
    "light": .light,
    "regular": .regular,
    "medium": .medium,
    "semibold": .semibold,
    "bold": .bold,
    "heavy": .heavy,
    "black": .black
  ]
}

extension NativeComponentProps {
  /// A colour prop as a `UIColor`.
  func uiColor(_ key: String) -> UIColor? {
    guard let rgba = string(key).flatMap(Self.rgba) else { return nil }
    return UIColor(red: rgba.red, green: rgba.green, blue: rgba.blue, alpha: rgba.alpha)
  }
}

/// Applies the label, hint, value and traits the page derived from the
/// web version, so VoiceOver reads the native view as it read the web one.
struct NativeAccessibilityModifier: ViewModifier {
  let accessibility: NativeComponentAccessibility?

  func body(content: Content) -> some View {
    if let accessibility {
      content
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibility.label.map(Text.init) ?? Text(""))
        .accessibilityHint(accessibility.hint.map(Text.init) ?? Text(""))
        .accessibilityValue(accessibility.value.map(Text.init) ?? Text(""))
        .accessibilityAddTraits(Self.traits(for: accessibility.traits))
        .accessibilityHidden(accessibility.isHidden)
    } else {
      content
    }
  }

  static func traits(for names: [String]) -> AccessibilityTraits {
    var traits: AccessibilityTraits = []
    for name in names {
      switch name {
      case "button": traits.insert(.isButton)
      case "link": traits.insert(.isLink)
      case "image": traits.insert(.isImage)
      case "header": traits.insert(.isHeader)
      default: break
      }
    }
    return traits
  }
}

@available(iOS 26.0, macCatalyst 26.0, *)
struct NativeGlassButtonView: View {
  @ObservedObject var component: NativeComponentContext

  /// Dark ink on a light tint and white on a dark one, so the title always
  /// reads on a prominent button.
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

@available(iOS 26.0, macCatalyst 26.0, *)
struct NativeCloseButtonView: View {
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

/// A controlled switch: it shows what the user flipped at once, reports
/// `change`, and follows the page's `isOn` when the page sends a new one.
@available(iOS 26.0, macCatalyst 26.0, *)
struct NativeToggleView: View {
  @ObservedObject var component: NativeComponentContext
  @State private var isOn: Bool?

  var body: some View {
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
    .onChange(of: value) { _, next in
      isOn = next
    }
  }
}

/// A controlled segmented control, like ``NativeToggleView``.
@available(iOS 26.0, macCatalyst 26.0, *)
struct NativeSegmentedControlView: View {
  @ObservedObject var component: NativeComponentContext
  @State private var selected: Int?

  var body: some View {
    let props = component.props
    let segments = props.strings("segments") ?? []
    let value = props.int("selectedIndex") ?? 0
    Picker(
      "",
      selection: Binding(
        get: { selected ?? value },
        set: { next in
          selected = next
          component.emit("change", payload: ["selectedIndex": next])
        }
      )
    ) {
      ForEach(Array(segments.enumerated()), id: \.offset) { index, segment in
        Text(segment).tag(index)
      }
    }
    .pickerStyle(.segmented)
    .labelsHidden()
    .disabled(props.bool("disabled") == true)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .onChange(of: value) { _, next in
      selected = next
    }
  }
}

@available(iOS 26.0, macCatalyst 26.0, *)
struct NativeSymbolView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let props = component.props
    let weight = props.string("weight").flatMap { NativeBuiltIns.weights[$0] } ?? .regular
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
