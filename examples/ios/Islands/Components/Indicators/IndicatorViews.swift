import Charts
import NativeIslands
import SwiftUI

/// A gauge or a progress view. `style` is `circular`, `capacity`, `linear`,
/// `bar` (a determinate progress bar) or `spinner`.
@available(iOS 26.0, *)
struct GaugeView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
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
@available(iOS 26.0, *)
struct SymbolEffectView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let props = component.props
    let trigger = props.int("trigger") ?? 0
    let active = props.bool("active") == true
    let image = Image(systemName: props.string("name") ?? "questionmark")
      .font(.system(size: props.double("pointSize") ?? 56, weight: .medium))
      .foregroundStyle(props.color("tint") ?? .accentColor)
      .contentTransition(.symbolEffect(.replace))
    Group {
      switch props.string("effect") {
      case "pulse": image.symbolEffect(.pulse, isActive: active)
      case "variableColor": image.symbolEffect(.variableColor.iterative, isActive: active)
      case "breathe": image.symbolEffect(.breathe, isActive: active)
      case "rotate": image.symbolEffect(.rotate, isActive: active)
      case "wiggle": image.symbolEffect(.wiggle, value: trigger)
      case "replace": image
      default: image.symbolEffect(.bounce, value: trigger)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

/// A Swift Charts chart of the page's points. Dragging across it scrubs and
/// sends `select` with the label under the finger, and `null` on release.
@available(iOS 26.0, *)
struct ChartView: View {
  @ObservedObject var component: NativeComponentContext
  @State private var scrubbed: String?

  struct Point: Identifiable {
    let label: String
    let value: Double
    var id: String { label }
  }

  var body: some View {
    let props = component.props
    let points: [Point] = (props["points"] as? [Any] ?? []).compactMap { value in
      guard let value = value as? [String: Any],
            let label = value["label"] as? String,
            let number = value["value"] as? Double else { return nil }
      return Point(label: label, value: number)
    }
    let tint = props.color("tint") ?? .accentColor
    let kind = props.string("kind")
    Chart(points) { point in
      switch kind {
      case "line":
        LineMark(x: .value("Day", point.label), y: .value("Value", point.value))
          .interpolationMethod(.catmullRom)
          .symbol(.circle)
          .foregroundStyle(tint)
      case "area":
        AreaMark(x: .value("Day", point.label), y: .value("Value", point.value))
          .interpolationMethod(.catmullRom)
          .foregroundStyle(tint.opacity(0.35).gradient)
        LineMark(x: .value("Day", point.label), y: .value("Value", point.value))
          .interpolationMethod(.catmullRom)
          .foregroundStyle(tint)
      default:
        BarMark(x: .value("Day", point.label), y: .value("Value", point.value))
          .cornerRadius(6)
          .foregroundStyle(scrubbed == nil || scrubbed == point.label ? tint : tint.opacity(0.35))
      }
      if scrubbed == point.label {
        RuleMark(x: .value("Day", point.label))
          .foregroundStyle(Color.secondary.opacity(0.4))
      }
    }
    .chartXSelection(value: $scrubbed)
    .onChange(of: scrubbed) { _, label in
      component.emit("select", payload: ["label": label.map { $0 as Any } ?? NSNull()])
    }
    .animation(.smooth, value: kind)
    .padding(.vertical, 4)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}
