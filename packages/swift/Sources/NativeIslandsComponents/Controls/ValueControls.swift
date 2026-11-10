import NativeIslands
import SwiftUI

/// A slider whose value is state: the page follows every step.
public struct SliderView: View {
  @ObservedObject var component: NativeComponentContext

  public init(component: NativeComponentContext) {
    self.component = component
  }

  public var body: some View {
    let props = component.props
    let minimum = props.double("minimum") ?? 0
    let maximum = max(minimum + 0.0001, props.double("maximum") ?? 1)
    let step = props.double("step")
    let value = Binding(
      get: { min(max(props.double("value") ?? minimum, minimum), maximum) },
      set: { component.setState(["value": $0]) }
    )
    Group {
      if let step, step > 0 {
        Slider(value: value, in: minimum...maximum, step: step) {
          EmptyView()
        } minimumValueLabel: {
          label(props.string("minimumSymbol"))
        } maximumValueLabel: {
          label(props.string("maximumSymbol"))
        }
      } else {
        Slider(value: value, in: minimum...maximum) {
          EmptyView()
        } minimumValueLabel: {
          label(props.string("minimumSymbol"))
        } maximumValueLabel: {
          label(props.string("maximumSymbol"))
        }
      }
    }
    .tint(props.color("tint"))
    .disabled(props.bool("disabled") == true)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  @ViewBuilder
  private func label(_ symbol: String?) -> some View {
    if let symbol {
      Image(systemName: symbol).foregroundStyle(.secondary)
    }
  }
}

/// The plus and minus pill; its value is state.
public struct StepperView: View {
  @ObservedObject var component: NativeComponentContext

  public init(component: NativeComponentContext) {
    self.component = component
  }

  public var body: some View {
    let props = component.props
    let minimum = props.double("minimum") ?? 0
    let maximum = props.double("maximum") ?? 100
    Stepper(
      "",
      value: Binding(
        get: { props.double("value") ?? minimum },
        set: { component.setState(["value": $0]) }
      ),
      in: minimum...max(minimum, maximum),
      step: props.double("step") ?? 1
    )
    .labelsHidden()
    .disabled(props.bool("disabled") == true)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
  }
}

/// A picker in one of SwiftUI's styles; the selected index is state.
public struct PickerView: View {
  @ObservedObject var component: NativeComponentContext

  public init(component: NativeComponentContext) {
    self.component = component
  }

  public var body: some View {
    let props = component.props
    let options = props.strings("options") ?? []
    let selection = Binding(
      get: { props.int("selectedIndex") ?? 0 },
      set: { component.setState(["selectedIndex": $0]) }
    )
    let picker = Picker("", selection: selection) {
      ForEach(Array(options.enumerated()), id: \.offset) { index, option in
        Text(option).tag(index)
      }
    }
    .labelsHidden()
    .tint(props.color("tint"))
    .labelled(by: component.accessibility)
    Group {
      if props.string("style") == "wheel" {
        picker.pickerStyle(.wheel)
      } else {
        picker.pickerStyle(.menu).fixedSize()
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
  }
}

/// A date picker; the date is state, as local `yyyy-MM-dd'T'HH:mm`.
public struct DatePickerView: View {
  @ObservedObject var component: NativeComponentContext

  static let format: DateFormatter = {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd'T'HH:mm"
    return formatter
  }()

  public init(component: NativeComponentContext) {
    self.component = component
  }

  public var body: some View {
    let props = component.props
    let components: DatePickerComponents = switch props.string("components") {
    case "time": .hourAndMinute
    case "dateAndTime": [.date, .hourAndMinute]
    default: .date
    }
    let date = Binding(
      get: { props.string("date").flatMap(Self.format.date(from:)) ?? .now },
      set: { component.setState(["date": Self.format.string(from: $0)]) }
    )
    let picker = DatePicker("", selection: date, displayedComponents: components)
      .labelsHidden()
      .tint(props.color("tint"))
      .labelled(by: component.accessibility)
    Group {
      switch props.string("style") {
      case "graphical": picker.datePickerStyle(.graphical)
      case "wheel": picker.datePickerStyle(.wheel)
      default: picker.datePickerStyle(.compact)
      }
    }
    .frame(
      maxWidth: .infinity,
      maxHeight: .infinity,
      alignment: (props.string("style") ?? "compact") == "compact" ? .trailing : .center
    )
  }
}

/// The system colour well; the colour is state, as `#rrggbb`.
public struct ColorPickerView: View {
  @ObservedObject var component: NativeComponentContext

  public init(component: NativeComponentContext) {
    self.component = component
  }

  public var body: some View {
    ColorPicker(
      "",
      selection: Binding(
        get: { component.props.color("color") ?? .accentColor },
        set: { component.setState(["color": Self.hex($0)]) }
      ),
      supportsOpacity: false
    )
    .labelsHidden()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  static func hex(_ color: Color) -> String {
    var red: CGFloat = 0
    var green: CGFloat = 0
    var blue: CGFloat = 0
    UIColor(color).getRed(&red, green: &green, blue: &blue, alpha: nil)
    let channel = { (value: CGFloat) in Int((min(max(value, 0), 1) * 255).rounded()) }
    return String(format: "#%02x%02x%02x", channel(red), channel(green), channel(blue))
  }
}

// A picker's island contains its control, so a wheel or a calendar keeps its
// own elements; the page's label and hint name the control itself, where its
// hidden label would have.
extension View {
  @ViewBuilder
  func labelled(by accessibility: NativeComponentAccessibility?) -> some View {
    let label = accessibility?.label ?? ""
    let hint = accessibility?.hint ?? ""
    if #available(iOS 18, *) {
      accessibilityLabel(Text(label), isEnabled: !label.isEmpty)
        .accessibilityHint(Text(hint), isEnabled: !hint.isEmpty)
    } else {
      switch (label.isEmpty, hint.isEmpty) {
      case (false, false): accessibilityLabel(Text(label)).accessibilityHint(Text(hint))
      case (false, true): accessibilityLabel(Text(label))
      case (true, false): accessibilityHint(Text(hint))
      case (true, true): self
      }
    }
  }
}
