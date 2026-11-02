import SwiftUI

/// The values a page hands a native component, as plain JSON values.
///
/// Colours arrive as CSS `rgb()` or `rgba()` strings; read them with
/// ``color(_:)``. Every accessor returns `nil` when the prop is missing or has
/// another type, so a component can fall back to its own default.
public struct NativeComponentProps: Equatable, Sendable {
  let values: [String: NativeValue]

  init(_ values: [String: NativeValue] = [:]) {
    self.values = values
  }

  /// Every prop, as Foundation types: `String`, `Double`, `Bool`, `[Any]`,
  /// `[String: Any]` or `NSNull`.
  public var all: [String: Any] {
    values.mapValues(\.anyValue)
  }

  /// The names of the props the page sent.
  public var keys: [String] {
    Array(values.keys)
  }

  /// One prop as a Foundation type, or `nil` when the page didn't send it.
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

  /// A number prop rounded to the nearest integer.
  public func int(_ key: String) -> Int? {
    guard let value = values[key]?.doubleValue, value.isFinite else { return nil }
    return Int(value.rounded())
  }

  /// An array prop whose items are all strings.
  public func strings(_ key: String) -> [String]? {
    guard let items = values[key]?.arrayValue else { return nil }
    let strings = items.compactMap(\.stringValue)
    return strings.count == items.count ? strings : nil
  }

  /// A colour prop, from the `rgb()` or `rgba()` string the page resolved
  /// its CSS colour to.
  public func color(_ key: String) -> Color? {
    guard let components = string(key).flatMap(Self.rgba) else { return nil }
    return Color(
      .sRGB,
      red: components.red,
      green: components.green,
      blue: components.blue,
      opacity: components.alpha
    )
  }

  struct RGBA: Equatable {
    let red: Double
    let green: Double
    let blue: Double
    let alpha: Double
  }

  /// Parses the colours `getComputedStyle` produces: `rgb(r, g, b)`,
  /// `rgba(r, g, b, a)` and the space-separated `rgb(r g b / a)`.
  static func rgba(_ value: String) -> RGBA? {
    let trimmed = value.trimmingCharacters(in: .whitespaces).lowercased()
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

/// What VoiceOver should read for a native component, derived by the page
/// from the web version it replaces.
public struct NativeComponentAccessibility: Equatable, Sendable {
  public let label: String?
  public let hint: String?
  public let value: String?
  /// Web roles mapped to native traits: `button`, `link`, `switch`, `image`,
  /// `header`.
  public let traits: [String]
  /// The page asks for the element to be hidden from VoiceOver.
  public let isHidden: Bool

  init(_ accessibility: NativeAccessibility) {
    label = accessibility.label
    hint = accessibility.hint
    value = accessibility.value
    traits = accessibility.traits ?? []
    isHidden = accessibility.hidden ?? false
  }
}
