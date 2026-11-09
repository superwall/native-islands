import SwiftUI
import Testing
import UIKit
@testable import NativeIslands

@MainActor
final class FakeSurface: NativeHostSurface {
  let viewport = UIView(frame: CGRect(x: 0, y: 0, width: 400, height: 800))
  let pageScrollView = UIScrollView(frame: CGRect(x: 0, y: 0, width: 400, height: 800))
  let screenLayer: UIView = NativePassthroughView(frame: CGRect(x: 0, y: 0, width: 400, height: 800))

  init() {
    pageScrollView.contentSize = CGSize(width: 400, height: 2000)
    viewport.addSubview(pageScrollView)
    viewport.addSubview(screenLayer)
  }

  @discardableResult
  func addScroller(
    frame: CGRect,
    contentSize: CGSize,
    offset: CGPoint = .zero,
    in parent: UIView? = nil
  ) -> UIScrollView {
    let scroller = UIScrollView(frame: frame)
    scroller.contentSize = contentSize
    scroller.contentOffset = offset
    (parent ?? pageScrollView).addSubview(scroller)
    return scroller
  }
}

@MainActor
final class NativeTestHarness {
  let registry = NativeComponentRegistry()
  let surface = FakeSurface()
  var sent: [[NativeReply]] = []
  var scheduled: [@MainActor () -> Void] = []
  var retries: [@MainActor () -> Void] = []
  var expirations: [@MainActor () -> Void] = []
  let notifications = NotificationCenter()
  lazy var manager = NativeIslandManager(
    registry: registry,
    surface: surface,
    send: { [unowned self] replies in sent.append(replies) },
    schedule: { [unowned self] work in scheduled.append(work) },
    retry: { [unowned self] work in retries.append(work) },
    expire: { [unowned self] work in expirations.append(work) },
    notifications: notifications
  )

  var replies: [NativeReply] {
    sent.flatMap { $0 }
  }

  init() {
    registry.register("glassButton") { _ in Color.clear }
    registry.register("toggle") { _ in Color.clear.frame(width: 51, height: 31) }
    registry.register("rating", version: 2) { _ in Color.clear }
    registry.register("silentBadge", waitsUntilReady: true) { _ in Color.clear }
  }

  func runScheduled() {
    let work = scheduled
    scheduled.removeAll()
    work.forEach { $0() }
  }

  func runRetries() {
    let work = retries
    retries.removeAll()
    work.forEach { $0() }
  }

  func island(_ id: String) -> NativeIsland? {
    manager.islands[id]
  }
}

func mountOp(
  _ id: String = "cta",
  component: String = "glassButton",
  version: Int = 1,
  props: [String: NativeValue] = ["title": .string("Continue")],
  frame: NativeFrame = NativeFrame(x: 10, y: 20, width: 100, height: 44),
  anchor: NativeAnchor = .page,
  visible: Bool = true,
  order: Int = 0,
  sizing: NativeSizing = .web,
  accessibility: NativeAccessibility? = nil,
  stateRevision: Int? = nil,
  reuse: String? = nil
) -> NativeOperation {
  .mount(
    NativeMount(
      id: id,
      component: component,
      version: version,
      props: props,
      frame: frame,
      anchor: anchor,
      visible: visible,
      order: order,
      sizing: sizing,
      accessibility: accessibility,
      stateRevision: stateRevision,
      reuse: reuse
    )
  )
}

func batch(_ sequence: Int, _ operations: NativeOperation...) -> NativeComponentBatch {
  NativeComponentBatch(sequence: sequence, operations: operations)
}

func scroller(
  _ id: String = "list",
  frame: NativeFrame,
  contentSize: NativeSize,
  offset: NativePoint = NativePoint(x: 0, y: 0)
) -> NativeAnchor {
  .scroller(NativeScroller(id: id, frame: frame, contentSize: contentSize, scrollOffset: offset))
}

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct IslandManagerTests {
    @Test
    func recoversFromAnUnreadableBatchWithOneResetPerPage() {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp()))
      harness.manager.recoverFromUnreadableBatch()
      harness.manager.recoverFromUnreadableBatch()
      #expect(harness.manager.islands.isEmpty)
      #expect(harness.sent.last == [.reset])
      #expect(harness.sent.filter { $0 == [.reset] }.count == 1)

      harness.manager.clear(notifyPage: false)
      harness.manager.recoverFromUnreadableBatch()
      #expect(harness.sent.filter { $0 == [.reset] }.count == 2)
    }

    @Test
    func mountsOnThePageAtDocumentCoordinatesAndAcknowledges() {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp()))
      let island = harness.island("cta")
      #expect(island?.view.superview === harness.surface.pageScrollView)
      #expect(island?.view.frame == CGRect(x: 10, y: 20, width: 100, height: 44))
      #expect(island?.view.alpha == 1)
      #expect(island?.context.isAcknowledged == true)
      #expect(harness.sent == [[.ack(sequence: 1, ids: ["cta"])]])
    }

    @Test
    func mountsOnTheScreenLayerAtViewportCoordinates() {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp(anchor: .screen)))
      #expect(harness.island("cta")?.view.superview === harness.surface.screenLayer)
    }

    @Test
    func acknowledgesEveryDrawnMountOfABatchOnce() {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(4, mountOp("a"), mountOp("b"), mountOp("c", component: "nope")))
      #expect(harness.sent.count == 1)
      #expect(harness.sent[0].first == .ack(sequence: 4, ids: ["a", "b"]))
    }

    @Test
    func refusesUnknownAndOutdatedComponents() {
      let harness = NativeTestHarness()
      harness.manager.apply(
        batch(
          2,
          mountOp("x", component: "confetti"),
          mountOp("y", component: "rating", version: 3),
          mountOp("z", component: "rating", version: 2)
        )
      )
      let errors = harness.replies.compactMap { reply -> (String, NativeErrorReason, Int?)? in
        if case let .error(id, reason, _, sequence) = reply { return (id, reason, sequence) }
        return nil
      }
      #expect(errors.map(\.0) == ["x", "y"])
      #expect(errors.map(\.1) == [.unknownComponent, .unsupportedVersion])
      #expect(errors.allSatisfy { $0.2 == 2 })
      #expect(harness.island("z") != nil)
      #expect(harness.island("x") == nil)
    }

    @Test
    func appliesUnmountsThenMountsThenUpdates() {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp("a")))
      harness.manager.apply(
        batch(
          2,
          .update(NativeUpdate(id: "a", frame: NativeFrame(x: 1, y: 2, width: 3, height: 4))),
          mountOp("a", props: ["title": .string("Again")]),
          .unmount(id: "a")
        )
      )
      let island = harness.island("a")
      #expect(island?.context.props.string("title") == "Again")
      #expect(island?.context.sequence == 2)
      #expect(island?.view.frame == CGRect(x: 1, y: 2, width: 3, height: 4))
    }

    @Test
    func replacesAnIslandMountedAgainUnderTheSameId() {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp("a")))
      let first = harness.island("a")?.view
      harness.manager.apply(batch(2, mountOp("a")))
      #expect(first?.superview == nil)
      #expect(harness.surface.pageScrollView.subviews.filter { $0 === harness.island("a")?.view }.count == 1)
    }

    @Test
    func capsTheNumberOfIslands() {
      let harness = NativeTestHarness()
      let operations = (0..<NativeComponentLimits.maxIslands).map { mountOp("i\($0)") }
      harness.manager.apply(NativeComponentBatch(sequence: 1, operations: operations))
      harness.manager.apply(batch(2, mountOp("one-more")))
      #expect(harness.manager.islands.count == NativeComponentLimits.maxIslands)
      #expect(harness.sent.last?.contains { reply in
        if case .error("one-more", .limitExceeded, _, 2) = reply { return true }
        return false
      } == true)
    }

    @Test
    func unmountsAndIgnoresUnknownIds() {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp("a")))
      let view = harness.island("a")?.view
      harness.manager.apply(batch(2, .unmount(id: "a"), .unmount(id: "ghost")))
      harness.manager.apply(batch(3, .update(NativeUpdate(id: "ghost", visible: false))))
      #expect(view?.isHidden == true)
      harness.expirations.forEach { $0() }
      #expect(view?.superview == nil)
      #expect(harness.manager.islands.isEmpty)
      #expect(harness.sent.count == 1)
    }

    @Test
    func reportsInvalidOperationsWithTheirId() {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp("a")))
      harness.manager.apply(batch(2, .invalid(id: "a"), .invalid(id: nil)))
      #expect(harness.island("a") == nil)
      #expect(harness.sent.last == [
        .error(id: "a", reason: .invalidProps, message: "The host couldn't read this island's operation.", sequence: 1)
      ])
    }

    @Test
    func togglesVisibilityAndInteraction() {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp(visible: false)))
      let view = harness.island("cta")?.view
      #expect(view?.alpha == 0)
      #expect(view?.isUserInteractionEnabled == false)
      #expect(harness.sent == [[.ack(sequence: 1, ids: ["cta"])]])
      harness.manager.apply(batch(2, .update(NativeUpdate(id: "cta", visible: true))))
      #expect(view?.alpha == 1)
      #expect(view?.isUserInteractionEnabled == true)
      #expect(harness.island("cta")?.context.isVisible == true)
    }

    @Test
    func updatesFramesPropsOrderAndAccessibility() {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp("a", order: 0), mountOp("b", order: 1)))
      #expect(harness.surface.pageScrollView.subviews.last === harness.island("b")?.view)
      harness.manager.apply(
        batch(
          2,
          .update(
            NativeUpdate(
              id: "a",
              props: ["title": .string("Start")],
              frame: NativeFrame(x: 0, y: 500, width: 200, height: 50),
              order: 5,
              accessibility: NativeAccessibility(label: "Start", hidden: true)
            )
          )
        )
      )
      let island = harness.island("a")
      #expect(island?.view.frame == CGRect(x: 0, y: 500, width: 200, height: 50))
      #expect(island?.context.props.string("title") == "Start")
      #expect(island?.context.accessibility?.label == "Start")
      #expect(island?.view.accessibilityElementsHidden == true)
      #expect(harness.surface.pageScrollView.subviews.last === island?.view)
    }

    @Test
    func moveBetweenPageAndScreen() {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp()))
      harness.manager.apply(batch(2, .update(NativeUpdate(id: "cta", anchor: .screen))))
      #expect(harness.island("cta")?.view.superview === harness.surface.screenLayer)
      harness.manager.apply(batch(3, .update(NativeUpdate(id: "cta", anchor: .page))))
      #expect(harness.island("cta")?.view.superview === harness.surface.pageScrollView)
    }

    @Test
    func reportsTheSizeOfNativelySizedComponents() {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp("t", component: "toggle", sizing: .native)))
      #expect(harness.sent == [
        [
          .ack(sequence: 1, ids: ["t"]),
          .size(id: "t", size: NativeSize(width: 51, height: 31), sequence: 1)
        ]
      ])
      harness.manager.apply(batch(2, .update(NativeUpdate(id: "t", props: ["isOn": .bool(true)]))))
      #expect(harness.scheduled.isEmpty)
      #expect(harness.sent.count == 1)
    }

    @Test
    func reportsANewSizeWhenNativeContentChangesSizeOnItsOwn() async {
      let harness = NativeTestHarness()
      let width = GrowingWidth()
      harness.registry.register("growing") { _ in GrowingView(width: width) }
      harness.manager.apply(batch(1, mountOp("g", component: "growing", sizing: .native)))
      #expect(harness.replies == [
        .ack(sequence: 1, ids: ["g"]),
        .size(id: "g", size: NativeSize(width: 20, height: 20), sequence: 1)
      ])

      width.value = 80
      await settle(harness.island("g"))
      harness.runScheduled()
      #expect(harness.replies.last == .size(id: "g", size: NativeSize(width: 80, height: 20), sequence: 1))
      let reported = harness.replies.count

      width.value = 80
      await settle(harness.island("g"))
      harness.runScheduled()
      #expect(harness.replies.count == reported)
    }

    @Test
    func stopsWatchingTheSizeOfARemovedIsland() async {
      let harness = NativeTestHarness()
      let width = GrowingWidth()
      harness.registry.register("growing") { _ in GrowingView(width: width) }
      harness.manager.apply(batch(1, mountOp("g", component: "growing", sizing: .native)))
      let island = harness.island("g")
      harness.manager.apply(batch(2, .unmount(id: "g")))
      let reported = harness.replies.count

      width.value = 80
      await settle(island)
      harness.runScheduled()
      #expect(harness.replies.count == reported)
    }

    @Test
    func measuresOnlyTheHeightOfAnIslandAtThePagesWidth() {
      let harness = NativeTestHarness()
      harness.registry.register("wide") { _ in WideView() }
      harness.manager.apply(batch(
        1,
        mountOp("w", component: "wide", frame: NativeFrame(x: 0, y: 0, width: 100, height: 0), sizing: .nativeHeight)
      ))
      #expect(harness.replies == [
        .ack(sequence: 1, ids: ["w"]),
        .size(id: "w", size: NativeSize(width: 100, height: 50), sequence: 1)
      ])
      #expect(harness.island("w")?.sizeObservation != nil)
    }

    @Test
    func measuresAgainOnlyWhenThePageChangesTheWidth() {
      let harness = NativeTestHarness()
      harness.registry.register("wide") { _ in WideView() }
      harness.manager.apply(batch(
        1,
        mountOp("w", component: "wide", frame: NativeFrame(x: 0, y: 0, width: 100, height: 0), sizing: .nativeHeight)
      ))
      harness.manager.apply(batch(
        2,
        .update(NativeUpdate(id: "w", frame: NativeFrame(x: 0, y: 0, width: 100, height: 50)))
      ))
      #expect(harness.replies.count == 2)
      harness.manager.apply(batch(
        3,
        .update(NativeUpdate(id: "w", frame: NativeFrame(x: 0, y: 0, width: 300, height: 50)))
      ))
      #expect(harness.replies.contains(.size(id: "w", size: NativeSize(width: 300, height: 150), sequence: 1)))
      #expect(harness.replies.filter { if case .size = $0 { true } else { false } }.count == 2)
    }

    @Test
    func waitsForAWidthBeforeMeasuringTheHeight() {
      let harness = NativeTestHarness()
      harness.registry.register("wide") { _ in WideView() }
      harness.manager.apply(batch(
        1,
        mountOp("w", component: "wide", frame: NativeFrame(x: 0, y: 0, width: 0, height: 0), sizing: .nativeHeight)
      ))
      #expect(harness.replies == [.ack(sequence: 1, ids: ["w"])])
      harness.manager.apply(batch(
        2,
        .update(NativeUpdate(id: "w", frame: NativeFrame(x: 0, y: 0, width: 80, height: 0)))
      ))
      #expect(harness.replies.contains(.size(id: "w", size: NativeSize(width: 80, height: 40), sequence: 1)))
    }

    @Test
    func doesNotWatchTheSizeOfWebSizedIslands() {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp("t", component: "toggle")))
      #expect(harness.island("t")?.sizeObservation == nil)
    }

    @Test
    func clearsEveryIslandAndAsksForAResetOnlyWhenThePageLivesOn() {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp("a"), mountOp("b", anchor: .screen)))
      harness.manager.clear(notifyPage: false)
      #expect(harness.manager.islands.isEmpty)
      #expect(harness.surface.screenLayer.subviews.isEmpty)
      #expect(harness.sent.count == 1)
      harness.manager.apply(batch(2, mountOp("a")))
      harness.manager.clear(notifyPage: true)
      #expect(harness.sent.last == [.reset])
    }

    @Test
    func reportsAMissingSurfaceAsAnAnchorNotFound() {
      var harness: NativeTestHarness? = NativeTestHarness()
      let registry = harness!.registry
      var sent: [[NativeReply]] = []
      var surface: FakeSurface? = FakeSurface()
      let manager = NativeIslandManager(registry: registry, surface: surface!) { sent.append($0) }
      surface = nil
      harness = nil
      manager.apply(batch(1, mountOp()))
      #expect(sent.first?.first.map { reply in
        if case .error("cta", .anchorNotFound, _, 1) = reply { return true }
        return false
      } == true)
    }
  }
}

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct HostingControllerTests {
    @Test
    func aMountedIslandIsAChildOfTheWebViewsController() throws {
      let harness = NativeTestHarness()
      let controller = UIViewController()
      controller.view.addSubview(harness.surface.viewport)
      harness.manager.apply(batch(1, mountOp(), mountOp("toast", anchor: .screen)))
      let page = try #require(harness.island("cta"))
      let screen = try #require(harness.island("toast"))
      #expect(page.host.parent === controller)
      #expect(screen.host.parent === controller)
      #expect(controller.children.count == 2)
    }

    @Test
    func removingAnIslandReleasesItsController() throws {
      let harness = NativeTestHarness()
      let controller = UIViewController()
      controller.view.addSubview(harness.surface.viewport)
      harness.manager.apply(batch(1, mountOp()))
      let host = try #require(harness.island("cta")?.host)
      harness.manager.apply(batch(2, .unmount(id: "cta")))
      harness.expirations.forEach { $0() }
      #expect(host.parent == nil)
      #expect(controller.children.isEmpty)
      harness.manager.apply(batch(3, mountOp("a"), mountOp("b")))
      harness.manager.clear(notifyPage: false)
      #expect(controller.children.isEmpty)
    }

    @Test
    func islandsMountedBeforeTheWebViewHadAControllerAreAdoptedLater() throws {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp()))
      let host = try #require(harness.island("cta")?.host)
      #expect(host.parent == nil)

      let first = UIViewController()
      first.view.addSubview(harness.surface.viewport)
      harness.manager.adoptIslands()
      #expect(host.parent === first)

      let second = UIViewController()
      second.view.addSubview(harness.surface.viewport)
      harness.manager.adoptIslands()
      #expect(host.parent === second)
      #expect(first.children.isEmpty)
    }

    @Test
    func anIslandWebViewAdoptsItsIslandsWhenItEntersAWindow() throws {
      let registry = NativeComponentRegistry()
      registry.register("glassButton") { _ in Color.clear }
      let webView = IslandWebView(frame: CGRect(x: 0, y: 0, width: 400, height: 800), registry: registry)
      let manager = try #require(webView.islands?.manager)
      manager.apply(batch(1, mountOp()))
      let host = try #require(manager.islands["cta"]?.host)
      #expect(host.parent == nil)

      let controller = UIViewController()
      controller.view.frame = webView.frame
      let window = UIWindow(frame: webView.frame)
      window.rootViewController = controller
      window.isHidden = false
      defer { window.isHidden = true }
      controller.view.addSubview(webView)
      #expect(host.parent === controller)
    }
  }
}

@MainActor
final class GrowingWidth: ObservableObject {
  @Published var value: CGFloat = 20
}

struct GrowingView: View {
  @ObservedObject var width: GrowingWidth

  var body: some View {
    Color.clear.frame(width: width.value, height: 20)
  }
}

/// Twice as wide as it is tall at whatever width it is given, and as wide as
/// the page lets it be, as a view that wraps text is.
struct WideView: View {
  var body: some View {
    Color.clear.aspectRatio(2, contentMode: .fit).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
  }
}

/// Lets SwiftUI pick up a state change, then lays the island out so its
/// hosting controller updates its preferred size.
@MainActor
func settle(_ island: NativeIsland?) async {
  try? await Task.sleep(for: .milliseconds(50))
  island?.host.view.setNeedsLayout()
  island?.host.view.layoutIfNeeded()
}
