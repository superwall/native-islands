import Foundation
import Testing
@testable import NativeIslands

@Suite
struct CapabilityTests {
  @Test("Sets the capability global at document start, with sorted keys")
  func preloadScript() throws {
    let source = try #require(NativeCapability(components: ["toggle": 1, "glassButton": 2]).preloadScript)
    #expect(
      source == """
        window.__NATIVE_ISLANDS__ = {"anchors":["page","scroller","screen"],\
        "components":{"glassButton":2,"toggle":1},\
        "features":["state","requests","commands","layered","sticky","clip","transform"],"protocol":1};
        """
    )
  }

  @Test("Matches the shape of the contract's capability")
  func matchesContractShape() throws {
    let fixture = try #require(try ContractFixture.json()["capability"] as? [String: Any])
    let components = try #require(fixture["components"] as? [String: Int])
    let data = try JSONEncoder().encode(NativeCapability(components: components))
    let encoded = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
    #expect(NSDictionary(dictionary: encoded).isEqual(to: fixture))
  }

  @Test("Offers nothing without components, so the page keeps its web versions")
  func noComponentsNoScript() {
    #expect(NativeCapability(components: [:]).preloadScript == nil)
  }

  @Test("Escapes component names that would otherwise break out of the script")
  func escapesComponentNames() throws {
    let source = try #require(
      NativeCapability(
        components: ["</script><script>alert(1)</script>\u{2028}\u{2029}": 1],
        anchors: [.page],
        features: []
      ).preloadScript
    )
    #expect(!source.contains("</script>"))
    #expect(!source.contains("\u{2028}"))
    #expect(!source.contains("\u{2029}"))
    #expect(source.contains("\\u003C/script>"))
    #expect(source.contains(#""anchors":["page"]"#))
    #expect(source.contains(#""features":[]"#))
  }
}

@Suite
struct HostMessageTests {
  @Test("Decodes a message posted as a JSON string as well as an object")
  func decodesStringBodies() throws {
    let body = #"{"event_name":"native_component_command","id":"a","request_id":"r","name":"focus"}"#
    #expect(
      try NativeHostMessage.decode(body: body)
        == .command(NativeComponentCommand(id: "a", requestId: "r", name: "focus"))
    )
    #expect(NativeHostMessage.handlerName == "nativeIslands")
    #expect(NativeCapability.global == "__NATIVE_ISLANDS__")
  }

  @Test("Rejects messages meant for the page, unknown ones and malformed commands")
  func rejectsOtherMessages() {
    for body: Any in [
      ["event_name": "native_component_ack", "sequence": 1, "ids": []],
      ["event_name": "native_component_teleport"],
      ["event_name": "native_component_command", "id": "a"],
      ["event_name": "native_component_response", "id": "a", "request_id": "r"],
      ["id": "a"],
      "not json",
      42,
      NSNull()
    ] {
      #expect(throws: (any Error).self) { try NativeHostMessage.decode(body: body) }
    }
  }
}
