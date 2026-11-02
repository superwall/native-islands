import SwiftUI
import Testing
import UIKit
import WebKit
@testable import NativeIslands

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct FrameReporterTests {
    @Test
    func reportsEveryIslandInViewportCoordinates() {
      let harness = NativeTestHarness()
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
      var harness: NativeTestHarness? = NativeTestHarness()
      let reporter = NativeFrameReporter(islands: harness!.manager)
      harness = nil
      #expect(reporter.report().isEmpty)
    }
  }

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
