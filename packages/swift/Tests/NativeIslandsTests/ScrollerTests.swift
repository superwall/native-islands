import Testing
import UIKit
@testable import NativeIslands

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct ScrollerTests {
    @Test
    func mountsInsideTheScrollerWithTheSameSizeContentAndOffset() {
      let harness = NativeTestHarness()
      let list = harness.surface.addScroller(
        frame: CGRect(x: 20, y: 300, width: 360, height: 200),
        contentSize: CGSize(width: 360, height: 800),
        offset: CGPoint(x: 0, y: 150)
      )
      harness.surface.addScroller(
        frame: CGRect(x: 20, y: 600, width: 360, height: 200),
        contentSize: CGSize(width: 360, height: 900)
      )
      harness.manager.apply(
        batch(
          1,
          mountOp(
            frame: NativeFrame(x: 18, y: 178, width: 100, height: 40),
            anchor: scroller(
              frame: NativeFrame(x: 20, y: 300, width: 360, height: 200),
              contentSize: NativeSize(width: 360, height: 800),
              offset: NativePoint(x: 0, y: 150)
            )
          )
        )
      )
      #expect(harness.island("cta")?.view.superview === list)
      #expect(harness.island("cta")?.view.frame == CGRect(x: 18, y: 178, width: 100, height: 40))
    }

    @Test
    func findsScrollersNestedAnywhereInThePage() {
      let harness = NativeTestHarness()
      let wrapper = UIView(frame: CGRect(x: 0, y: 100, width: 400, height: 400))
      harness.surface.pageScrollView.addSubview(wrapper)
      let route = harness.surface.addScroller(
        frame: CGRect(x: 0, y: 0, width: 400, height: 400),
        contentSize: CGSize(width: 400, height: 1200),
        in: wrapper
      )
      let carousel = harness.surface.addScroller(
        frame: CGRect(x: 0, y: 50, width: 300, height: 100),
        contentSize: CGSize(width: 900, height: 100),
        in: route
      )
      #expect(NativeScrollerMatcher.candidates(in: harness.surface.pageScrollView) == [route, carousel])
    }

    @Test
    func picksTheNearestWhenTwoRouteScrollersMatchDuringAPush() {
      let harness = NativeTestHarness()
      harness.surface.addScroller(
        frame: CGRect(x: 120, y: 0, width: 400, height: 800),
        contentSize: CGSize(width: 400, height: 1600)
      )
      let settled = harness.surface.addScroller(
        frame: CGRect(x: 0, y: 0, width: 400, height: 800),
        contentSize: CGSize(width: 400, height: 1600)
      )
      let anchor = scroller(
        frame: NativeFrame(x: 3, y: 0, width: 400, height: 800),
        contentSize: NativeSize(width: 400, height: 1600)
      )
      harness.manager.apply(batch(1, mountOp(anchor: anchor)))
      #expect(harness.island("cta")?.view.superview === settled)
    }

    @Test
    func toleratesAPointOfDifference() {
      let harness = NativeTestHarness()
      let list = harness.surface.addScroller(
        frame: CGRect(x: 0, y: 0, width: 300, height: 200),
        contentSize: CGSize(width: 300, height: 600),
        offset: CGPoint(x: 0, y: 40)
      )
      harness.manager.apply(
        batch(
          1,
          mountOp(
            anchor: scroller(
              frame: NativeFrame(x: 40, y: 90, width: 300.8, height: 199.2),
              contentSize: NativeSize(width: 300.5, height: 600.9),
              offset: NativePoint(x: 0.4, y: 40.9)
            )
          )
        )
      )
      #expect(harness.island("cta")?.view.superview === list)
    }

    @Test
    func refusesAScrollerNothingMatches() {
      let harness = NativeTestHarness()
      harness.surface.addScroller(
        frame: CGRect(x: 0, y: 0, width: 300, height: 200),
        contentSize: CGSize(width: 300, height: 600)
      )
      harness.manager.apply(
        batch(
          7,
          mountOp(
            anchor: scroller(
              frame: NativeFrame(x: 0, y: 0, width: 300, height: 200),
              contentSize: NativeSize(width: 300, height: 600),
              offset: NativePoint(x: 0, y: 99)
            )
          )
        )
      )
      #expect(harness.island("cta") == nil)
      #expect(harness.sent.isEmpty)
      for _ in 0..<NativeIslandManager.parkingAttempts {
        harness.runRetries()
      }
      #expect(harness.retries.isEmpty)
      #expect(harness.manager.parked.isEmpty)
      #expect(harness.sent.first?.first.map { reply in
        if case .error("cta", .anchorNotFound, _, 7) = reply { return true }
        return false
      } == true)
    }

    @Test
    func drawsAParkedMountOnceWebKitBuildsItsScroller() {
      let harness = NativeTestHarness()
      let anchor = scroller(
        frame: NativeFrame(x: 0, y: 0, width: 300, height: 200),
        contentSize: NativeSize(width: 300, height: 600)
      )
      harness.manager.apply(batch(4, mountOp(anchor: anchor)))
      harness.manager.apply(
        batch(5, .update(NativeUpdate(id: "cta", frame: NativeFrame(x: 5, y: 6, width: 120, height: 44))))
      )
      #expect(harness.island("cta") == nil)
      #expect(harness.sent.isEmpty)
      harness.runRetries()
      #expect(harness.sent.isEmpty)
      let list = harness.surface.addScroller(
        frame: CGRect(x: 0, y: 0, width: 300, height: 200),
        contentSize: CGSize(width: 300, height: 600)
      )
      harness.runRetries()
      #expect(harness.island("cta")?.view.superview === list)
      #expect(harness.island("cta")?.view.frame == CGRect(x: 5, y: 6, width: 120, height: 44))
      #expect(harness.island("cta")?.context.isAcknowledged == true)
      #expect(harness.sent.first?.first == .ack(sequence: 4, ids: ["cta"]))
      #expect(harness.retries.isEmpty)
    }

    @Test
    func forgetsAParkedMountThePageUnmountsOrClears() {
      let harness = NativeTestHarness()
      let anchor = scroller(
        frame: NativeFrame(x: 0, y: 0, width: 300, height: 200),
        contentSize: NativeSize(width: 300, height: 600)
      )
      harness.manager.apply(batch(1, mountOp(anchor: anchor)))
      harness.manager.apply(batch(2, .unmount(id: "cta")))
      harness.manager.apply(batch(3, mountOp("other", anchor: anchor)))
      harness.manager.clear(notifyPage: false)
      harness.surface.addScroller(
        frame: CGRect(x: 0, y: 0, width: 300, height: 200),
        contentSize: CGSize(width: 300, height: 600)
      )
      harness.runRetries()
      #expect(harness.manager.islands.isEmpty)
      #expect(harness.sent.isEmpty)
    }

    @Test
    func ignoresARetryForAnEarlierMountOfTheSameId() {
      let harness = NativeTestHarness()
      let anchor = scroller(
        frame: NativeFrame(x: 0, y: 0, width: 300, height: 200),
        contentSize: NativeSize(width: 300, height: 600)
      )
      harness.manager.apply(batch(1, mountOp(anchor: anchor)))
      harness.manager.apply(batch(2, mountOp(anchor: anchor)))
      harness.surface.addScroller(
        frame: CGRect(x: 0, y: 0, width: 300, height: 200),
        contentSize: CGSize(width: 300, height: 600)
      )
      harness.runRetries()
      #expect(harness.sent.flatMap { $0 } == [.ack(sequence: 2, ids: ["cta"])])
    }

    @Test
    func keepsTheScrollerWhileItScrollsAndMovesOnlyWhenItChanges() {
      let harness = NativeTestHarness()
      let first = harness.surface.addScroller(
        frame: CGRect(x: 0, y: 0, width: 300, height: 200),
        contentSize: CGSize(width: 300, height: 600)
      )
      let second = harness.surface.addScroller(
        frame: CGRect(x: 0, y: 300, width: 300, height: 200),
        contentSize: CGSize(width: 300, height: 700)
      )
      let anchor = scroller(
        "first",
        frame: NativeFrame(x: 0, y: 0, width: 300, height: 200),
        contentSize: NativeSize(width: 300, height: 600)
      )
      harness.manager.apply(batch(1, mountOp(anchor: anchor)))
      first.contentOffset = CGPoint(x: 0, y: 250)
      harness.manager.apply(batch(2, .update(NativeUpdate(id: "cta", anchor: anchor))))
      #expect(harness.island("cta")?.view.superview === first)
      harness.manager.apply(
        batch(
          3,
          .update(
            NativeUpdate(
              id: "cta",
              anchor: scroller(
                "second",
                frame: NativeFrame(x: 0, y: 300, width: 300, height: 200),
                contentSize: NativeSize(width: 300, height: 700)
              )
            )
          )
        )
      )
      #expect(harness.island("cta")?.view.superview === second)
    }

    @Test
    func dropsAnIslandWhoseNewScrollerCannotBeFound() {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp()))
      harness.manager.apply(
        batch(
          2,
          .update(
            NativeUpdate(
              id: "cta",
              anchor: scroller(
                frame: NativeFrame(x: 0, y: 0, width: 1, height: 1),
                contentSize: NativeSize(width: 1, height: 1)
              )
            )
          )
        )
      )
      #expect(harness.island("cta") == nil)
      #expect(harness.sent.last?.first.map { reply in
        if case .error("cta", .anchorNotFound, _, 1) = reply { return true }
        return false
      } == true)
    }
  }
}
