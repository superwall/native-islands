import SwiftUI
import Testing
import UIKit
@testable import NativeIslands

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct ReuseTests {
    private func shown(_ harness: NativeTestHarness, _ id: String = "old") throws -> NativeIsland {
      harness.manager.apply(batch(1, mountOp(id)))
      return try #require(harness.island(id))
    }

    @Test("Keeps an unmounted island's view hidden, then shows it for the island that takes it over")
    func takesOverAKeptView() throws {
      let harness = NativeTestHarness()
      let old = try shown(harness)
      let view = old.view
      harness.manager.apply(batch(2, .unmount(id: "old")))
      #expect(harness.island("old") == nil)
      #expect(view.isHidden)
      #expect(view.superview != nil)

      harness.sent.removeAll()
      let frame = NativeFrame(x: 40, y: 300, width: 100, height: 44)
      harness.manager.apply(
        batch(3, mountOp("new", props: ["title": .string("Again")], frame: frame, order: 4, reuse: "old"))
      )
      let island = try #require(harness.island("new"))
      #expect(island === old)
      #expect(island.view === view)
      #expect(!view.isHidden)
      #expect(view.alpha == 1)
      #expect(island.order == 4)
      #expect(island.frame == frame)
      #expect(island.context.id == "new")
      #expect(island.context.sequence == 3)
      #expect(island.context.isAcknowledged)
      #expect(island.context.props.string("title") == "Again")
      #expect(harness.sent.first?.first == .ack(sequence: 3, ids: ["new"]))
    }

    @Test("Keeps a glass island's view in its group, and shows it for the island that takes it over")
    func takesOverAGlassView() throws {
      let harness = NativeTestHarness()
      harness.registry.register(
        "glassButton",
        glass: { _ in NativeGlass(shape: .circle) },
        content: { _ in Color.clear }
      )
      let props: [String: NativeValue] = ["title": .string("Continue"), "glassGroup": .string("bar")]
      harness.manager.apply(batch(1, mountOp("old", props: props)))
      let old = try #require(harness.island("old"))
      let glass = try #require(old.view as? NativeGlassView)
      let group = try #require(glass.superview?.superview as? NativeGlassGroupView)
      harness.manager.apply(batch(2, .unmount(id: "old")))
      #expect(glass.isHidden)
      #expect(group.superview != nil)

      harness.manager.apply(batch(3, mountOp("new", props: props, reuse: "old")))
      let island = try #require(harness.island("new"))
      #expect(island === old)
      #expect(island.view === glass)
      #expect(!glass.isHidden)
      #expect(glass.superview?.superview === group)
    }

    @Test("Takes over a view that goes away in the same batch")
    func takesOverInOneBatch() throws {
      let harness = NativeTestHarness()
      let old = try shown(harness)
      harness.manager.apply(batch(2, mountOp("new", reuse: "old"), .unmount(id: "old")))
      #expect(harness.island("new") === old)
      #expect(harness.island("old") == nil)
    }

    @Test("Takes over a view in a scroller WebKit has not resized yet")
    func takesOverBeforeTheScrollerGrows() throws {
      let harness = NativeTestHarness()
      let scrollView = harness.surface.addScroller(
        frame: CGRect(x: 0, y: 100, width: 400, height: 600),
        contentSize: CGSize(width: 400, height: 900)
      )
      let frame = NativeFrame(x: 0, y: 100, width: 400, height: 600)
      let short = scroller(frame: frame, contentSize: NativeSize(width: 400, height: 900))
      harness.manager.apply(batch(1, mountOp("old", anchor: short)))
      let old = try #require(harness.island("old"))
      #expect(old.view.superview === scrollView)
      harness.manager.apply(batch(2, .unmount(id: "old")))

      let long = scroller(frame: frame, contentSize: NativeSize(width: 400, height: 2000))
      harness.manager.apply(batch(3, mountOp("new", anchor: long, reuse: "old")))
      let island = try #require(harness.island("new"))
      #expect(island === old)
      #expect(island.view.superview === scrollView)
      #expect(!island.view.isHidden)
    }

    @Test("Builds a new view when the kept one is gone or does not fit")
    func buildsWhenNothingFits() throws {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp("missing", reuse: "nothing")))
      #expect(harness.island("missing") != nil)

      let old = try shown(harness)
      harness.manager.apply(batch(2, .unmount(id: "old")))
      harness.manager.apply(batch(3, mountOp("toggle", component: "toggle", reuse: "old")))
      let toggle = try #require(harness.island("toggle"))
      #expect(toggle !== old)
      #expect(old.view.superview == nil)
      #expect(harness.manager.retired.isEmpty)
    }

    @Test("Lets a kept view go after a while, past the limit, and on reset")
    func letsKeptViewsGo() throws {
      let harness = NativeTestHarness()
      let old = try shown(harness)
      harness.manager.apply(batch(2, .unmount(id: "old")))
      harness.expirations.forEach { $0() }
      #expect(harness.manager.retired.isEmpty)
      #expect(old.view.superview == nil)

      let count = NativeIslandManager.retiredLimit + 1
      let ids = (0..<count).map { "row-\($0)" }
      harness.manager.apply(NativeComponentBatch(sequence: 3, operations: ids.map { mountOp($0) }))
      harness.manager.apply(NativeComponentBatch(sequence: 4, operations: ids.map { .unmount(id: $0) }))
      #expect(harness.manager.retired.count == NativeIslandManager.retiredLimit)
      #expect(harness.manager.retired["row-0"] == nil)
      harness.expirations.forEach { $0() }

      harness.manager.apply(batch(5, mountOp("kept")))
      harness.manager.apply(batch(6, .unmount(id: "kept")))
      harness.manager.clear(notifyPage: false)
      #expect(harness.manager.retired.isEmpty)
    }

    @Test("Removes a kept view when a new island mounts under its id")
    func mountUnderTheSameId() throws {
      let harness = NativeTestHarness()
      let old = try shown(harness)
      harness.manager.apply(batch(2, .unmount(id: "old")))
      harness.manager.apply(batch(3, mountOp("old")))
      #expect(harness.island("old") !== old)
      #expect(old.view.superview == nil)
      #expect(harness.manager.retired.isEmpty)
    }

    @Test("Offers reuse in the capability and reads the page's request for it")
    func contract() throws {
      #expect(NativeCapability(components: ["symbol": 1]).features.contains(.reuse))
      let data = Data(
        #"{"op":"mount","id":"b","component":"symbol","version":1,"props":{},"frame":{"x":0,"y":0,"width":1,"height":1},"anchor":{"type":"page"},"visible":true,"order":0,"sizing":"web","reuse":"a"}"#
          .utf8
      )
      guard case .mount(let mount) = try JSONDecoder().decode(NativeOperation.self, from: data) else {
        Issue.record("Expected a mount")
        return
      }
      #expect(mount.reuse == "a")
    }
  }
}
