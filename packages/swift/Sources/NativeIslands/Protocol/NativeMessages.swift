import CoreGraphics
import Foundation

enum NativeComponentLimits {
  static let protocolVersion = 1
  static let maxIslands = 256
  static let maxOperationsPerBatch = 256
  static let maxIdLength = 128
  static let maxComponentNameLength = 64
}

enum NativeValue: Codable, Equatable, Sendable {
  case string(String)
  case number(Double)
  case bool(Bool)
  case array([NativeValue])
  case object([String: NativeValue])
  case null

  init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if container.decodeNil() {
      self = .null
    } else if let value = try? container.decode(Bool.self) {
      self = .bool(value)
    } else if let value = try? container.decode(Double.self) {
      self = .number(value)
    } else if let value = try? container.decode(String.self) {
      self = .string(value)
    } else if let value = try? container.decode([NativeValue].self) {
      self = .array(value)
    } else {
      self = .object(try container.decode([String: NativeValue].self))
    }
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    switch self {
    case .string(let value):
      try container.encode(value)
    case .number(let value):
      try container.encode(value)
    case .bool(let value):
      try container.encode(value)
    case .array(let value):
      try container.encode(value)
    case .object(let value):
      try container.encode(value)
    case .null:
      try container.encodeNil()
    }
  }

  var stringValue: String? {
    if case .string(let value) = self { return value }
    return nil
  }

  var doubleValue: Double? {
    if case .number(let value) = self { return value }
    return nil
  }

  var boolValue: Bool? {
    if case .bool(let value) = self { return value }
    return nil
  }

  var arrayValue: [NativeValue]? {
    if case .array(let value) = self { return value }
    return nil
  }
}

struct NativeFrame: Codable, Equatable, Sendable {
  let x: Double
  let y: Double
  let width: Double
  let height: Double

  var isValid: Bool {
    [x, y, width, height].allSatisfy(\.isFinite) && width >= 0 && height >= 0
  }

  var cgRect: CGRect {
    CGRect(x: x, y: y, width: width, height: height)
  }
}

struct NativeShade: Codable, Equatable, Sendable {
  let x: Double
  let y: Double
  let width: Double
  let height: Double
  let color: String

  var frame: NativeFrame { NativeFrame(x: x, y: y, width: width, height: height) }

  var isValid: Bool { frame.isValid && NativeComponentProps.rgba(color) != nil }
}

struct NativeTransform: Codable, Equatable, Sendable {
  let scaleX: Double
  let skewY: Double
  let skewX: Double
  let scaleY: Double

  init(a scaleX: Double, b skewY: Double, c skewX: Double, d scaleY: Double) {
    self.scaleX = scaleX
    self.skewY = skewY
    self.skewX = skewX
    self.scaleY = scaleY
  }

  private enum CodingKeys: String, CodingKey {
    case scaleX = "a"
    case skewY = "b"
    case skewX = "c"
    case scaleY = "d"
  }

  var isValid: Bool { [scaleX, skewY, skewX, scaleY].allSatisfy(\.isFinite) }

  var affine: CGAffineTransform {
    CGAffineTransform(
      a: CGFloat(scaleX),
      b: CGFloat(skewY),
      c: CGFloat(skewX),
      d: CGFloat(scaleY),
      tx: 0,
      ty: 0
    )
  }
}

struct NativeSticky: Codable, Equatable, Sendable {
  let top: Double?
  let bottom: Double?
  let box: NativeFrame
  let bounds: NativeFrame

  var isValid: Bool {
    box.isValid && bounds.isValid && [top, bottom].allSatisfy { $0?.isFinite ?? true }
  }

  func shift(offset: Double, height: Double) -> Double {
    var y = box.y
    if let bottom {
      y = min(y, max(offset + height - bottom - box.height, bounds.y))
    }
    if let top {
      y = max(y, min(offset + top, bounds.y + bounds.height - box.height))
    }
    return y - box.y
  }
}

struct NativeSize: Codable, Equatable, Sendable {
  let width: Double
  let height: Double
}

struct NativePoint: Codable, Equatable, Sendable {
  let x: Double
  let y: Double
}

struct NativeScroller: Codable, Equatable, Sendable {
  let id: String
  let frame: NativeFrame
  let contentSize: NativeSize
  let scrollOffset: NativePoint
}

enum NativeAnchorType: String, Codable, CaseIterable, Sendable {
  case page
  case scroller
  case screen
}

enum NativeAnchor: Codable, Equatable, Sendable {
  case page
  case screen
  case scroller(NativeScroller)

  private enum CodingKeys: String, CodingKey {
    case type
    case scroller
  }

  var type: NativeAnchorType {
    switch self {
    case .page: return .page
    case .screen: return .screen
    case .scroller: return .scroller
    }
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    switch try container.decode(NativeAnchorType.self, forKey: .type) {
    case .page:
      self = .page
    case .screen:
      self = .screen
    case .scroller:
      self = .scroller(try container.decode(NativeScroller.self, forKey: .scroller))
    }
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(type, forKey: .type)
    if case .scroller(let scroller) = self {
      try container.encode(scroller, forKey: .scroller)
    }
  }
}

struct NativeAccessibility: Codable, Equatable, Sendable {
  var label: String?
  var hint: String?
  var value: String?
  var traits: [String]?
  var hidden: Bool?
}

enum NativeSizing: String, Codable, Sendable {
  case web
  case native
}
