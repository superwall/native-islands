import Foundation

/// A message the page posts to the `nativeIslands` message handler.
enum NativeHostMessage: Decodable, Equatable, Sendable {
  case batch(NativeComponentBatch)
  /// A batch of this host's protocol that failed to decode. The host clears
  /// its islands and asks the page to mount them all again.
  case unreadableBatch
  case command(NativeComponentCommand)
  case response(NativeComponentResponse)

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
  }

  private enum CodingKeys: String, CodingKey {
    case eventName
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
    }
  }

  /// Decodes what `WKScriptMessage.body` carries: a JSON string, or the
  /// object WebKit converted it to.
  static func decode(body: Any) throws -> NativeHostMessage {
    let data: Data
    if let string = body as? String {
      data = Data(string.utf8)
    } else {
      data = try JSONSerialization.data(withJSONObject: body)
    }
    return try decoder.decode(NativeHostMessage.self, from: data)
  }
}
