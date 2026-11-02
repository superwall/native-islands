import SwiftUI
import Testing
import UIKit
import WebKit
@testable import NativeIslands

@MainActor
private func builtInHarness() -> NativeTestHarness {
  let harness = NativeTestHarness()
  NativeBuiltIns.register(in: harness.registry)
  return harness
}

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct BuiltInTests {
    @Test
    func theSharedRegistryOffersEveryBuiltInAtVersionOne() {
      let shared = NativeComponentRegistry.shared.registeredComponents
      for name in NativeBuiltIns.names {
        #expect(shared[name] == 1)
      }
      #expect(NativeComponentRegistry().registeredComponents == shared)
      #expect(NativeComponentRegistry(includingBuiltIns: false).registeredComponents.isEmpty)
    }

    @Test
    func aBuiltInCanBeReplacedOrRemoved() {
      let registry = NativeComponentRegistry()
      registry.register("toggle", version: 2) { _ in Color.clear }
      registry.unregister("symbol")
      #expect(registry.registeredComponents["toggle"] == 2)
      #expect(registry.registeredComponents["symbol"] == nil)
    }

    @Test
    func glassButtonsChooseTheirGlassFromTheirProps() {
      let regular = NativeBuiltIns.glassButtonGlass(NativeComponentProps(["title": .string("Go")]))
      #expect(regular.shape == .capsule)
      #expect(regular.tint == nil)
      #expect(regular.isInteractive)

      let prominent = NativeBuiltIns.glassButtonGlass(
        NativeComponentProps([
          "title": .string("Go"),
          "prominence": .string("prominent"),
          "tint": .string("rgb(255, 0, 0)")
        ])
      )
      #expect(prominent.tint == UIColor(red: 1, green: 0, blue: 0, alpha: 1))

      let icon = NativeBuiltIns.glassButtonGlass(
        NativeComponentProps(["systemImage": .string("heart"), "disabled": .bool(true)])
      )
      #expect(icon.shape == .circle)
      #expect(!icon.isInteractive)

      let close = NativeBuiltIns.closeButtonGlass(NativeComponentProps())
      #expect(close.shape == .circle)
    }

    @Test
    func glassComponentsAreDrawnOnUIKitGlass() {
      let harness = builtInHarness()
      harness.manager.apply(batch(1, mountOp("cta", props: ["title": .string("Go")])))
      let island = harness.island("cta")
      #expect(island?.view is NativeGlassView)
      #expect(island?.view.superview === harness.surface.pageScrollView)
      #expect(island?.host.view.superview === (island?.view as? NativeGlassView)?.contentView)
    }

    @Test
    func islandsSharingAGlassGroupMergeInOneContainerEffect() {
      let harness = builtInHarness()
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
      let harness = builtInHarness()
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
      let harness = builtInHarness()
      harness.manager.apply(
        batch(1, mountOp("cta", props: ["title": .string("Go"), "prominence": .string("prominent")]))
      )
      harness.manager.apply(
        batch(
          2,
          .update(
            NativeUpdate(
              id: "cta",
              props: [
                "title": .string("Go"),
                "prominence": .string("prominent"),
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
    func everyBuiltInRendersFromItsProps() {
      let harness = builtInHarness()
      harness.manager.apply(
        batch(
          1,
          mountOp("button", props: ["title": .string("Go"), "systemImage": .string("heart")]),
          mountOp("close", component: "closeButton", props: [:]),
          mountOp("switch", component: "toggle", props: ["isOn": .bool(true)], sizing: .native),
          mountOp(
            "segments",
            component: "segmentedControl",
            props: ["segments": .array([.string("A"), .string("B")]), "selectedIndex": .number(1)]
          ),
          mountOp(
            "crown",
            component: "symbol",
            props: ["name": .string("crown.fill"), "weight": .string("bold"), "pointSize": .number(20)]
          ),
          mountOp("star", component: "symbol", props: ["name": .string("star")])
        )
      )
      #expect(harness.sent.first?.first == .ack(sequence: 1, ids: ["button", "close", "switch", "segments", "crown", "star"]))
      for id in ["button", "close", "switch", "segments", "crown", "star"] {
        let view = harness.island(id)?.host.view
        view?.layoutIfNeeded()
        #expect(view != nil)
      }
      let sizes = harness.replies.compactMap { reply -> String? in
        if case let .size(id, _, _) = reply { return id }
        return nil
      }
      #expect(sizes == ["switch"])
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

  @Suite
  @MainActor
  struct FrameReporterTests {
    @Test
    func reportsEveryIslandInViewportCoordinates() {
      let harness = builtInHarness()
      harness.surface.pageScrollView.contentOffset = CGPoint(x: 0, y: 100)
      let list = harness.surface.addScroller(
        frame: CGRect(x: 20, y: 300, width: 360, height: 200),
        contentSize: CGSize(width: 360, height: 600)
      )
      list.contentOffset = CGPoint(x: 0, y: 50)
      harness.manager.apply(
        batch(
          1,
          mountOp("page", frame: NativeFrame(x: 10, y: 120, width: 100, height: 44)),
          mountOp(
            "row",
            frame: NativeFrame(x: 5, y: 60, width: 80, height: 30),
            anchor: scroller(
              frame: NativeFrame(x: 20, y: 200, width: 360, height: 200),
              contentSize: NativeSize(width: 360, height: 600),
              offset: NativePoint(x: 0, y: 50)
            )
          ),
          mountOp("bar", frame: NativeFrame(x: 300, y: 40, width: 44, height: 44), anchor: .screen),
          mountOp("hidden", frame: NativeFrame(x: 0, y: 0, width: 10, height: 10), visible: false)
        )
      )
      let window = UIWindow(frame: harness.surface.viewport.frame)
      window.addSubview(harness.surface.viewport)
      let frames = Dictionary(uniqueKeysWithValues: harness.manager.frames().map { ($0.id, $0) })
      #expect(frames["page"]?.frame == CGRect(x: 10, y: 20, width: 100, height: 44))
      #expect(frames["row"]?.frame == CGRect(x: 25, y: 210, width: 80, height: 30))
      #expect(frames["bar"]?.frame == CGRect(x: 300, y: 40, width: 44, height: 44))
      #expect(frames["page"]?.visible == true)
      #expect(frames["hidden"]?.visible == false)
      #expect(frames["page"]?.acknowledged == true)
      #expect(harness.manager.frames().map(\.id) == ["bar", "hidden", "page", "row"])

      let reporter = NativeFrameReporter(islands: harness.manager)
      let json = reporter.report().first { $0["id"] as? String == "page" }
      #expect(json?["component"] as? String == "glassButton")
      #expect(json?["y"] as? Double == 20)
      #expect(json?["width"] as? Double == 100)
      #expect(json?["visible"] as? Bool == true)
    }

    @Test
    func reportsNothingOnceTheManagerIsGone() {
      var harness: NativeTestHarness? = builtInHarness()
      let reporter = NativeFrameReporter(islands: harness!.manager)
      harness = nil
      #expect(reporter.report().isEmpty)
    }
  }
}

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
}

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct AlignmentProbeTests {
    @Test
    func readsTheLaunchArgument() {
      #expect(NativeAlignmentProbe.isRequested(["app", "-NativeIslandsAlignmentLog", "YES"]))
      #expect(NativeAlignmentProbe.isRequested(["app", "-NativeIslandsAlignmentLog"]))
      #expect(!NativeAlignmentProbe.isRequested(["app", "-NativeIslandsAlignmentLog", "NO"]))
      #expect(!NativeAlignmentProbe.isRequested(["app"]))
    }

    @Test
    func flagsOnlyShownIslandsOffByMoreThanHalfAPoint() throws {
      let frames = [
        NativeIslandFrame(id: "a", component: "glassButton", frame: CGRect(x: 10, y: 20, width: 100, height: 44), visible: true, acknowledged: true),
        NativeIslandFrame(id: "b", component: "glassButton", frame: CGRect(x: 10, y: 20, width: 100, height: 44), visible: true, acknowledged: true),
        NativeIslandFrame(id: "c", component: "glassButton", frame: CGRect(x: 0, y: 0, width: 10, height: 10), visible: false, acknowledged: true),
        NativeIslandFrame(id: "d", component: "symbol", frame: .zero, visible: true, acknowledged: true)
      ]
      let dom: [String: [String: Any]] = [
        "a": ["x": 10.3, "y": 20.0, "width": 100.0, "height": 44.0, "scenario": "S01", "expect": "native", "shown": true],
        "b": ["x": 12.0, "y": 20.0, "width": 100.0, "height": 44.0],
        "c": ["x": 50.0, "y": 50.0, "width": 10.0, "height": 10.0]
      ]
      let lines = NativeAlignmentProbe.compare(frames: frames, dom: dom)
      let parsed = try lines.map { line in
        try #require(try JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any])
      }
      let byId = Dictionary(uniqueKeysWithValues: parsed.map { ($0["id"] as? String ?? "", $0) })
      #expect(byId["a"]?["misaligned"] as? Bool == false)
      #expect(byId["a"]?["scenario"] as? String == "S01")
      #expect(byId["b"]?["misaligned"] as? Bool == true)
      #expect(byId["b"]?["dx"] as? Double == -2)
      #expect(byId["c"]?["misaligned"] as? Bool == false)
      #expect(byId["d"]?["missing"] as? Bool == true)
    }
  }
}

@MainActor
private final class NotchedSurface: NativeHostSurface {
  final class Viewport: UIView {
    override var safeAreaInsets: UIEdgeInsets {
      UIEdgeInsets(top: 60, left: 0, bottom: 34, right: 0)
    }
  }

  let viewport: UIView = Viewport(frame: CGRect(x: 0, y: 0, width: 400, height: 800))
  let pageScrollView = UIScrollView(frame: CGRect(x: 0, y: 0, width: 400, height: 800))
  let screenLayer: UIView = NativePassthroughView(frame: CGRect(x: 0, y: 0, width: 400, height: 800))

  init() {
    pageScrollView.contentSize = CGSize(width: 400, height: 2000)
    pageScrollView.contentInsetAdjustmentBehavior = .never
    viewport.addSubview(pageScrollView)
    viewport.addSubview(screenLayer)
  }
}

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct StatusBarTests {
    @Test
    func hidesPageIslandsWhileTheyAreUnderTheStatusBarAndShowsThemAfter() {
      let registry = NativeComponentRegistry(includingBuiltIns: false)
      registry.register("glassButton") { _ in Color.clear }
      let surface = NotchedSurface()
      let manager = NativeIslandManager(registry: registry, surface: surface, send: { _ in }, schedule: { _ in })
      manager.apply(
        batch(
          1,
          mountOp("low", frame: NativeFrame(x: 10, y: 200, width: 100, height: 44)),
          mountOp("bar", frame: NativeFrame(x: 10, y: 10, width: 44, height: 44), anchor: .screen)
        )
      )
      let low = manager.islands["low"]
      #expect(low?.isShown == true)
      #expect(low?.view.isUserInteractionEnabled == true)

      surface.pageScrollView.contentOffset = CGPoint(x: 0, y: 180)
      #expect(low?.isObscured == true)
      #expect(low?.isShown == false)
      #expect(low?.view.isUserInteractionEnabled == false)
      #expect(manager.islands["bar"]?.isObscured == false)
      #expect(manager.frames().first { $0.id == "low" }?.visible == false)

      surface.pageScrollView.contentOffset = .zero
      #expect(low?.isShown == true)
    }

    @Test
    func keepsAnIslandThatRestsInTheTopInsetShown() {
      let registry = NativeComponentRegistry(includingBuiltIns: false)
      registry.register("closeButton") { _ in Color.clear }
      let surface = NotchedSurface()
      let manager = NativeIslandManager(registry: registry, surface: surface, send: { _ in }, schedule: { _ in })
      manager.apply(
        batch(
          1,
          mountOp("close", component: "closeButton", frame: NativeFrame(x: 340, y: 12, width: 44, height: 44))
        )
      )
      surface.pageScrollView.contentOffset = CGPoint(x: 0, y: 1)
      manager.updateObscured()
      #expect(manager.islands["close"]?.isObscured == false)
      surface.pageScrollView.contentOffset = CGPoint(x: 0, y: 40)
      manager.updateObscured()
      #expect(manager.islands["close"]?.isObscured == false)
      #expect(manager.islands["close"]?.isShown == true)
    }

    @Test
    func followsInnerScrollers() {
      let registry = NativeComponentRegistry(includingBuiltIns: false)
      registry.register("glassButton") { _ in Color.clear }
      let surface = NotchedSurface()
      let list = UIScrollView(frame: CGRect(x: 0, y: 100, width: 400, height: 300))
      list.contentSize = CGSize(width: 400, height: 900)
      list.contentInsetAdjustmentBehavior = .never
      surface.pageScrollView.addSubview(list)
      let manager = NativeIslandManager(registry: registry, surface: surface, send: { _ in }, schedule: { _ in })
      manager.apply(
        batch(
          1,
          mountOp(
            "row",
            frame: NativeFrame(x: 0, y: 20, width: 100, height: 40),
            anchor: scroller(
              frame: NativeFrame(x: 0, y: 100, width: 400, height: 300),
              contentSize: NativeSize(width: 400, height: 900)
            )
          )
        )
      )
      #expect(manager.islands["row"]?.isShown == true)
      list.contentOffset = CGPoint(x: 0, y: 70)
      #expect(manager.islands["row"]?.view.superview === list)
      #expect(manager.islands["row"]?.isObscured == true)
    }
  }
}

extension NativeBridgeTests {
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

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct AlignmentTests {
    @Test
    func pairsFramesWithTheirElementsAndMeasuresTheGap() {
      let frames = [
        NativeIslandFrame(id: "a", component: "glassButton", frame: CGRect(x: 10, y: 20, width: 100, height: 44), visible: true, acknowledged: true),
        NativeIslandFrame(id: "b", component: "toggle", frame: CGRect(x: 0, y: 0, width: 51, height: 31), visible: false, acknowledged: false)
      ]
      let dom: [String: [String: Any]] = [
        "a": ["x": 10.4, "y": 21.0, "width": 100.0, "height": 44.0, "scenario": "S01", "expect": "native", "shown": true, "handoff": "moving"]
      ]
      let alignments = NativeIslandAlignment.compare(frames: frames, dom: dom)
      let first = alignments[0]
      #expect(first.web == CGRect(x: 10.4, y: 21, width: 100, height: 44))
      #expect(first.scenario == "S01")
      #expect(first.expect == "native")
      #expect(first.shown)
      #expect(first.handoff == "moving")
      #expect(first.acknowledged)
      #expect(first.isMisaligned())
      #expect(!first.isMisaligned(tolerance: 2))
      let second = alignments[1]
      #expect(second.web == nil)
      #expect(second.deltas.isEmpty)
      #expect(!second.isMisaligned())
      #expect(!second.shown)
    }

    @Test
    func reportsNothingWithoutIslands() async {
      let webView = IslandWebView(frame: CGRect(x: 0, y: 0, width: 300, height: 600))
      #expect(await webView.islands?.alignment().isEmpty == true)
    }
  }
}
