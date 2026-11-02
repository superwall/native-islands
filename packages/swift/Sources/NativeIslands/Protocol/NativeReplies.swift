import Foundation

enum NativeErrorReason: String, Codable, Sendable {
  case unknownComponent = "unknown_component"
  case unsupportedVersion = "unsupported_version"
  case invalidProps = "invalid_props"
  case anchorNotFound = "anchor_not_found"
  case renderFailed = "render_failed"
  case limitExceeded = "limit_exceeded"
  case duplicateId = "duplicate_id"
}

enum NativeReply: Encodable, Equatable, Sendable {
  case ack(sequence: Int, ids: [String])
  case error(id: String, reason: NativeErrorReason, message: String?, sequence: Int?)
  case event(id: String, name: String, payload: NativeValue?, sequence: Int?)
  case size(id: String, size: NativeSize, sequence: Int?)
  case reset
  // swiftlint:disable:next enum_case_associated_values_count
  case state(id: String, revision: Int, values: [String: NativeValue], replace: Bool, sequence: Int?)
  // swiftlint:disable:next enum_case_associated_values_count
  case request(id: String, requestId: String, name: String, payload: NativeValue?, sequence: Int?)
  case reply(requestId: String, succeeded: Bool, value: NativeValue?, error: String?)

  private enum CodingKeys: String, CodingKey {
    case eventName = "event_name"
    case sequence
    case ids
    case id
    case reason
    case message
    case name
    case payload
    case size
    case revision
    case values
    case replace
    case requestId = "request_id"
    case succeeded = "ok"
    case value
    case error
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    switch self {
    case let .ack(sequence, ids):
      try container.encode("native_component_ack", forKey: .eventName)
      try container.encode(sequence, forKey: .sequence)
      try container.encode(ids, forKey: .ids)
    case let .error(id, reason, message, sequence):
      try container.encode("native_component_error", forKey: .eventName)
      try container.encode(id, forKey: .id)
      try container.encode(reason, forKey: .reason)
      try container.encodeIfPresent(message, forKey: .message)
      try container.encodeIfPresent(sequence, forKey: .sequence)
    case let .event(id, name, payload, sequence):
      try container.encode("native_component_event", forKey: .eventName)
      try container.encode(id, forKey: .id)
      try container.encode(name, forKey: .name)
      try container.encodeIfPresent(payload, forKey: .payload)
      try container.encodeIfPresent(sequence, forKey: .sequence)
    case let .size(id, size, sequence):
      try container.encode("native_component_size", forKey: .eventName)
      try container.encode(id, forKey: .id)
      try container.encode(size, forKey: .size)
      try container.encodeIfPresent(sequence, forKey: .sequence)
    case .reset:
      try container.encode("native_component_reset", forKey: .eventName)
    case let .state(id, revision, values, replace, sequence):
      try container.encode("native_component_state", forKey: .eventName)
      try container.encode(id, forKey: .id)
      try container.encode(revision, forKey: .revision)
      try container.encode(values, forKey: .values)
      if replace {
        try container.encode(true, forKey: .replace)
      }
      try container.encodeIfPresent(sequence, forKey: .sequence)
    case let .request(id, requestId, name, payload, sequence):
      try container.encode("native_component_request", forKey: .eventName)
      try container.encode(id, forKey: .id)
      try container.encode(requestId, forKey: .requestId)
      try container.encode(name, forKey: .name)
      try container.encodeIfPresent(payload, forKey: .payload)
      try container.encodeIfPresent(sequence, forKey: .sequence)
    case let .reply(requestId, succeeded, value, error):
      try container.encode("native_component_reply", forKey: .eventName)
      try container.encode(requestId, forKey: .requestId)
      try container.encode(succeeded, forKey: .succeeded)
      try container.encodeIfPresent(value, forKey: .value)
      try container.encodeIfPresent(error, forKey: .error)
    }
  }

  static func base64(_ replies: [NativeReply]) -> String? {
    guard !replies.isEmpty else { return nil }
    let encoder = JSONEncoder()
    encoder.outputFormatting = .sortedKeys
    return try? encoder.encode(replies).base64EncodedString()
  }
}
