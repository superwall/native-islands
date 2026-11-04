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

/// A scroller that notes each view taken out of it.
private final class RecordingScroller: UIScrollView {
  var removed: [UIView] = []

  override func willRemoveSubview(_ subview: UIView) {
    super.willRemoveSubview(subview)
    removed.append(subview)
  }
}

/// Two glass islands and a plain one in a recording scroller, shown in a window.
@MainActor
private func seatedHarness() -> (NativeTestHarness, RecordingScroller, UIWindow) {
  let harness = glassHarness()
  let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 400, height: 800))
  window.addSubview(harness.surface.viewport)
  window.isHidden = false
  let list = RecordingScroller(frame: CGRect(x: 0, y: 0, width: 400, height: 800))
  list.contentSize = CGSize(width: 400, height: 1600)
  harness.surface.pageScrollView.addSubview(list)
  let anchor = scroller(
    "screen",
    frame: NativeFrame(x: 0, y: 0, width: 400, height: 800),
    contentSize: NativeSize(width: 400, height: 1600)
  )
  harness.manager.apply(
    batch(
      1,
      mountOp("a", props: ["title": .string("A")], anchor: anchor, order: 1),
      mountOp("b", props: ["title": .string("B")], anchor: anchor, order: 2),
      mountOp("plain", component: "toggle", props: [:], anchor: anchor, order: 3)
    )
  )
  list.removed = []
  return (harness, list, window)
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
      #expect(harness.surface.pageScrollView.subviews.compactMap { $0 as? NativeGlassGroupView }.count == 1)
      harness.expirations.forEach { $0() }
      #expect(harness.surface.pageScrollView.subviews.compactMap { $0 as? NativeGlassGroupView }.isEmpty)
    }

    @Test
    func aGroupedIslandFollowsItsScrollerAndLeavesNoEmptyGroupBehind() {
      let harness = glassHarness()
      let parked = harness.surface.addScroller(
        frame: CGRect(x: 800, y: 0, width: 400, height: 800),
        contentSize: CGSize(width: 400, height: 1600)
      )
      let size = NativeSize(width: 400, height: 1600)
      harness.manager.apply(
        batch(
          1,
          mountOp(
            props: ["title": .string("A"), "glassGroup": .string("g")],
            anchor: scroller("screen", frame: NativeFrame(x: 800, y: 0, width: 400, height: 800), contentSize: size)
          )
        )
      )
      #expect(parked.subviews.compactMap { $0 as? NativeGlassGroupView }.count == 1)

      let shown = harness.surface.addScroller(
        frame: CGRect(x: 0, y: 0, width: 400, height: 800),
        contentSize: CGSize(width: 400, height: 1600)
      )
      let landed = scroller("screen", frame: NativeFrame(x: 0, y: 0, width: 400, height: 800), contentSize: size)
      harness.manager.apply(batch(2, .update(NativeUpdate(id: "cta", anchor: landed))))
      let group = shown.subviews.compactMap { $0 as? NativeGlassGroupView }.first
      #expect(harness.island("cta")?.view.superview === group?.contentView)
      #expect(parked.subviews.compactMap { $0 as? NativeGlassGroupView }.isEmpty)
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
    func glassIsPutBackInPlaceAsTheAppComesBackFromTheBackground() throws {
      let (harness, scroller, window) = seatedHarness()
      let glassA = try #require(harness.island("a")?.glassView)
      let glassB = try #require(harness.island("b")?.glassView)
      let order = scroller.subviews
      harness.notifications.post(name: UIApplication.didEnterBackgroundNotification, object: nil)
      harness.notifications.post(name: UIApplication.willEnterForegroundNotification, object: nil)
      #expect(scroller.removed.isEmpty)
      harness.runScheduled()
      #expect(scroller.removed.count == 2)
      #expect(scroller.removed.contains { $0 === glassA })
      #expect(scroller.removed.contains { $0 === glassB })
      #expect(scroller.subviews == order)
      #expect(glassA.window === window)
      #expect(harness.island("plain")?.view.superview === scroller)

      // Becoming active does not take the same glass out again.
      harness.notifications.post(name: UIApplication.didBecomeActiveNotification, object: nil)
      #expect(scroller.removed.count == 2)
    }

    @Test
    func glassIsPutBackOnceActiveWhenTheForegroundPassDidNotRun() {
      let (harness, scroller, _) = seatedHarness()
      harness.notifications.post(name: UIApplication.didEnterBackgroundNotification, object: nil)
      harness.notifications.post(name: UIApplication.willEnterForegroundNotification, object: nil)
      harness.notifications.post(name: UIApplication.didBecomeActiveNotification, object: nil)
      #expect(scroller.removed.count == 2)
      harness.runScheduled()
      #expect(scroller.removed.count == 2)
    }

    @Test
    func becomingActiveWithoutTheBackgroundLeavesGlassAlone() {
      let (harness, scroller, _) = seatedHarness()
      harness.notifications.post(name: UIApplication.willEnterForegroundNotification, object: nil)
      harness.notifications.post(name: UIApplication.didBecomeActiveNotification, object: nil)
      harness.runScheduled()
      #expect(scroller.removed.isEmpty)
      harness.notifications.post(name: UIApplication.didEnterBackgroundNotification, object: nil)
      harness.notifications.post(name: UIApplication.didBecomeActiveNotification, object: nil)
      harness.notifications.post(name: UIApplication.didBecomeActiveNotification, object: nil)
      #expect(scroller.removed.count == 2)
    }

    @Test
    func glassSlidingOnTheWayBackIsPutBackOnceActive() throws {
      let (harness, scroller, window) = seatedHarness()
      let motion = NativeMotion(
        keyframes: [.init(offset: 0, x: 402, y: 0), .init(offset: 1, x: 0, y: 0)],
        duration: 500
      )
      harness.manager.apply(
        batch(2, .update(NativeUpdate(id: "a", frame: NativeFrame(x: 0, y: 0, width: 100, height: 44), motion: motion)))
      )
      scroller.removed = []
      harness.notifications.post(name: UIApplication.didEnterBackgroundNotification, object: nil)
      harness.notifications.post(name: UIApplication.willEnterForegroundNotification, object: nil)
      harness.runScheduled()
      let glassA = try #require(harness.island("a")?.glassView)
      let glassB = try #require(harness.island("b")?.glassView)
      #expect(scroller.removed.count == 1)
      #expect(scroller.removed.first === glassB)

      harness.island("a")?.stopMotion()
      harness.notifications.post(name: UIApplication.didBecomeActiveNotification, object: nil)
      #expect(scroller.removed.count == 2)
      #expect(scroller.removed.last === glassA)

      window.isHidden = true
      harness.surface.viewport.removeFromSuperview()
      scroller.removed = []
      harness.notifications.post(name: UIApplication.didEnterBackgroundNotification, object: nil)
      harness.notifications.post(name: UIApplication.willEnterForegroundNotification, object: nil)
      harness.runScheduled()
      harness.notifications.post(name: UIApplication.didBecomeActiveNotification, object: nil)
      #expect(scroller.removed.isEmpty)
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

    @Test(arguments: [
      (NativeGlass.Shape.capsule, CGSize(width: 120, height: 44), CGFloat(22)),
      (NativeGlass.Shape.circle, CGSize(width: 44, height: 44), CGFloat(22)),
      (NativeGlass.Shape.rounded(12), CGSize(width: 200, height: 80), CGFloat(12)),
      (NativeGlass.Shape.rounded(100), CGSize(width: 200, height: 80), CGFloat(40))
    ])
    @available(iOS 26.0, *)
    func glassCornersFollowItsShape(shape: NativeGlass.Shape, size: CGSize, radius: CGFloat) {
      let view = NativeGlassView(glass: NativeGlass(shape: shape), content: UIView())
      view.frame = CGRect(origin: .zero, size: size)
      view.layoutIfNeeded()
      #expect(view.effectiveRadius(corner: .topLeft) == radius)
      #expect(view.effectiveRadius(corner: .bottomRight) == radius)
    }

    @Test
    @available(iOS 26.0, *)
    func changingTheShapeChangesTheCorners() {
      let view = NativeGlassView(glass: NativeGlass(shape: .capsule), content: UIView())
      view.frame = CGRect(x: 0, y: 0, width: 120, height: 44)
      view.layoutIfNeeded()
      view.apply(NativeGlass(shape: .rounded(8)))
      view.layoutIfNeeded()
      #expect(view.effectiveRadius(corner: .topLeft) == 8)
      view.frame.size.height = 60
      view.apply(NativeGlass(shape: .capsule))
      view.layoutIfNeeded()
      #expect(view.effectiveRadius(corner: .topLeft) == 30)
    }

    @Test
    func glassIsLiquidGlassFromIOS26AndAMaterialBefore() {
      let view = NativeGlassView(glass: NativeGlass(style: .clear), content: UIView())
      if #available(iOS 26.0, *) {
        #expect(view.effect is UIGlassEffect)
      } else {
        #expect(view.effect is UIBlurEffect)
      }
      #expect(NativeGlassView.material(for: .regular) == .systemMaterial)
      #expect(NativeGlassView.material(for: .clear) == .systemUltraThinMaterial)
    }

    @Test
    func beforeIOS26GlassIsClippedToItsShapeAndFilledWithItsTint() {
      if #available(iOS 26.0, *) { return }
      let view = NativeGlassView(glass: NativeGlass(shape: .capsule, tint: .red), content: UIView())
      view.frame = CGRect(x: 0, y: 0, width: 120, height: 44)
      view.layoutIfNeeded()
      #expect(view.clipsToBounds)
      #expect(view.layer.cornerRadius == 22)
      #expect(view.contentView.layer.cornerRadius == 22)
      #expect(view.layer.cornerCurve == .continuous)
      #expect(view.contentView.backgroundColor == .red)
      #expect(view.layer.borderWidth == 0)

      view.apply(NativeGlass(shape: .rounded(8)))
      view.layoutIfNeeded()
      #expect(view.layer.cornerRadius == 8)
      #expect(view.contentView.backgroundColor == nil)
      #expect(view.layer.borderWidth > 0)
      #expect(view.layer.borderColor == UIColor.separator.resolvedColor(with: view.traitCollection).cgColor)

      view.isSliding = true
      #expect(view.effect is UIBlurEffect)
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
