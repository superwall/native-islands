import Foundation

/// A message the page posts to the `nativeIslands` message handler.
enum NativeHostMessage: Decodable, Equatable, Sendable {
  case batch(NativeComponentBatch)
  /// A batch of this host's protocol that failed to decode. The host clears
  /// its islands and asks the page to mount them all again.
  case unreadableBatch
  case command(NativeComponentCommand)
  case response(NativeComponentResponse)
  /// Every island the page rendered is drawn or settled on its web version,
  /// as of the batch with this sequence (`0` when none was sent).
  case ready(sequence: Int)

  /// The name of the `WKScriptMessageHandler` the page posts to.
  static let handlerName = "nativeIslands"

  /// Converts snake-case keys, as every message on the bridge uses them.
  static var decoder: JSONDecoder {
    let decoder = JSONDecoder()
    decoder.keyDecodingStrategy = .convertFromSnakeCase
    return decoder
  }

  private enum Name: String, Decodable {
    case batch = "native_component_batch"
    case command = "native_component_command"
    case response = "native_component_response"
    case ready = "native_islands_ready"
  }

  private enum CodingKeys: String, CodingKey {
    case eventName
    case sequence
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    switch try container.decode(Name.self, forKey: .eventName) {
    case .batch:
      if let batch = try? NativeComponentBatch(from: decoder) {
        self = .batch(batch)
      } else if NativeComponentBatch.isCurrentProtocol(decoder) {
        self = .unreadableBatch
      } else {
        throw DecodingError.dataCorruptedError(
          forKey: .eventName,
          in: container,
          debugDescription: "A native component batch of another protocol."
        )
      }
    case .command:
      self = .command(try NativeComponentCommand(from: decoder))
    case .response:
      self = .response(try NativeComponentResponse(from: decoder))
    case .ready:
      let sequence = try container.decode(Int.self, forKey: .sequence)
      guard sequence >= 0 else {
        throw DecodingError.dataCorruptedError(
          forKey: .sequence,
          in: container,
          debugDescription: "A ready sequence is never negative."
        )
      }
      self = .ready(sequence: sequence)
    }
  }

  /// Decodes what `WKScriptMessage.body` carries: a JSON string, or the
  /// object WebKit converted it to.
  static func decode(body: Any) throws -> NativeHostMessage {
    let data: Data
    if let string = body as? String {
      data = Data(string.utf8)
    } else if JSONSerialization.isValidJSONObject(body) {
      data = try JSONSerialization.data(withJSONObject: body)
    } else {
      throw DecodingError.dataCorrupted(
        DecodingError.Context(codingPath: [], debugDescription: "The message is not a JSON object.")
      )
    }
    return try decoder.decode(NativeHostMessage.self, from: data)
  }
}
