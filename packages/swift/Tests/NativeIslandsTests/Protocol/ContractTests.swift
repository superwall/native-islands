import Foundation
import Testing
@testable import NativeIslands

enum ContractFixture {
  static let url = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent()
    .appendingPathComponent("../../../../../tests/fixtures/messages.json")
    .standardizedFileURL

  static func json() throws -> [String: Any] {
    let data = try Data(contentsOf: url)
    return try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
  }

  static func decode(_ bodies: [Any]) throws -> [NativeHostMessage] {
    try bodies.map(NativeHostMessage.decode(body:))
  }

  static func decodeBatch(_ batch: [String: Any]) throws -> NativeComponentBatch {
    guard case .batch(let decoded) = try NativeHostMessage.decode(body: batch) else {
      Issue.record("Expected a native component batch")
      throw CancellationError()
    }
    return decoded
  }
}

@Suite
struct ContractTests {
  @Test("Decodes every message the page sends in the contract")
  func decodesFixtureMessages() throws {
    let outgoing = try #require(try ContractFixture.json()["toHost"] as? [[String: Any]])
    let messages = try ContractFixture.decode(outgoing)
    #expect(messages.count == outgoing.count)

    let batches = messages.compactMap { message -> NativeComponentBatch? in
      if case .batch(let batch) = message { return batch }
      return nil
    }
    #expect(messages.contains(.ready(sequence: 3)))
    #expect(batches.map(\.sequence) == [1, 2, 3])
    #expect(
      batches[2].operations == [
        .update(NativeUpdate(id: "cta", props: ["title": .string("Continue")], stateRevision: 4))
      ]
    )
    #expect(
      Array(messages.suffix(3)) == [
        .command(
          NativeComponentCommand(
            id: "signup",
            requestId: "command-1",
            name: "focus",
            args: .object(["field": .string("email")])
          )
        ),
        .response(
          NativeComponentResponse(
            id: "signup",
            requestId: "request-7",
            succeeded: true,
            value: .object(["valid": .bool(false), "message": .string("Use a work email")])
          )
        ),
        .response(
          NativeComponentResponse(
            id: "signup",
            requestId: "request-8",
            succeeded: false,
            error: "No handler for checkCode"
          )
        )
      ]
    )
  }

  @Test("Decodes every mount and update in the contract's batches")
  func decodesFixtureOperations() throws {
    let toHost = try #require(try ContractFixture.json()["toHost"] as? [[String: Any]])
    let batches = try ContractFixture.decode(toHost).compactMap { message -> NativeComponentBatch? in
      if case .batch(let batch) = message { return batch }
      return nil
    }
    let first = batches[0].operations
    #expect(first.count == 3)
    guard case .mount(let cta) = first[0] else {
      Issue.record("Expected a mount")
      return
    }
    #expect(cta.id == "cta")
    #expect(cta.component == "glassButton")
    #expect(cta.version == 1)
    #expect(cta.props["title"] == .string("Continue"))
    #expect(cta.props["prominence"] == .string("prominent"))
    #expect(cta.props["tint"] == .string("rgb(10, 132, 255)"))
    #expect(cta.frame == NativeFrame(x: 24, y: 712, width: 354, height: 52))
    #expect(cta.anchor == .page)
    #expect(cta.visible)
    #expect(cta.order == 0)
    #expect(cta.sizing == .web)
    #expect(cta.accessibility == NativeAccessibility(label: "Continue", traits: ["button"]))

    guard case .mount(let toggle) = first[1] else {
      Issue.record("Expected a mount")
      return
    }
    #expect(toggle.sizing == .native)
    #expect(toggle.props["isOn"] == .bool(true))
    #expect(toggle.accessibility == nil)
    #expect(
      toggle.anchor == .scroller(
        NativeScroller(
          id: "plans",
          frame: NativeFrame(x: 24, y: 320, width: 354, height: 200),
          contentSize: NativeSize(width: 354, height: 640),
          scrollOffset: NativePoint(x: 0, y: 0)
        )
      )
    )

    guard case .mount(let close) = first[2] else {
      Issue.record("Expected a mount")
      return
    }
    #expect(close.anchor == .screen)
    #expect(close.props.isEmpty)

    #expect(
      batches[1].operations == [
        .update(NativeUpdate(id: "cta", frame: NativeFrame(x: 24, y: 700, width: 354, height: 52))),
        .update(Self.stuckToggle),
        .update(Self.tilted),
        .unmount(id: "close")
      ]
    )
  }

  private static let tilted = NativeUpdate(
    id: "tilted",
    frame: NativeFrame(x: 24, y: 300, width: 160, height: 44),
    transform: NativeTransform(a: 0.9976, b: -0.0698, c: 0.0698, d: 0.9976),
    opacity: 0.5
  )

  private static let stuckToggle = NativeUpdate(
    id: "plans-annual",
    frame: NativeFrame(x: 296, y: 12, width: 51, height: 31),
    visible: false,
    sticky: NativeSticky(
      top: nil,
      bottom: 12,
      box: NativeFrame(x: 0, y: 0, width: 354, height: 56),
      bounds: NativeFrame(x: 0, y: 0, width: 354, height: 640)
    ),
    clip: NativeFrame(x: 0, y: 0, width: 51, height: 20),
    holes: [NativeFrame(x: 0, y: 12, width: 51, height: 8)],
    shades: [NativeShade(x: 0, y: 0, width: 51, height: 12, color: "rgba(0, 0, 0, 0.4)")]
  )

  @Test("Encodes every reply as the contract's messages to the page")
  func encodesFixtureReplies() throws {
    let incoming = try #require(try ContractFixture.json()["toPage"] as? [[String: Any]])
    let replies: [NativeReply] = [
      .ack(sequence: 1, ids: ["cta", "plans-annual"]),
      .error(
        id: "close",
        reason: .unknownComponent,
        message: "closeButton is not registered",
        sequence: nil
      ),
      .event(id: "cta", name: "press", payload: nil, sequence: nil),
      .event(id: "cta", name: "press", payload: nil, sequence: 1),
      .event(id: "plans-annual", name: "change", payload: .object(["isOn": .bool(false)]), sequence: nil),
      .size(id: "plans-annual", size: NativeSize(width: 51, height: 31), sequence: nil),
      .reset,
      .size(id: "plans-annual", size: NativeSize(width: 51, height: 31), sequence: 1),
      .state(
        id: "signup",
        revision: 4,
        values: ["email": .string("ada@example.com"), "agreed": .bool(true)],
        replace: false,
        sequence: 1
      ),
      .state(
        id: "signup",
        revision: 5,
        values: ["email": .string(""), "agreed": .bool(false), "plan": .string("annual")],
        replace: true,
        sequence: nil
      ),
      .request(
        id: "signup",
        requestId: "request-7",
        name: "validate",
        payload: .object(["email": .string("ada@gmail.com")]),
        sequence: nil
      ),
      .reply(requestId: "command-1", succeeded: true, value: nil, error: nil),
      .reply(requestId: "command-2", succeeded: false, value: nil, error: "unknown command")
    ]
    let base64 = try #require(NativeReply.base64(replies))
    let data = try #require(Data(base64Encoded: base64))
    let encoded = try #require(try JSONSerialization.jsonObject(with: data) as? [[String: Any]])

    #expect(encoded.count == incoming.count)
    for (mine, theirs) in zip(encoded, incoming) {
      #expect(NSDictionary(dictionary: mine).isEqual(to: theirs), "\(mine) != \(theirs)")
    }
  }
}

@Suite
struct BatchDecodingTests {
  @Test("Sends nothing for no replies")
  func noRepliesNoMessage() {
    #expect(NativeReply.base64([]) == nil)
  }

  @Test("Keeps prop keys exactly as the page named them")
  func keepsPropKeys() throws {
    let batch = try ContractFixture.decodeBatch(
      mountBatch(props: [
        "max_value": 5,
        "isOn": true,
        "nested": ["snake_key": "a", "list": [1, "two", NSNull()]]
      ])
    )
    guard case .mount(let mount) = batch.operations.first else {
      Issue.record("Expected a mount")
      return
    }
    #expect(mount.props["max_value"] == .number(5))
    #expect(mount.props["isOn"] == .bool(true))
    #expect(
      mount.props["nested"] == .object([
        "snake_key": .string("a"),
        "list": .array([.number(1), .string("two"), .null])
      ])
    )
  }

  @Test("Turns an invalid operation into an invalid one, keeping its id, without losing the batch")
  func invalidOperations() throws {
    var bad = mountOperation(id: "bad")
    bad["frame"] = ["x": 0, "y": 0, "width": -1, "height": 4]
    var noVersion = mountOperation(id: "no-version")
    noVersion["version"] = 0
    var badOrder = mountOperation(id: "bad-order")
    badOrder["order"] = -1
    let batch = try ContractFixture.decodeBatch([
      "event_name": "native_component_batch",
      "protocol": 1,
      "sequence": 4,
      "operations": [
        mountOperation(id: "good"),
        bad,
        noVersion,
        badOrder,
        ["op": "update", "id": "frame", "frame": ["x": 0, "y": 0, "width": 1, "height": -1]],
        ["op": "update", "id": "order", "order": -2],
        ["op": "update", "id": "revision", "state_revision": -1],
        ["op": "teleport", "id": "what"],
        ["op": "unmount", "id": ""],
        ["op": "unmount", "id": String(repeating: "x", count: 129)],
        ["op": "unmount"]
      ]
    ])
    #expect(batch.operations.first?.id == "good")
    #expect(
      Array(batch.operations.dropFirst()) == [
        .invalid(id: "bad"),
        .invalid(id: "no-version"),
        .invalid(id: "bad-order"),
        .invalid(id: "frame"),
        .invalid(id: "order"),
        .invalid(id: "revision"),
        .invalid(id: "what"),
        .invalid(id: nil),
        .invalid(id: nil),
        .invalid(id: nil)
      ]
    )
  }

  @Test("Rejects batches of a later protocol, and recovers from unreadable ones of its own")
  func rejectsForeignBatches() throws {
    let operations = [mountOperation(id: "a")]
    #expect(throws: (any Error).self) {
      try ContractFixture.decode([
        ["event_name": "native_component_batch", "protocol": 2, "sequence": 1, "operations": operations]
      ])
    }
    for batch: [String: Any] in [
      ["event_name": "native_component_batch", "protocol": 1, "sequence": 0, "operations": operations],
      ["event_name": "native_component_batch", "protocol": 1, "sequence": 1, "operations": []],
      [
        "event_name": "native_component_batch",
        "protocol": 1,
        "sequence": 1,
        "operations": Array(repeating: ["op": "unmount", "id": "a"], count: 257)
      ]
    ] {
      #expect(try ContractFixture.decode([batch]) == [.unreadableBatch])
    }
  }

  @Test("Decodes every anchor and drops a scroller anchor without its scroller")
  func anchors() throws {
    var screen = mountOperation(id: "s")
    screen["anchor"] = ["type": "screen"]
    var broken = mountOperation(id: "b")
    broken["anchor"] = ["type": "scroller"]
    var unknown = mountOperation(id: "u")
    unknown["anchor"] = ["type": "floating"]
    let batch = try ContractFixture.decodeBatch([
      "event_name": "native_component_batch",
      "protocol": 1,
      "sequence": 1,
      "operations": [screen, broken, unknown]
    ])
    guard case .mount(let mount) = batch.operations[0] else {
      Issue.record("Expected a mount")
      return
    }
    #expect(mount.anchor == .screen)
    #expect(mount.anchor.type == .screen)
    #expect(batch.operations[1] == .invalid(id: "b"))
    #expect(batch.operations[2] == .invalid(id: "u"))
  }

  @Test("Round-trips anchors and values through their encoders")
  func roundTrips() throws {
    let anchors: [NativeAnchor] = [
      .page,
      .screen,
      .scroller(
        NativeScroller(
          id: "list",
          frame: NativeFrame(x: 1, y: 2, width: 3, height: 4),
          contentSize: NativeSize(width: 3, height: 40),
          scrollOffset: NativePoint(x: 0, y: 12)
        )
      )
    ]
    let data = try JSONEncoder().encode(anchors)
    #expect(try JSONDecoder().decode([NativeAnchor].self, from: data) == anchors)
    #expect(anchors.map(\.type) == [.page, .screen, .scroller])

    let value = NativeValue.object([
      "a": .array([.bool(true), .number(1.5), .string("x"), .null])
    ])
    let valueData = try JSONEncoder().encode(value)
    #expect(try JSONDecoder().decode(NativeValue.self, from: valueData) == value)
  }

  @Test("Reads typed values out of props")
  func valueAccessors() {
    #expect(NativeValue.string("a").stringValue == "a")
    #expect(NativeValue.number(1).stringValue == nil)
    #expect(NativeValue.number(2).doubleValue == 2)
    #expect(NativeValue.bool(true).doubleValue == nil)
    #expect(NativeValue.bool(true).boolValue == true)
    #expect(NativeValue.null.boolValue == nil)
    #expect(NativeValue.array([.null]).arrayValue == [.null])
    #expect(NativeValue.string("a").arrayValue == nil)
  }

  @Test("Checks frames for values a view cannot take")
  func frameValidity() {
    #expect(NativeFrame(x: -10, y: 0, width: 0, height: 0).isValid)
    #expect(!NativeFrame(x: .nan, y: 0, width: 1, height: 1).isValid)
    #expect(!NativeFrame(x: 0, y: .infinity, width: 1, height: 1).isValid)
    #expect(!NativeFrame(x: 0, y: 0, width: -1, height: 1).isValid)
    #expect(NativeFrame(x: 1, y: 2, width: 3, height: 4).cgRect == CGRect(x: 1, y: 2, width: 3, height: 4))
  }

  private func mountOperation(id: String, props: [String: Any] = [:]) -> [String: Any] {
    [
      "op": "mount",
      "id": id,
      "component": "glassButton",
      "version": 1,
      "props": props,
      "frame": ["x": 0, "y": 0, "width": 10, "height": 10],
      "anchor": ["type": "page"],
      "visible": true,
      "order": 0,
      "sizing": "web"
    ]
  }

  private func mountBatch(props: [String: Any]) -> [String: Any] {
    [
      "event_name": "native_component_batch",
      "protocol": 1,
      "sequence": 1,
      "operations": [mountOperation(id: "a", props: props)]
    ]
  }
}
