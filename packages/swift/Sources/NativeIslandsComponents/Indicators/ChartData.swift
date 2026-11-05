import Foundation
import NativeIslands
import SwiftUI

/// What a chart island draws, read from its props:
///
/// - `series`: `[{ id, name?, kind?, color?, points: [{ x, y }] }]`.
/// - Series colours are hex (`#ff9500`) or `rgb()`, or a `var(--token)` holding one.
/// - `kind`: the mark of a series without its own: `bar`, `line`, `area` or `point`.
/// - `xAxis`: `{ type, title? }`, where `type` is `category` (x is a string),
///   `number` or `date` (x is an ISO 8601 date, such as `2026-11-04`).
/// - `yAxis`: `{ title?, min?, max?, format?, currency? }`, with `format`
///   `number`, `percent` (0.25 is 25%) or `currency`.
/// - `stacked`: bars of several series stack instead of standing side by side.
/// - `smooth`: lines and areas curve through their points (on by default).
/// - `legend`: shows the series' names; on by default with more than one series.
struct ChartData: Equatable {
  enum Kind: String { case bar, line, area, point }

  enum XType: String { case category, number, date }

  enum Format: String { case number, percent, currency }

  struct Point: Equatable, Identifiable {
    let series: String
    let x: XValue
    let y: Double
    var id: String { "\(series)|\(x.key)" }
  }

  /// One x value, of the chart's x type.
  enum XValue: Equatable, Hashable {
    case category(String)
    case number(Double)
    case date(Date)

    /// The value as the page wrote it: the label, the number, or the date in ISO 8601.
    var page: Any {
      switch self {
      case let .category(label): label
      case let .number(value): value
      case let .date(date): ChartData.isoString(date)
      }
    }

    var key: String { "\(page)" }
  }

  struct Series: Equatable, Identifiable {
    let id: String
    let name: String
    let kind: Kind
    let color: Color?
    let points: [Point]
  }

  var series: [Series]
  var xType: XType
  var xTitle: String?
  var yTitle: String?
  var yMin: Double?
  var yMax: Double?
  var format: Format
  var currency: String
  var stacked: Bool
  var smooth: Bool
  var legend: Bool

  var points: [Point] { series.flatMap(\.points) }

  init(props: NativeComponentProps) {
    let xAxis = props["xAxis"] as? [String: Any] ?? [:]
    let yAxis = props["yAxis"] as? [String: Any] ?? [:]
    let defaultKind = props.string("kind").flatMap(Kind.init(rawValue:)) ?? .bar
    xType = (xAxis["type"] as? String).flatMap(XType.init(rawValue:)) ?? .category
    xTitle = xAxis["title"] as? String
    yTitle = yAxis["title"] as? String
    yMin = (yAxis["min"] as? NSNumber)?.doubleValue
    yMax = (yAxis["max"] as? NSNumber)?.doubleValue
    format = (yAxis["format"] as? String).flatMap(Format.init(rawValue:)) ?? .number
    currency = yAxis["currency"] as? String ?? "USD"
    stacked = props.bool("stacked") == true
    smooth = props.bool("smooth") ?? true
    let type = xType
    series = (props["series"] as? [Any] ?? []).enumerated().compactMap { index, value in
      guard let value = value as? [String: Any] else { return nil }
      let id = value["id"] as? String ?? "series-\(index)"
      let points: [Point] = (value["points"] as? [Any] ?? []).compactMap { point in
        guard let point = point as? [String: Any],
              let y = (point["y"] as? NSNumber)?.doubleValue,
              let x = Self.x(point["x"], as: type) else { return nil }
        return Point(series: id, x: x, y: y)
      }
      return Series(
        id: id,
        name: value["name"] as? String ?? id,
        kind: (value["kind"] as? String).flatMap(Kind.init(rawValue:)) ?? defaultKind,
        color: (value["color"] as? String).flatMap(Self.color),
        points: points
      )
    }
    legend = props.bool("legend") ?? (series.count > 1)
  }

  static func x(_ value: Any?, as type: XType) -> XValue? {
    switch type {
    case .category:
      if let label = value as? String { return .category(label) }
      return (value as? NSNumber).map { .category($0.stringValue) }
    case .number:
      return (value as? NSNumber).map { .number($0.doubleValue) }
    case .date:
      return (value as? String).flatMap(date).map(XValue.date)
    }
  }

  /// A date from ISO 8601, with or without a time.
  static func date(_ text: String) -> Date? {
    let full = ISO8601DateFormatter()
    if let date = full.date(from: text) { return date }
    full.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = full.date(from: text) { return date }
    let day = ISO8601DateFormatter()
    day.formatOptions = [.withFullDate]
    day.timeZone = .current
    return day.date(from: text)
  }

  static func isoString(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withFullDate]
    formatter.timeZone = .current
    return formatter.string(from: date)
  }

  /// What the page hears for a selected x: the x as it wrote it, and each
  /// series' value there.
  func selection(at x: XValue?) -> [String: Any] {
    let none: [Any] = []
    guard let x else { return ["x": NSNull(), "values": none] }
    let values: [[String: Any]] = points.filter { $0.x == x }.map { ["series": $0.series, "y": $0.y] }
    return ["x": x.page, "values": values]
  }

  /// The point whose x is nearest `x`, for scrubbing a number or date axis.
  func nearest(_ x: XValue) -> XValue? {
    func distance(_ other: XValue) -> Double {
      switch (x, other) {
      case let (.number(one), .number(two)): abs(one - two)
      case let (.date(one), .date(two)): abs(one.timeIntervalSince(two))
      case let (.category(one), .category(two)): one == two ? 0 : .infinity
      default: .infinity
      }
    }
    return points.map(\.x).min { distance($0) < distance($1) }.flatMap { distance($0).isFinite ? $0 : nil }
  }

  /// `value` written as the y axis formats it.
  func formatted(_ value: Double) -> String {
    switch format {
    case .number: value.formatted(.number)
    case .percent: value.formatted(.percent)
    case .currency: value.formatted(.currency(code: currency))
    }
  }

  /// A colour from `#rgb`, `#rrggbb`, `#rrggbbaa` or `rgb(r g b / a)` with 0–255 channels.
  static func color(_ text: String) -> Color? {
    let value = text.trimmingCharacters(in: .whitespaces).lowercased()
    var channels: [Double]
    if value.hasPrefix("#") {
      var hex = String(value.dropFirst())
      if hex.count == 3 || hex.count == 4 { hex = hex.map { "\($0)\($0)" }.joined() }
      guard hex.count == 6 || hex.count == 8, let number = UInt64(hex, radix: 16) else { return nil }
      let bytes = hex.count == 8 ? number : number << 8 | 0xff
      channels = [24, 16, 8, 0].map { Double((bytes >> UInt64($0)) & 0xff) }
      channels[3] /= 255
    } else if value.hasPrefix("rgb"), let open = value.firstIndex(of: "("), value.hasSuffix(")") {
      let inner = value[value.index(after: open)..<value.index(before: value.endIndex)]
      let spaced = inner.replacingOccurrences(of: "/", with: " ").replacingOccurrences(of: ",", with: " ")
      let parts = spaced.split(separator: " ").compactMap { part -> Double? in
        part.hasSuffix("%") ? Double(part.dropLast()).map { $0 / 100 } : Double(part)
      }
      guard parts.count == 3 || parts.count == 4 else { return nil }
      channels = parts.count == 4 ? parts : parts + [1]
    } else {
      return nil
    }
    return Color(.sRGB, red: channels[0] / 255, green: channels[1] / 255, blue: channels[2] / 255, opacity: channels[3])
  }
}
