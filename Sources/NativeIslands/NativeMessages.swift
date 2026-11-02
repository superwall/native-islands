import CoreGraphics
import Foundation

/// The limits both sides of the native component bridge agree on.
///
/// They mirror `NativeComponentLimits` in `@superwall/native-islands`, so a
/// batch the page considers valid is never refused here.
enum NativeComponentLimits {
  static let protocolVersion = 1
  static let maxIslands = 256
  static let maxOperationsPerBatch = 256
  static let maxIdLength = 128
  static let maxComponentNameLength = 64
}

/// A plain JSON value, as a native component receives it in its props and as
/// it sends it back in an event payload.
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

/// A rectangle in CSS pixels, which are points on iOS.
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

/// A see-through part of the page over an island, such as a sheet's dimmed
/// backdrop, in the island's own coordinates. The host lays its colour over
/// the island there, so the island is dimmed like the page around it.
struct NativeShade: Codable, Equatable, Sendable {
  let x: Double
  let y: Double
  let width: Double
  let height: Double
  /// An `rgb()` or `rgba()` colour.
  let color: String

  var frame: NativeFrame { NativeFrame(x: x, y: y, width: width, height: height) }

  var isValid: Bool { frame.isValid && NativeComponentProps.rgba(color) != nil }
}

/// The linear part of a 2D transform, as CSS `matrix(a, b, c, d, …)` writes
/// it. The host turns the island about its frame's centre by it.
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

/// A `position: sticky` box inside a scroller. The host keeps the island
/// stuck itself as the scroller scrolls, with no message per frame. Rects are
/// in the scroller's content coordinates.
struct NativeSticky: Codable, Equatable, Sendable {
  /// The `top` inset it sticks at, when it sticks to the top.
  let top: Double?
  /// The `bottom` inset it sticks at, when it sticks to the bottom.
  let bottom: Double?
  /// The sticky box where it sits unstuck.
  let box: NativeFrame
  /// How far the box may travel: its containing block, less its margins.
  let bounds: NativeFrame

  var isValid: Bool {
    box.isValid && bounds.isValid && [top, bottom].allSatisfy { $0?.isFinite ?? true }
  }

  /// How far the box sits from where it would be unstuck, for a scroller
  /// scrolled to `offset` that shows `height` points of its content.
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

/// The inner scrolling area an island lives in, as the page measured it
/// when it mounted the island. The host matches it to a `WKChildScrollView`.
struct NativeScroller: Codable, Equatable, Sendable {
  let id: String
  /// The scroller's content box in viewport coordinates.
  let frame: NativeFrame
  let contentSize: NativeSize
  /// 0-based from the content's left and top edge, like `contentOffset`.
  let scrollOffset: NativePoint
}

enum NativeAnchorType: String, Codable, CaseIterable, Sendable {
  case page
  case scroller
  case screen
}

/// What an island's frame is relative to.
enum NativeAnchor: Codable, Equatable, Sendable {
  /// Document coordinates, inside the web view's scroll view.
  case page
  /// Viewport coordinates, above the web view.
  case screen
  /// Content coordinates, inside an inner scrolling area.
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

/// What VoiceOver reads for an island, derived from its web children.
struct NativeAccessibility: Codable, Equatable, Sendable {
  var label: String?
  var hint: String?
  var value: String?
  var traits: [String]?
  var hidden: Bool?
}

enum NativeSizing: String, Codable, Sendable {
  /// The web children set the size.
  case web
  /// The native view sets the size and reports it with `native_component_size`.
  case native
}
