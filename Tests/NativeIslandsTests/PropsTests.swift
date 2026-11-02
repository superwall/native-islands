import Foundation
import Testing
@testable import NativeIslands

extension NativeBridgeTests {
  @Suite
  struct PropsTests {
    let props = NativeComponentProps([
      "title": .string("Go"),
      "count": .number(2.6),
      "on": .bool(true),
      "segments": .array([.string("A"), .string("B")]),
      "mixed": .array([.string("A"), .number(1)]),
      "tint": .string("rgb(255, 0, 0)"),
      "nothing": .null
    ])

    @Test
    func readsTypedValuesAndNilForAnythingElse() {
      #expect(props.string("title") == "Go")
      #expect(props.double("count") == 2.6)
      #expect(props.int("count") == 3)
      #expect(props.bool("on") == true)
      #expect(props.strings("segments") == ["A", "B"])
      #expect(props.strings("mixed") == nil)
      #expect(props.strings("title") == nil)
      #expect(props.string("count") == nil)
      #expect(props.int("title") == nil)
      #expect(props.bool("missing") == nil)
      #expect(props["title"] as? String == "Go")
      #expect(props["nothing"] is NSNull)
      #expect(props["missing"] == nil)
      #expect(Set(props.keys) == Set(props.all.keys))
      #expect(props.color("tint") != nil)
      #expect(props.color("title") == nil)
    }

    @Test(arguments: [
      ("rgb(255, 0, 0)", NativeComponentProps.RGBA(red: 1, green: 0, blue: 0, alpha: 1)),
      ("rgba(0, 0, 255, 0.5)", NativeComponentProps.RGBA(red: 0, green: 0, blue: 1, alpha: 0.5)),
      ("rgb(0 255 0 / 25%)", NativeComponentProps.RGBA(red: 0, green: 1, blue: 0, alpha: 0.25)),
      ("RGB(100%, 0%, 50%)", NativeComponentProps.RGBA(red: 1, green: 0, blue: 0.5, alpha: 1)),
      ("rgb(300, -5, 0)", NativeComponentProps.RGBA(red: 1, green: 0, blue: 0, alpha: 1))
    ])
    func parsesComputedCSSColours(css: String, expected: NativeComponentProps.RGBA) {
      #expect(NativeComponentProps.rgba(css) == expected)
    }

    @Test(arguments: ["red", "#ff0000", "hsl(0, 100%, 50%)", "rgb(1, 2)", "rgb(a, b, c)", "rgb(1, 2, 3", "rgb(nan, 0, 0)"])
    func refusesAnythingButRGB(css: String) {
      #expect(NativeComponentProps.rgba(css) == nil)
    }

    @Test
    func mapsAccessibility() {
      let full = NativeComponentAccessibility(
        NativeAccessibility(label: "Go", hint: "Buys", value: "On", traits: ["button"], hidden: true)
      )
      #expect(full.label == "Go")
      #expect(full.hint == "Buys")
      #expect(full.value == "On")
      #expect(full.traits == ["button"])
      #expect(full.isHidden)
      let empty = NativeComponentAccessibility(NativeAccessibility())
      #expect(empty.traits.isEmpty)
      #expect(!empty.isHidden)
    }
  }

  @Suite
  struct ValueConversionTests {
    @Test
    func wrapsJSONValues() {
      let converted = NativeValue(any: [
        "s": "x",
        "i": 2,
        "d": 1.5,
        "f": Float(0.5),
        "g": CGFloat(3),
        "b": true,
        "n": NSNull(),
        "list": [1, "a", false] as [Any],
        "nested": ["k": nil] as [String: Any?],
        "native": NativeValue.string("v")
      ] as [String: Any])
      #expect(converted == .object([
        "s": .string("x"),
        "i": .number(2),
        "d": .number(1.5),
        "f": .number(0.5),
        "g": .number(3),
        "b": .bool(true),
        "n": .null,
        "list": .array([.number(1), .string("a"), .bool(false)]),
        "nested": .object(["k": .null]),
        "native": .string("v")
      ]))
      #expect(NativeValue(any: nil) == .null)
      #expect(NativeValue(any: NSNumber(value: false)) == .bool(false))
      #expect(NativeValue(any: NSNumber(value: 0)) == .number(0))
    }

    @Test
    func refusesWhatJSONCannotCarry() {
      #expect(NativeValue(any: Date()) == nil)
      #expect(NativeValue(any: Double.nan) == nil)
      #expect(NativeValue(any: [Double.infinity] as [Any]) == nil)
      #expect(NativeValue(any: ["k": Date()] as [String: Any]) == nil)
    }

    @Test
    func unwrapsToFoundationTypes() {
      let value = NativeValue.object([
        "a": .array([.number(1), .bool(true), .null, .string("s")])
      ]).anyValue
      let list = (value as? [String: Any])?["a"] as? [Any]
      #expect(list?.count == 4)
      #expect(list?[0] as? Double == 1)
      #expect(list?[1] as? Bool == true)
      #expect(list?[2] is NSNull)
      #expect(list?[3] as? String == "s")
    }
  }
}
