import SwiftUI
import Testing
import UIKit
import WebKit
@testable import NativeIslands

@MainActor
private func glassHarness() -> NativeTestHarness {
  let harness = NativeTestHarness()
  harness.registry.register(
    "glassButton",
    glass: { NativeGlass(shape: .capsule, tint: $0.uiColor("tint")) },
    content: { _ in Color.clear }
  )
  return harness
}

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct GlassTests {
    @Test
    func glassComponentsAreDrawnOnUIKitGlass() {
      let harness = glassHarness()
      harness.manager.apply(batch(1, mountOp("cta", props: ["title": .string("Go")])))
      let island = harness.island("cta")
      #expect(island?.view is NativeGlassView)
      #expect(island?.view.superview === harness.surface.pageScrollView)
      #expect(island?.host.view.superview === (island?.view as? NativeGlassView)?.contentView)
    }

    @Test
    func islandsSharingAGlassGroupMergeInOneContainerEffect() {
      let harness = glassHarness()
      let grouped: [String: NativeValue] = ["title": .string("A"), "glassGroup": .string("chrome")]
      harness.manager.apply(
        batch(
          1,
          mountOp("a", props: grouped, frame: NativeFrame(x: 0, y: 0, width: 80, height: 44)),
          mountOp("b", props: grouped, frame: NativeFrame(x: 90, y: 0, width: 80, height: 44)),
          mountOp("c", props: ["title": .string("C")])
        )
      )
      let groups = harness.surface.pageScrollView.subviews.compactMap { $0 as? NativeGlassGroupView }
      #expect(groups.count == 1)
      #expect(groups.first?.name == "chrome")
      #expect(groups.first?.frame.size == CGSize(width: 400, height: 2000))
      #expect(harness.island("a")?.view.superview === groups.first?.contentView)
      #expect(harness.island("b")?.view.superview === groups.first?.contentView)
      #expect(harness.island("c")?.view.superview === harness.surface.pageScrollView)
      #expect(harness.island("b")?.view.frame == CGRect(x: 90, y: 0, width: 80, height: 44))
    }

    @Test
    func leavingAGroupMovesTheIslandOutAndEmptyGroupsGoAway() {
      let harness = glassHarness()
      harness.manager.apply(
        batch(1, mountOp("a", props: ["title": .string("A"), "glassGroup": .string("g")]))
      )
      harness.manager.apply(
        batch(2, .update(NativeUpdate(id: "a", props: ["title": .string("A")])))
      )
      #expect(harness.island("a")?.view.superview === harness.surface.pageScrollView)
      #expect(harness.surface.pageScrollView.subviews.compactMap { $0 as? NativeGlassGroupView }.isEmpty)

      harness.manager.apply(
        batch(3, .update(NativeUpdate(id: "a", props: ["glassGroup": .string("g")])))
      )
      #expect(harness.island("a")?.view.superview is UIView)
      harness.manager.apply(batch(4, .unmount(id: "a")))
      #expect(harness.surface.pageScrollView.subviews.compactMap { $0 as? NativeGlassGroupView }.isEmpty)
    }

    @Test
    func aGroupLetsTouchesThroughWhereThereIsNoIsland() {
      let group = NativeGlassGroupView(name: "g")
      group.frame = CGRect(x: 0, y: 0, width: 200, height: 200)
      let child = UIView(frame: CGRect(x: 10, y: 10, width: 50, height: 50))
      group.contentView.addSubview(child)
      #expect(group.hitTest(CGPoint(x: 150, y: 150), with: nil) == nil)
      #expect(group.hitTest(CGPoint(x: 20, y: 20), with: nil) === child)
    }

    @Test
    func glassFollowsTintChanges() {
      let harness = glassHarness()
      harness.manager.apply(
        batch(1, mountOp("cta", props: ["title": .string("Go")]))
      )
      harness.manager.apply(
        batch(
          2,
          .update(
            NativeUpdate(
              id: "cta",
              props: [
                "title": .string("Go"),
                "tint": .string("rgb(0, 0, 255)")
              ]
            )
          )
        )
      )
      let glass = harness.island("cta")?.view as? NativeGlassView
      #expect(glass?.glass.tint == UIColor(red: 0, green: 0, blue: 1, alpha: 1))
    }

    @Test
    func cornersFollowTheShape() {
      let size = CGSize(width: 120, height: 44)
      #expect(NativeGlassView.cornerRadius(for: .capsule, in: size) == 22)
      #expect(NativeGlassView.cornerRadius(for: .circle, in: CGSize(width: 44, height: 44)) == 22)
      #expect(NativeGlassView.cornerRadius(for: .rounded(12), in: size) == 12)
      #expect(NativeGlassView.cornerRadius(for: .rounded(100), in: size) == 22)
    }

    @Test
    func colourPropsBecomeUIColors() {
      let props = NativeComponentProps(["tint": .string("rgba(0, 255, 0, 0.5)"), "bad": .string("teal")])
      #expect(props.uiColor("tint") == UIColor(red: 0, green: 1, blue: 0, alpha: 0.5))
      #expect(props.uiColor("bad") == nil)
      #expect(props.uiColor("missing") == nil)
    }

    @Test
    func webRolesBecomeAccessibilityTraits() {
      let traits = NativeAccessibilityModifier.traits(for: ["button", "link", "image", "header", "switch"])
      #expect(traits.contains(.isButton))
      #expect(traits.contains(.isLink))
      #expect(traits.contains(.isImage))
      #expect(traits.contains(.isHeader))
      #expect(NativeAccessibilityModifier.traits(for: []).isEmpty)
    }
  }
}
