import Foundation

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

enum NativeFeature: String, Codable, CaseIterable, Sendable {
  case state
  case requests
  case commands
  case layered
  case sticky
  case clip
  case transform
  case motion
}

extension NativeCapability {
  static let global = "__NATIVE_ISLANDS__"

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
