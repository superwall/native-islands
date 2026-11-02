import SwiftUI
import Testing
import UIKit
import WebKit
@testable import NativeIslands

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct IslandTouchTests {
    @Test
    func touchesReachVisibleIslandsScreenFirstAndSkipHiddenOnes() {
      let harness = NativeTestHarness()
      harness.manager.apply(
        batch(
          1,
          mountOp("page", frame: NativeFrame(x: 0, y: 0, width: 100, height: 100)),
          mountOp("bar", frame: NativeFrame(x: 0, y: 0, width: 50, height: 50), anchor: .screen),
          mountOp("hidden", frame: NativeFrame(x: 200, y: 0, width: 50, height: 50), visible: false)
        )
      )
      let window = UIWindow(frame: harness.surface.viewport.frame)
      window.addSubview(harness.surface.viewport)
      let viewport = harness.surface.viewport
      let barHit = harness.manager.hitTest(CGPoint(x: 10, y: 10), in: viewport, with: nil)
      #expect(barHit?.isDescendant(of: harness.island("bar")!.view) == true)
      let pageHit = harness.manager.hitTest(CGPoint(x: 80, y: 80), in: viewport, with: nil)
      #expect(pageHit?.isDescendant(of: harness.island("page")!.view) == true)
      #expect(harness.manager.hitTest(CGPoint(x: 210, y: 10), in: viewport, with: nil) == nil)
      #expect(harness.manager.hitTest(CGPoint(x: 300, y: 600), in: viewport, with: nil) == nil)
      #expect(NativeAnchor.screen.isScreen)
      #expect(!NativeAnchor.page.isScreen)
    }

    @Test
    func aScrollerIslandOnlyTakesTouchesWebKitWouldGiveItsScroller() {
      let harness = NativeTestHarness()
      let list = harness.surface.addScroller(
        frame: CGRect(x: 0, y: 100, width: 300, height: 200),
        contentSize: CGSize(width: 300, height: 600)
      )
      harness.manager.apply(
        batch(
          1,
          mountOp(
            "card",
            frame: NativeFrame(x: 0, y: 0, width: 300, height: 100),
            anchor: scroller(
              frame: NativeFrame(x: 0, y: 100, width: 300, height: 200),
              contentSize: NativeSize(width: 300, height: 600)
            )
          )
        )
      )
      let window = UIWindow(frame: harness.surface.viewport.frame)
      window.addSubview(harness.surface.viewport)
      let viewport = harness.surface.viewport
      let card = harness.island("card")!.view
      #expect(card.superview === list)
      let footer = UIView()
      let covered = harness.manager.hitTest(CGPoint(x: 50, y: 150), in: viewport, with: nil) { footer }
      #expect(covered == nil)
      let open = harness.manager.hitTest(CGPoint(x: 50, y: 150), in: viewport, with: nil) { list }
      #expect(open?.isDescendant(of: card) == true)
    }
  }

  @Suite
  @MainActor
  struct TouchTests {
    @Test
    func holdsWebKitsGesturesForATouchOnAnIslandButKeepsScrolling() async {
      let root = UIView(frame: CGRect(x: 0, y: 0, width: 400, height: 800))
      let content = UIView(frame: root.bounds)
      let tap = UITapGestureRecognizer()
      content.addGestureRecognizer(tap)
      let scroller = UIScrollView(frame: CGRect(x: 0, y: 0, width: 400, height: 300))
      let longPress = UILongPressGestureRecognizer()
      scroller.addGestureRecognizer(longPress)
      let island = UIView(frame: CGRect(x: 0, y: 0, width: 100, height: 44))
      root.addSubview(content)
      content.addSubview(scroller)
      scroller.addSubview(island)
      let outside = UITapGestureRecognizer()
      let sibling = UIView()
      sibling.addGestureRecognizer(outside)
      root.addSubview(sibling)

      NativeIslandManager.holdWebGestures(above: island, upTo: root)

      #expect(!tap.isEnabled)
      #expect(!longPress.isEnabled)
      #expect(scroller.panGestureRecognizer.isEnabled)
      #expect(outside.isEnabled)
      await Task.yield()
      for _ in 0..<20 where !tap.isEnabled {
        try? await Task.sleep(nanoseconds: 5_000_000)
      }
      #expect(tap.isEnabled)
      #expect(longPress.isEnabled)
    }
  }
}
