import Charts
import NativeIslands
import SwiftUI

/// A Swift Charts chart of the page's points. Dragging across it scrubs and
/// sends `select` with the label under the finger, and `null` on release.
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
    .scrubbing($scrubbed)
    .onChangeOf(scrubbed) { label in
      component.emit("select", payload: ["label": label.map { $0 as Any } ?? NSNull()])
    }
    .animation(.smoothly(), value: kind)
    .padding(.vertical, 4)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

private extension View {
  /// Scrubs the chart's x axis into `label`: Swift Charts' own selection on
  /// iOS 17, a drag read through the chart's proxy before.
  @ViewBuilder
  func scrubbing(_ label: Binding<String?>) -> some View {
    if #available(iOS 17.0, *) {
      chartXSelection(value: label)
    } else {
      chartOverlay { proxy in
        GeometryReader { geometry in
          Rectangle()
            .fill(.clear)
            .contentShape(Rectangle())
            .gesture(
              DragGesture(minimumDistance: 0)
                .onChanged { drag in
                  let origin = geometry[proxy.plotAreaFrame].origin
                  label.wrappedValue = proxy.value(atX: drag.location.x - origin.x, as: String.self)
                }
                .onEnded { _ in label.wrappedValue = nil }
            )
        }
      }
    }
  }
}
