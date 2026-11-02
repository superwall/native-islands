import Foundation

/// `window.__NATIVE_ISLANDS__`: what this host can draw natively, injected
/// before the page's own JavaScript runs.
struct NativeCapability: Encodable, Equatable, Sendable {
  let components: [String: Int]
  let anchors: [NativeAnchorType]
  let features: [NativeFeature]

  init(
    components: [String: Int],
    anchors: [NativeAnchorType] = NativeAnchorType.allCases,
    features: [NativeFeature] = NativeFeature.allCases
  ) {
    self.components = components
    self.anchors = anchors
    self.features = features
  }

  private enum CodingKeys: String, CodingKey {
    case `protocol`
    case components
    case anchors
    case features
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(NativeComponentLimits.protocolVersion, forKey: .protocol)
    try container.encode(components, forKey: .components)
    try container.encode(anchors, forKey: .anchors)
    try container.encode(features, forKey: .features)
  }
}

/// The optional parts of the bridge this host speaks.
enum NativeFeature: String, Codable, CaseIterable, Sendable {
  /// Views report their values with `native_component_state`.
  case state
  /// Views ask the page for answers with `native_component_request`.
  case requests
  /// The page drives views with `native_component_command`.
  case commands
  /// Scroller islands live inside WebKit's layer for their scroller, so they
  /// move with it through page changes and web content above covers them.
  case layered
  /// Sticky scroller islands arrive with their sticky box, and the host keeps
  /// them stuck as the scroller scrolls.
  case sticky
  /// Islands arrive with the part of them a clipping ancestor shows.
  case clip
}

extension NativeCapability {
  /// The global the page reads the capability from.
  static let global = "__NATIVE_ISLANDS__"

  /// The script that sets `window.__NATIVE_ISLANDS__` at document start, or
  /// `nil` when there is nothing to offer, so the page keeps its web versions.
  var preloadScript: String? {
    guard !components.isEmpty else { return nil }
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    guard
      let data = try? encoder.encode(self),
      let json = String(data: data, encoding: .utf8)
    else {
      return nil
    }
    let safe = json
      .replacingOccurrences(of: "<", with: "\\u003C")
      .replacingOccurrences(of: "\u{2028}", with: "\\u2028")
      .replacingOccurrences(of: "\u{2029}", with: "\\u2029")
    return "window.\(Self.global) = \(safe);"
  }
}
