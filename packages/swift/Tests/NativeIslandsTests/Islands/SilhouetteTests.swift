import SwiftUI
import Testing
import UIKit
@testable import NativeIslands

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct SilhouetteTests {
    @Test
    func drawsTheShadeShapeOnceForEachSizeAndProps() {
      let harness = NativeTestHarness()
      harness.manager.apply(
        batch(1, mountOp("dot", component: "toggle", props: ["isOn": .bool(true)]))
      )
      guard let island = harness.island("dot") else {
        Issue.record("The island did not mount.")
        return
      }
      var draws = 0
      let draw = { () -> CALayer? in
        draws += 1
        return CALayer()
      }
      let first = island.cachedSilhouette(drawing: draw)
      #expect(island.cachedSilhouette(drawing: draw) === first)
      #expect(island.cachedSilhouette(drawing: draw) === first)
      #expect(draws == 1)

      harness.manager.apply(
        batch(2, .update(NativeUpdate(id: "dot", props: ["isOn": .bool(false)])))
      )
      #expect(island.cachedSilhouette(drawing: draw) !== first)
      #expect(draws == 2)

      island.view.bounds.size = CGSize(width: 80, height: 40)
      _ = island.cachedSilhouette(drawing: draw)
      #expect(draws == 3)

      island.removeShades()
      #expect(island.silhouetteCache == nil)
    }
  }
}
