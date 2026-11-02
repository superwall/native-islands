import SwiftUI
import Testing
import UIKit
@testable import NativeIslands

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct StickyTests {
    private let footer = NativeSticky(
      top: nil,
      bottom: 12,
      box: NativeFrame(x: 0, y: 900, width: 400, height: 60),
      bounds: NativeFrame(x: 0, y: 0, width: 400, height: 1000)
    )

    @Test("Sticks a bottom box to the viewport until its natural spot scrolls into view")
    func bottomStickiness() {
      #expect(footer.shift(offset: 0, height: 800) == -172)
      #expect(footer.shift(offset: 100, height: 800) == -72)
      #expect(footer.shift(offset: 172, height: 800) == 0)
      #expect(footer.shift(offset: 400, height: 800) == 0)
    }

    @Test("Never moves a bottom box above its containing block")
    func bottomBounds() {
      let short = NativeSticky(
        top: nil,
        bottom: 0,
        box: NativeFrame(x: 0, y: 900, width: 400, height: 60),
        bounds: NativeFrame(x: 0, y: 500, width: 400, height: 460)
      )
      #expect(short.shift(offset: 0, height: 300) == -400)
    }

    @Test("Sticks a top box and stops it at the end of its containing block")
    func topStickiness() {
      let header = NativeSticky(
        top: 8,
        bottom: nil,
        box: NativeFrame(x: 0, y: 100, width: 400, height: 50),
        bounds: NativeFrame(x: 0, y: 0, width: 400, height: 600)
      )
      #expect(header.shift(offset: 0, height: 800) == 0)
      #expect(header.shift(offset: 200, height: 800) == 108)
      #expect(header.shift(offset: 1000, height: 800) == 450)
    }

    @Test("Keeps a sticky island stuck as its scroll view scrolls, and unsticks it on a plain frame")
    func followsScrolling() {
      let harness = NativeTestHarness()
      let list = harness.surface.addScroller(
        frame: CGRect(x: 0, y: 0, width: 400, height: 800),
        contentSize: CGSize(width: 400, height: 1000)
      )
      let anchor = scroller(
        frame: NativeFrame(x: 0, y: 0, width: 400, height: 800),
        contentSize: NativeSize(width: 400, height: 1000)
      )
      let natural = NativeFrame(x: 20, y: 908, width: 360, height: 44)
      var mount = mountOp(frame: natural, anchor: anchor)
      if case .mount(var value) = mount {
        value.sticky = footer
        mount = .mount(value)
      }
      harness.manager.apply(batch(1, mount))
      let view = harness.island("cta")?.view
      #expect(view?.superview === list)
      #expect(view?.frame.minY == 736)

      list.contentOffset = CGPoint(x: 0, y: 100)
      #expect(view?.frame.minY == 836)

      list.contentOffset = CGPoint(x: 0, y: 200)
      #expect(view?.frame.minY == 908)

      harness.manager.apply(batch(2, .update(NativeUpdate(id: "cta", frame: natural))))
      list.contentOffset = .zero
      #expect(view?.frame.minY == 908)
    }

    @Test("Cuts an island to its clip and drops the cut on a frame without one")
    func clips() throws {
      let harness = NativeTestHarness()
      let frame = NativeFrame(x: 10, y: 20, width: 100, height: 44)
      harness.manager.apply(batch(1, mountOp(frame: frame)))
      let view = try #require(harness.island("cta")?.view)
      #expect(view.mask == nil)

      let clip = NativeFrame(x: 0, y: 0, width: 100, height: 10)
      harness.manager.apply(batch(2, .update(NativeUpdate(id: "cta", frame: frame, clip: clip))))
      #expect(view.mask?.frame == CGRect(x: 0, y: 0, width: 100, height: 10))

      harness.manager.apply(batch(3, .update(NativeUpdate(id: "cta", frame: frame))))
      #expect(view.mask == nil)
    }

    @Test("Refuses a sticky box or clip with values a view cannot take")
    func refusesInvalidGeometry() throws {
      let json = #"{"op":"update","id":"cta","frame":{"x":0,"y":0,"width":10,"height":10},"#
        + #""clip":{"x":0,"y":0,"width":-1,"height":10}}"#
      let operation = try NativeHostMessage.decoder.decode(NativeOperation.self, from: Data(json.utf8))
      #expect(operation == .invalid(id: "cta"))
    }
  }
}
