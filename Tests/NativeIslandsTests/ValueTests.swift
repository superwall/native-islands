import Foundation
import Testing
@testable import NativeIslands

@Suite
struct ValueTests {
  @Test("Wraps the Foundation values JSON can carry")
  func wrapsFoundationValues() {
    #expect(NativeValue(any: nil) == .null)
    #expect(NativeValue(any: NSNull()) == .null)
    #expect(NativeValue(any: NativeValue.string("x")) == .string("x"))
    #expect(NativeValue(any: "a") == .string("a"))
    #expect(NativeValue(any: true) == .bool(true))
    #expect(NativeValue(any: 2) == .number(2))
    #expect(NativeValue(any: [1, "b"] as [Any?]) == .array([.number(1), .string("b")]))
    #expect(NativeValue(any: ["k": false] as [String: Any?]) == .object(["k": .bool(false)]))
  }

  @Test("Refuses what JSON cannot carry, even nested")
  func refusesOtherValues() {
    #expect(NativeValue(any: Date()) == nil)
    #expect(NativeValue(any: Double.nan) == nil)
    #expect(NativeValue(any: [Date()] as [Any?]) == nil)
    #expect(NativeValue(any: ["k": Date()] as [String: Any?]) == nil)
  }

  @Test("Turns back into Foundation values")
  func anyValues() throws {
    let value = NativeValue.object([
      "s": .string("a"),
      "n": .number(1),
      "b": .bool(true),
      "l": .array([.null])
    ])
    let any = try #require(value.anyValue as? [String: Any])
    #expect(any["s"] as? String == "a")
    #expect(any["n"] as? Double == 1)
    #expect(any["b"] as? Bool == true)
    #expect((any["l"] as? [Any])?.first is NSNull)
  }
}
