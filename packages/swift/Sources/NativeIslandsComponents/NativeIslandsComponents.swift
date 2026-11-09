import NativeIslands
import os
import SwiftUI
import TipKit

/// Ready-made native islands for the controls and system features a web page
/// needs, each under the name its `native-islands/components` twin on the page
/// uses. The map and the chart, which pull in MapKit and Swift Charts, are in
/// `NativeIslandsMaps` and `NativeIslandsCharts`.
///
/// Info.plist keys: `camera` needs `NSCameraUsageDescription`, and `permission`
/// needs the usage description of every kind its pages ask for. The others
/// need none; `notifications` asks for permission at run time.
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
    case video
    case camera
    case photoPicker
    case shareButton
    case hapticButton
    case permission
    case tip
    // Presentations
    case presentation
    case alert
    // App chrome
    case tabBar
    case tabAccessory
    case searchTab
    case searchField
    case navigationBar
    case toolbar
    // Lists
    case list
    // System
    case haptics
    case notifications
    case interaction
    case material

    /// The name pages mount it by.
    public var name: String { rawValue }

    /// Whether this iOS can draw it; one it cannot is not offered, so the
    /// page keeps its web version.
    public var isAvailable: Bool {
      switch self {
      case .gauge:
        if #available(iOS 16.0, *) { return true }
        return false
      case .tip:
        if #available(iOS 17.0, *) { return true }
        return false
      default:
        return true
      }
    }

    @MainActor
    var glass: (@MainActor (NativeComponentProps) -> NativeGlass?)? {
      switch self {
      case .glassButton, .menu, .photoPicker, .shareButton, .hapticButton: NativeIslandsComponents.buttonGlass
      case .closeButton: NativeIslandsComponents.closeButtonGlass
      case .searchTab: { _ in NativeGlass(shape: .circle) }
      case .searchField, .tabAccessory: { _ in NativeGlass(shape: .capsule) }
      case .material: MaterialView.glass
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
      case .video: VideoView(component: context)
      case .camera: CameraView(component: context)
      case .photoPicker: PhotoPickerView(component: context)
      case .shareButton: ShareButtonView(component: context)
      case .hapticButton: HapticButtonView(component: context)
      case .permission: PermissionView(component: context)
      case .tip:
        if #available(iOS 17.0, *) {
          TipIslandView(component: context)
        }
      case .presentation: PresentationView(component: context).allowsHitTesting(false)
      case .alert: AlertView(component: context).allowsHitTesting(false)
      case .tabBar: TabBarView(component: context)
      case .tabAccessory: TabAccessoryView(component: context)
      case .searchTab: SearchTabView(component: context)
      case .searchField: SearchFieldView(component: context)
      case .navigationBar: NavigationBarView(component: context)
      case .toolbar: ToolbarView(component: context)
      case .list: ListView(component: context)
      case .haptics: HapticEngineView(component: context)
      case .notifications: NotificationsView(component: context)
      case .interaction: InteractionView(component: context)
      case .material: MaterialView(component: context)
      }
    }
  }

  /// Registers `components`, all of them by default. Register before attaching
  /// a host; a component the app registers under the same name afterwards
  /// replaces the built-in one. With `tip`, it also calls `Tips.configure()`
  /// unless the app configured TipKit already. With `notifications`, it makes
  /// the notification centre's delegate this library's unless the app set one,
  /// so call it before launch finishes to hear about the tap that opened the app.
  @MainActor
  public static func register(
    in registry: NativeComponentRegistry? = nil,
    only components: Set<Component> = Set(Component.allCases)
  ) {
    let registry = registry ?? .shared
    if components.contains(.tip), #available(iOS 17.0, *) {
      try? Tips.configure()
    }
    if components.contains(.notifications) { NotificationRelay.shared.install() }
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

  static let logger = Logger(subsystem: "com.superwall.native-islands", category: "components")

  static func log(_ message: String) {
    logger.warning("\(message, privacy: .public)")
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
