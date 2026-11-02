import Foundation
import SwiftUI
import Testing
@testable import NativeIslands

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct ContextTests {
    private func mounted(
      _ harness: NativeTestHarness,
      _ operation: NativeOperation = mountOp(),
      id: String = "cta"
    ) -> NativeComponentContext {
      harness.manager.apply(batch(1, operation))
      harness.sent.removeAll()
      return harness.island(id)!.context
    }

    private func posted(_ harness: NativeTestHarness) async {
      for _ in 0..<1000 where harness.scheduled.isEmpty {
        await Task.yield()
      }
      harness.runScheduled()
    }

    @Test
    func emitsEventsWithTheMountSequence() {
      let harness = NativeTestHarness()
      let context = mounted(harness)
      context.emit("press")
      context.emit("change", payload: ["isOn": true, "count": 2])
      harness.runScheduled()
      #expect(harness.sent == [
        [
          .event(id: "cta", name: "press", payload: nil, sequence: 1),
          .event(
            id: "cta",
            name: "change",
            payload: .object(["isOn": .bool(true), "count": .number(2)]),
            sequence: 1
          )
        ]
      ])
    }

    @Test
    func coalescesWhatViewsSendIntoOneMessagePerRunLoop() {
      let harness = NativeTestHarness()
      let context = mounted(harness)
      context.emit("a")
      context.emit("b")
      #expect(harness.scheduled.count == 1)
      #expect(harness.sent.isEmpty)
      harness.runScheduled()
      #expect(harness.sent.count == 1)
      harness.manager.flush()
      #expect(harness.sent.count == 1)
    }

    @Test
    func dropsEventsWhileHiddenOrNotYetAccepted() {
      let harness = NativeTestHarness()
      let context = mounted(harness, mountOp(visible: false))
      context.emit("press")
      let waiting = mounted(harness, mountOp("badge", component: "silentBadge"), id: "badge")
      waiting.emit("press")
      context.emit("")
      context.emit("bad", payload: Date())
      harness.runScheduled()
      #expect(harness.sent.isEmpty)
    }

    @Test
    func reportsStateWithARevisionPerMount() {
      let harness = NativeTestHarness()
      let context = mounted(harness)
      context.setState(["email": "a"])
      context.setState(["email": "ab", "agreed": false])
      context.setState(["email": "x"], replace: true)
      harness.runScheduled()
      #expect(harness.sent == [
        [
          .state(id: "cta", revision: 1, values: ["email": .string("a")], replace: false, sequence: 1),
          .state(
            id: "cta",
            revision: 2,
            values: ["email": .string("ab"), "agreed": .bool(false)],
            replace: false,
            sequence: 1
          ),
          .state(id: "cta", revision: 3, values: ["email": .string("x")], replace: true, sequence: 1)
        ]
      ])
      #expect(context.state as? [String: String] == ["email": "x"])
      harness.manager.apply(batch(2, mountOp()))
      harness.island("cta")?.context.setState(["email": "fresh"])
      harness.runScheduled()
      #expect(harness.sent.last?.last == .state(
        id: "cta",
        revision: 1,
        values: ["email": .string("fresh")],
        replace: false,
        sequence: 2
      ))
    }

    @Test
    func refusesStateJSONCannotCarry() {
      let harness = NativeTestHarness()
      let context = mounted(harness)
      context.setState(["when": Date()])
      #expect(context.revision == 0)
      #expect(harness.scheduled.isEmpty)
    }

    @Test
    func keepsLocalValuesUntilThePageHasSeenThem() {
      let harness = NativeTestHarness()
      let context = mounted(harness, mountOp(props: ["email": .string("")], stateRevision: 0))
      context.setState(["email": "ab"])
      #expect(context.props.string("email") == "ab")
      harness.manager.apply(
        batch(2, .update(NativeUpdate(id: "cta", props: ["email": .string("a")], stateRevision: 0)))
      )
      #expect(context.props.string("email") == "ab")
      harness.manager.apply(
        batch(3, .update(NativeUpdate(id: "cta", props: ["email": .string("ab")], stateRevision: 1)))
      )
      #expect(context.props.string("email") == "ab")
      harness.manager.apply(
        batch(4, .update(NativeUpdate(id: "cta", props: ["email": .string("")], stateRevision: 1)))
      )
      #expect(context.props.string("email")?.isEmpty == true)
      harness.manager.apply(batch(5, .update(NativeUpdate(id: "cta", stateRevision: 0))))
      #expect(context.props.string("email") == "ab")
    }

    @Test
    func dropsPropsThatEchoAnOlderState() {
      let harness = NativeTestHarness()
      let context = mounted(
        harness,
        mountOp(props: ["email": .string(""), "plan": .string("monthly")], stateRevision: 0)
      )
      context.setState(["email": "ab"])
      harness.manager.apply(
        batch(
          2,
          .update(
            NativeUpdate(id: "cta", props: ["email": .string("a"), "plan": .string("annual")], stateRevision: 0)
          )
        )
      )
      #expect(context.props.string("plan") == "monthly")
      #expect(context.props.string("email") == "ab")
      harness.manager.apply(
        batch(
          3,
          .update(
            NativeUpdate(id: "cta", props: ["email": .string("ab"), "plan": .string("annual")], stateRevision: 1)
          )
        )
      )
      #expect(context.props.string("plan") == "annual")
    }

    @Test
    func waitsForReadyBeforeAcknowledging() {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(3, mountOp("badge", component: "silentBadge")))
      #expect(harness.sent.isEmpty)
      let context = harness.island("badge")!.context
      #expect(context.isAcknowledged == false)
      context.ready()
      context.ready()
      harness.runScheduled()
      #expect(harness.sent == [[.ack(sequence: 3, ids: ["badge"])]])
      #expect(context.isAcknowledged)
      harness.island("cta")?.context.ready()
      mounted(harness).ready()
      #expect(harness.scheduled.isEmpty)
    }

    @Test
    func requestsResolveWithThePagesAnswer() async throws {
      let harness = NativeTestHarness()
      let context = mounted(harness)
      let answer = Task { try await context.request("validateEmail", payload: ["email": "a@b.co"]) }
      await posted(harness)
      let sent = try #require(harness.sent.last?.last)
      guard case let .request(id, requestId, name, payload, sequence) = sent else {
        Issue.record("expected a request, got \(sent)")
        return
      }
      #expect(id == "cta")
      #expect(name == "validateEmail")
      #expect(payload == .object(["email": .string("a@b.co")]))
      #expect(sequence == 1)
      harness.manager.receive(
        NativeComponentResponse(id: "cta", requestId: requestId, succeeded: true, value: .object([:]))
      )
      let result = try await answer.value
      #expect((result as? [String: Any])?.isEmpty == true)
    }

    @Test
    func requestsThrowWhatThePageRefused() async {
      let harness = NativeTestHarness()
      let context = mounted(harness)
      let answer = Task { try await context.request("check") }
      await posted(harness)
      guard case let .request(_, requestId, _, _, _) = harness.sent.last?.last else {
        Issue.record("no request")
        return
      }
      harness.manager.receive(
        NativeComponentResponse(id: "cta", requestId: requestId, succeeded: false, error: "Nope")
      )
      harness.manager.receive(NativeComponentResponse(id: "cta", requestId: requestId, succeeded: true))
      await #expect(throws: NativeComponentError.refused("Nope")) { try await answer.value }
    }

    @Test
    func requestsFailWhenTheIslandGoesOrThePageIsSilent() async {
      let harness = NativeTestHarness()
      let context = mounted(harness)
      let gone = Task { try await context.request("check") }
      await posted(harness)
      harness.manager.apply(batch(2, .unmount(id: "cta")))
      await #expect(throws: NativeComponentError.unmounted) { try await gone.value }

      let silent = mounted(harness)
      harness.manager.requestTimeoutNanoseconds = 1_000_000
      await #expect(throws: NativeComponentError.timedOut) {
        try await silent.request("check")
      }
      await #expect(throws: NativeComponentError.invalidValue) {
        try await silent.request("check", payload: Date())
      }
      let waiting = mounted(harness, mountOp("badge", component: "silentBadge"), id: "badge")
      await #expect(throws: NativeComponentError.notShowing) {
        try await waiting.request("check")
      }
      harness.manager.apply(batch(3, .unmount(id: "cta")))
      await #expect(throws: NativeComponentError.unmounted) {
        try await harness.manager.request(from: "cta", name: "check", payload: nil)
      }
    }

    @Test
    func answersCommandsWithTheHandlersResult() async throws {
      let harness = NativeTestHarness()
      let context = mounted(harness)
      var received: [(String, String?)] = []
      context.onCommand { name, args in
        received.append((name, (args as? [String: Any])?["field"] as? String))
        if name == "fail" { throw NativeComponentError.refused("Can't") }
        if name == "bad" { return Date() }
        if name == "nothing" { return nil }
        return ["focused": true]
      }
      harness.manager.perform(
        NativeComponentCommand(id: "cta", requestId: "r1", name: "focus", args: .object(["field": .string("email")]))
      )
      harness.manager.perform(NativeComponentCommand(id: "cta", requestId: "r2", name: "fail"))
      harness.manager.perform(NativeComponentCommand(id: "cta", requestId: "r3", name: "bad"))
      harness.manager.perform(NativeComponentCommand(id: "cta", requestId: "r4", name: "nothing"))
      for _ in 0..<1000 where harness.scheduled.isEmpty || harness.manager.outbox.count < 4 {
        await Task.yield()
      }
      harness.runScheduled()
      #expect(received.map(\.0) == ["focus", "fail", "bad", "nothing"])
      #expect(received.first?.1 == "email")
      #expect(harness.sent.flatMap { $0 } == [
        .reply(requestId: "r1", succeeded: true, value: .object(["focused": .bool(true)]), error: nil),
        .reply(requestId: "r2", succeeded: false, value: nil, error: "Can't"),
        .reply(
          requestId: "r3",
          succeeded: false,
          value: nil,
          error: NativeComponentError.invalidValue.localizedDescription
        ),
        .reply(requestId: "r4", succeeded: true, value: nil, error: nil)
      ])
    }

    @Test
    func refusesCommandsForMissingIslandsOrViewsWithoutAHandler() {
      let harness = NativeTestHarness()
      _ = mounted(harness)
      harness.manager.perform(NativeComponentCommand(id: "cta", requestId: "r1", name: "focus"))
      harness.manager.perform(NativeComponentCommand(id: "ghost", requestId: "r2", name: "focus"))
      harness.runScheduled()
      #expect(harness.sent.flatMap { $0 } == [
        .reply(requestId: "r1", succeeded: false, value: nil, error: "No native component cta takes commands."),
        .reply(requestId: "r2", succeeded: false, value: nil, error: "No native component ghost takes commands.")
      ])
    }
  }
}
