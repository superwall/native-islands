import Testing
import UIKit
@testable import NativeIslands

extension NativeBridgeTests {
  /// Islands on a screen parked off to the side, whose scroll view WebKit
  /// resizes a moment after the page reports the new size. Meanwhile another
  /// screen's scroll view can match the new size within the matcher's
  /// tolerance, such as the shown screen, a whole row of screens away.
  @Suite
  @MainActor
  struct ParkedScrollerTests {
    static let size = CGSize(width: 400, height: 800)

    @Test
    func aParkedIslandStaysInItsScrollViewWhileWebKitCatchesUpWithItsContent() {
      let harness = NativeTestHarness()
      let shown = harness.surface.addScroller(
        frame: CGRect(origin: .zero, size: Self.size),
        contentSize: CGSize(width: 400, height: 1017)
      )
      let parked = harness.surface.addScroller(
        frame: CGRect(origin: CGPoint(x: 6800, y: 0), size: Self.size),
        contentSize: CGSize(width: 400, height: 920)
      )
      let spot = NativeFrame(x: 6800, y: 0, width: 400, height: 800)
      harness.manager.apply(batch(
        1,
        mountOp(anchor: scroller("parked", frame: spot, contentSize: NativeSize(width: 400, height: 920)))
      ))
      #expect(harness.island("cta")?.view.superview === parked)

      // The page grew by 96 pt; WebKit has not resized the scroll view yet.
      let grown = scroller("parked", frame: spot, contentSize: NativeSize(width: 400, height: 1016))
      harness.manager.apply(batch(2, .update(NativeUpdate(id: "cta", anchor: grown))))
      #expect(harness.island("cta")?.view.superview === parked)
      #expect(harness.island("cta")?.view.superview !== shown)

      parked.contentSize = CGSize(width: 400, height: 1016)
      harness.runRetries()
      #expect(harness.island("cta")?.view.superview === parked)
    }
  }
}
