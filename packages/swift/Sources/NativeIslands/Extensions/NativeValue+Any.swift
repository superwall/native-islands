import Foundation

extension NativeValue {
  init?(any value: Any?) {
    guard let value else {
      self = .null
      return
    }
    switch value {
    case let value as NativeValue:
      self = value
    case is NSNull:
      self = .null
    case let value as String:
      self = .string(value)
    case let value as NSNumber:
      if CFGetTypeID(value) == CFBooleanGetTypeID() {
        self = .bool(value.boolValue)
        return
      }
      guard value.doubleValue.isFinite else { return nil }
      self = .number(value.doubleValue)
    case let value as [Any?]:
      var items: [NativeValue] = []
      for item in value {
        guard let converted = NativeValue(any: item) else { return nil }
        items.append(converted)
      }
      self = .array(items)
    case let value as [String: Any?]:
      var entries: [String: NativeValue] = [:]
      for (key, item) in value {
        guard let converted = NativeValue(any: item) else { return nil }
        entries[key] = converted
      }
      self = .object(entries)
    default:
      return nil
    }
  }

  var anyValue: Any {
    switch self {
    case .string(let value):
      return value
    case .number(let value):
      return value
    case .bool(let value):
      return value
    case .array(let value):
      return value.map(\.anyValue)
    case .object(let value):
      return value.mapValues(\.anyValue)
    case .null:
      return NSNull()
    }
  }
}
