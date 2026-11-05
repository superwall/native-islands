import Charts
import NativeIslands
import SwiftUI

/// A Swift Charts chart of the page's series (see `ChartData` for the props).
/// Dragging across it scrubs: it sends `select` with the x under the finger
/// and each series' value there, and `x: null` on release.
@available(iOS 16.0, *)
struct ChartView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let data = ChartData(props: component.props)
    let tint = component.props.color("tint") ?? .accentColor
    Group {
      switch data.xType {
      case .category:
        ChartBody(data: data, tint: tint, component: component) { x -> String? in
          if case let .category(label) = x { return label }
          return nil
        } wrap: { .category($0) }
      case .number:
        ChartBody(data: data, tint: tint, component: component) { x -> Double? in
          if case let .number(value) = x { return value }
          return nil
        } wrap: { .number($0) }
      case .date:
        ChartBody(data: data, tint: tint, component: component) { x -> Date? in
          if case let .date(date) = x { return date }
          return nil
        } wrap: { .date($0) }
      }
    }
    .padding(.vertical, 4)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

@available(iOS 16.0, *)
private struct ChartBody<X: Plottable & Hashable>: View {
  let data: ChartData
  let tint: Color
  let component: NativeComponentContext
  let unwrap: (ChartData.XValue) -> X?
  let wrap: (X) -> ChartData.XValue
  @State private var scrubbed: X?

  var body: some View {
    let single = data.series.count <= 1
    let selected = scrubbed.map(wrap).flatMap(data.nearest)
    Chart {
      ForEach(data.series) { series in
        ForEach(series.points) { point in
          if let x = unwrap(point.x) {
            mark(series.kind, x: x, y: point.y, series: series)
              .foregroundStyle(by: .value("Series", series.name))
              .opacity(selected == nil || selected == point.x || series.kind != .bar ? 1 : 0.35)
          }
        }
      }
      if let selected, let x = unwrap(selected) {
        RuleMark(x: .value("X", x))
          .foregroundStyle(Color.secondary.opacity(0.4))
      }
    }
    .chartForegroundStyleScale(
      domain: data.series.map(\.name),
      range: data.series.enumerated().map { index, series in
        series.color ?? (single ? tint : Self.palette(tint)[index % 6])
      }
    )
    .chartLegend(data.legend ? .visible : .hidden)
    .chartYAxis {
      AxisMarks { value in
        AxisGridLine()
        AxisValueLabel {
          if let number = value.as(Double.self) {
            Text(data.formatted(number))
          }
        }
      }
    }
    .modifier(YDomain(minimum: data.yMin, maximum: data.yMax))
    .modifier(AxisTitles(x: data.xTitle, y: data.yTitle))
    .scrubbing($scrubbed)
    .onChangeOf(selected) { next in
      component.emit("select", payload: data.selection(at: next))
    }
    .animation(.smoothly(), value: data)
  }

  @ChartContentBuilder
  func mark(_ kind: ChartData.Kind, x: X, y: Double, series: ChartData.Series) -> some ChartContent {
    let interpolation: InterpolationMethod = data.smooth ? .catmullRom : .linear
    switch kind {
    case .line:
      LineMark(x: .value("X", x), y: .value("Y", y), series: .value("Series", series.id))
        .interpolationMethod(interpolation)
        .symbol(.circle)
    case .area:
      AreaMark(x: .value("X", x), y: .value("Y", y), stacking: data.stacked ? .standard : .unstacked)
        .interpolationMethod(interpolation)
    case .point:
      PointMark(x: .value("X", x), y: .value("Y", y))
    case .bar:
      if data.stacked || data.series.count <= 1 {
        BarMark(x: .value("X", x), y: .value("Y", y))
          .cornerRadius(6)
      } else {
        BarMark(x: .value("X", x), y: .value("Y", y))
          .cornerRadius(6)
          .position(by: .value("Series", series.id))
      }
    }
  }

  /// Six colours for series that set none, starting from the tint.
  static func palette(_ tint: Color) -> [Color] {
    [tint, .orange, .green, .purple, .pink, .teal]
  }
}

@available(iOS 16.0, *)
private struct YDomain: ViewModifier {
  let minimum: Double?
  let maximum: Double?

  func body(content: Content) -> some View {
    if minimum != nil || maximum != nil {
      content.chartYScale(domain: (minimum ?? 0)...(maximum ?? max(minimum ?? 0, 1)))
    } else {
      content
    }
  }
}

@available(iOS 16.0, *)
private struct AxisTitles: ViewModifier {
  let x: String?
  let y: String?

  func body(content: Content) -> some View {
    switch (x, y) {
    case let (x?, y?): content.chartXAxisLabel(x).chartYAxisLabel(y)
    case let (x?, nil): content.chartXAxisLabel(x)
    case let (nil, y?): content.chartYAxisLabel(y)
    case (nil, nil): content
    }
  }
}

@available(iOS 16.0, *)
private extension View {
  /// Scrubs the chart's x axis into `x`: Swift Charts' own selection on
  /// iOS 17, a drag read through the chart's proxy before.
  @ViewBuilder
  func scrubbing<X: Plottable>(_ x: Binding<X?>) -> some View {
    if #available(iOS 17.0, *) {
      chartXSelection(value: x)
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
                  x.wrappedValue = proxy.value(atX: drag.location.x - origin.x, as: X.self)
                }
                .onEnded { _ in x.wrappedValue = nil }
            )
        }
      }
    }
  }
}
