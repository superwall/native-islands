import SwiftUI

public struct NativeComponentProps: Equatable, Sendable {
  let values: [String: NativeValue]

  init(_ values: [String: NativeValue] = [:]) {
    self.values = values
  }

  public var all: [String: Any] {
    values.mapValues(\.anyValue)
  }

  public var keys: [String] {
    Array(values.keys)
  }

  public subscript(key: String) -> Any? {
    values[key]?.anyValue
  }

  public func string(_ key: String) -> String? {
    values[key]?.stringValue
  }

  public func bool(_ key: String) -> Bool? {
    values[key]?.boolValue
  }

  public func double(_ key: String) -> Double? {
    values[key]?.doubleValue
  }

  public func int(_ key: String) -> Int? {
    guard let value = values[key]?.doubleValue, value.isFinite else { return nil }
    return Int(value.rounded())
  }

  public func strings(_ key: String) -> [String]? {
    guard let items = values[key]?.arrayValue else { return nil }
    let strings = items.compactMap(\.stringValue)
    return strings.count == items.count ? strings : nil
  }

  public func color(_ key: String) -> Color? {
    string(key).flatMap(Self.color(css:))
  }

  /// A colour the page wrote as hex or `rgb()`, such as one nested in an
  /// item of a list; `nil` for anything else.
  public static func color(css value: String) -> Color? {
    guard let components = rgba(value) else { return nil }
    return Color(
      .sRGB,
      red: components.red,
      green: components.green,
      blue: components.blue,
      opacity: components.alpha
    )
  }

  public func uiColor(_ key: String) -> UIColor? {
    guard let rgba = string(key).flatMap(Self.rgba) else { return nil }
    return UIColor(red: rgba.red, green: rgba.green, blue: rgba.blue, alpha: rgba.alpha)
  }

  struct RGBA: Equatable {
    let red: Double
    let green: Double
    let blue: Double
    let alpha: Double
  }

  /// `rgb`, `rgba`, `rrggbb` or `rrggbbaa`.
  static func hex(_ digits: String) -> RGBA? {
    var digits = digits
    if digits.count == 3 || digits.count == 4 { digits = digits.map { "\($0)\($0)" }.joined() }
    guard digits.count == 6 || digits.count == 8, let number = UInt64(digits, radix: 16) else { return nil }
    let bytes = digits.count == 8 ? number : number << 8 | 0xff
    let channel = { (shift: UInt64) in Double((bytes >> shift) & 0xff) / 255 }
    return RGBA(red: channel(24), green: channel(16), blue: channel(8), alpha: channel(0))
  }

  static func rgba(_ value: String) -> RGBA? {
    let trimmed = value.trimmingCharacters(in: .whitespaces).lowercased()
    if trimmed.hasPrefix("#") { return hex(String(trimmed.dropFirst())) }
    guard
      let open = trimmed.firstIndex(of: "("),
      trimmed.hasSuffix(")"),
      ["rgb", "rgba"].contains(String(trimmed[..<open]))
    else {
      return nil
    }
    let inner = trimmed[trimmed.index(after: open)..<trimmed.index(before: trimmed.endIndex)]
    let parts = inner
      .replacingOccurrences(of: "/", with: " ")
      .replacingOccurrences(of: ",", with: " ")
      .split(separator: " ")
      .map(String.init)
    guard parts.count == 3 || parts.count == 4 else { return nil }
    var numbers: [Double] = []
    for (index, part) in parts.enumerated() {
      let isPercent = part.hasSuffix("%")
      guard let number = Double(isPercent ? String(part.dropLast()) : part), number.isFinite else {
        return nil
      }
      if index < 3 {
        numbers.append(min(max(isPercent ? number / 100 : number / 255, 0), 1))
      } else {
        numbers.append(min(max(isPercent ? number / 100 : number, 0), 1))
      }
    }
    return RGBA(
      red: numbers[0],
      green: numbers[1],
      blue: numbers[2],
      alpha: numbers.count == 4 ? numbers[3] : 1
    )
  }
}

public struct NativeComponentAccessibility: Equatable, Sendable {
  public let label: String?
  public let hint: String?
  public let value: String?
  public let traits: [String]
  public let isHidden: Bool

  init(_ accessibility: NativeAccessibility) {
    label = accessibility.label
    hint = accessibility.hint
    value = accessibility.value
    traits = accessibility.traits ?? []
    isHidden = accessibility.hidden ?? false
  }
}
