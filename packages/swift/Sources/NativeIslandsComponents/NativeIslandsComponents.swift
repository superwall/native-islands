import NativeIslands
import SwiftUI

/// Ready-made native islands for the controls a web page needs, each under the
/// name its `native-islands/components` twin on the page uses.
public enum NativeIslandsComponents {
  public enum Component: String, CaseIterable, Sendable {
    case glassButton
    case closeButton
    case menu
    case toggle
    case segmentedControl
    case slider
    case stepper
    case picker
    case datePicker
    case colorPicker
    case textField
    case symbol
    case symbolEffect
    case gauge

    /// The name pages mount it by.
    public var name: String { rawValue }

    /// Whether this iOS can draw it; one it cannot is not offered, so the
    /// page keeps its web version.
    public var isAvailable: Bool {
      guard self == .gauge else { return true }
      if #available(iOS 16.0, *) {
        return true
      }
      return false
    }

    @MainActor
    var glass: (@MainActor (NativeComponentProps) -> NativeGlass?)? {
      switch self {
      case .glassButton, .menu: NativeIslandsComponents.buttonGlass
      case .closeButton: NativeIslandsComponents.closeButtonGlass
      default: nil
      }
    }
  }

  /// A ready-made component drawn for one island.
  public struct ComponentView: View {
    let component: Component
    let context: NativeComponentContext

    public var body: some View {
      switch component {
      case .glassButton: GlassButtonView(component: context)
      case .closeButton: CloseButtonView(component: context)
      case .menu: MenuView(component: context)
      case .toggle: ToggleView(component: context)
      case .segmentedControl: SegmentedControlView(component: context)
      case .slider: SliderView(component: context)
      case .stepper: StepperView(component: context)
      case .picker: PickerView(component: context)
      case .datePicker: DatePickerView(component: context)
      case .colorPicker: ColorPickerView(component: context)
      case .textField: TextFieldView(component: context)
      case .symbol: SymbolView(component: context)
      case .symbolEffect: SymbolEffectView(component: context)
      case .gauge:
        if #available(iOS 16.0, *) {
          GaugeView(component: context)
        }
      }
    }
  }

  /// Registers `components`, all of them by default. Register before attaching
  /// a host; a component the app registers under the same name afterwards
  /// replaces the built-in one.
  @MainActor
  public static func register(
    in registry: NativeComponentRegistry? = nil,
    only components: Set<Component> = Set(Component.allCases)
  ) {
    let registry = registry ?? .shared
    for component in Component.allCases where components.contains(component) && component.isAvailable {
      registry.register(component.name, glass: component.glass) { context in
        ComponentView(component: component, context: context)
      }
    }
  }

  /// The glass of a glass button: a circle for an icon on its own, a capsule
  /// otherwise; tinted fully when prominent, lightly when only tinted.
  @MainActor
  public static func buttonGlass(_ props: NativeComponentProps) -> NativeGlass {
    let prominent = props.string("prominence") == "prominent"
    let iconOnly = (props.string("title") ?? "").isEmpty && props.string("systemImage") != nil
    return NativeGlass(
      shape: iconOnly ? .circle : .capsule,
      tint: prominent ? props.uiColor("tint") ?? .tintColor : props.uiColor("tint")?.withAlphaComponent(0.3),
      isInteractive: props.bool("disabled") != true
    )
  }

  @MainActor
  public static func closeButtonGlass(_ props: NativeComponentProps) -> NativeGlass {
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
