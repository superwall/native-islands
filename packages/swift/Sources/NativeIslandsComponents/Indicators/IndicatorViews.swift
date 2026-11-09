import NativeIslands
import SwiftUI

/// A gauge or a progress view. `style` is `circular`, `capacity`, `linear`,
/// `bar` (a determinate progress bar) or `spinner`.
@available(iOS 16.0, *)
public struct GaugeView: View {
  @ObservedObject var component: NativeComponentContext

  public init(component: NativeComponentContext) {
    self.component = component
  }

  public var body: some View {
    let props = component.props
    let value = min(max(props.double("value") ?? 0, 0), 1)
    let label = props.string("label") ?? ""
    Group {
      switch props.string("style") {
      case "spinner":
        ProgressView().controlSize(.large)
      case "bar":
        ProgressView(value: value)
      case "linear":
        Gauge(value: value) {
          EmptyView()
        } currentValueLabel: {
          Text(label)
        } minimumValueLabel: {
          Text(props.string("minimumLabel") ?? "")
        } maximumValueLabel: {
          Text(props.string("maximumLabel") ?? "")
        }
        .gaugeStyle(.linearCapacity)
      case "capacity":
        Gauge(value: value) {
          EmptyView()
        } currentValueLabel: {
          Text(label)
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .scaleEffect(1.3)
      default:
        Gauge(value: value) {
          EmptyView()
        } currentValueLabel: {
          Text(label)
        } minimumValueLabel: {
          Text(props.string("minimumLabel") ?? "")
        } maximumValueLabel: {
          Text(props.string("maximumLabel") ?? "")
        }
        .gaugeStyle(.accessoryCircular)
        .scaleEffect(1.3)
      }
    }
    .tint(props.color("tint"))
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

/// An SF Symbol playing one of its effects. Discrete effects play each time
/// `trigger` changes; `active` runs the indefinite ones.
public struct SymbolEffectView: View {
  @ObservedObject var component: NativeComponentContext

  public init(component: NativeComponentContext) {
    self.component = component
  }

  public var body: some View {
    let props = component.props
    let trigger = props.int("trigger") ?? 0
    let active = props.bool("active") == true
    let image = Image(systemName: props.string("name") ?? "questionmark")
      .font(.system(size: props.double("pointSize") ?? 56, weight: .medium))
      .foregroundStyle(props.color("tint") ?? .accentColor)
      .symbolReplaceTransition()
    Group {
      if #available(iOS 18.0, *) {
        switch props.string("effect") {
        case "pulse": image.symbolEffect(.pulse, isActive: active)
        case "variableColor": image.symbolEffect(.variableColor.iterative, isActive: active)
        case "breathe": image.symbolEffect(.breathe, isActive: active)
        case "rotate": image.symbolEffect(.rotate, isActive: active)
        case "wiggle": image.symbolEffect(.wiggle, value: trigger)
        case "replace": image
        default: image.symbolEffect(.bounce, value: trigger)
        }
      } else if #available(iOS 17.0, *) {
        // Breathe, Rotate and Wiggle came in iOS 18; iOS 17 plays the nearest effect it has.
        switch props.string("effect") {
        case "pulse", "breathe": image.symbolEffect(.pulse, isActive: active)
        case "variableColor", "rotate": image.symbolEffect(.variableColor.iterative, isActive: active)
        case "replace": image
        default: image.symbolEffect(.bounce, value: trigger)
        }
      } else {
        image
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}
