import Foundation

enum NativeHostMessage: Decodable, Equatable, Sendable {
  case batch(NativeComponentBatch)
  case unreadableBatch
  case command(NativeComponentCommand)
  case response(NativeComponentResponse)
  case ready(sequence: Int)

  static let handlerName = "nativeIslands"

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
