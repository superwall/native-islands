import ObjectiveC
import Testing
import UIKit
import WebKit
@testable import NativeIslands

/// A web view class an SDK might own: it overrides both calls itself.
private class CountingWebView: WKWebView {
  var hitTests = 0
  var windowMoves = 0

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    hitTests += 1
    return super.hitTest(point, with: event)
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    windowMoves += 1
  }
}

/// A subclass that overrides nothing, like Superwall's paywall web view.
private final class PlainSubclassWebView: WKWebView {}

/// A subclass of a class that overrides both calls, so both can carry the
/// forwarding overrides.
private final class NestedCountingWebView: CountingWebView {}

extension NativeBridgeTests {
  @Suite(.serialized)
  @MainActor
  struct HostAttachTests {
    static let frame = CGRect(x: 0, y: 0, width: 400, height: 800)
    /// Inside the island `mount(_:)` draws.
    static let islandPoint = CGPoint(x: 30, y: 30)
    static let awayPoint = CGPoint(x: 300, y: 600)

    private func show(_ webView: WKWebView) -> UIWindow {
      let window = UIWindow(frame: Self.frame)
      window.addSubview(webView)
      window.isHidden = false
      return window
    }

    /// Mounts a `cta` button at (10, 20), 100 by 44 points, as a page would.
    private func mount(_ host: NativeIslandsHost) throws -> NativeIsland {
      host.receive([
        "event_name": "native_component_batch",
        "protocol": 1,
        "sequence": 1,
        "operations": [
          [
            "op": "mount",
            "id": "cta",
            "component": "glassButton",
            "version": 1,
            "props": ["title": "Go"],
            "frame": ["x": 10, "y": 20, "width": 100, "height": 44],
            "anchor": ["type": "page"],
            "visible": true,
            "order": 0,
            "sizing": "web"
          ] as [String: Any]
        ]
      ])
      return try #require(host.manager?.islands["cta"])
    }

    private func attach(_ webView: WKWebView) -> NativeIslandsHost {
      NativeIslandsHost.attach(to: webView, registry: WebViewTests.registry, reveal: .immediately)
    }

    @Test
    func aPlainWebViewHandsTouchesToItsIslands() throws {
      let webView = PlainSubclassWebView(frame: Self.frame)
      let window = show(webView)
      defer { window.isHidden = true }
      let host = attach(webView)
      let cta = try mount(host)
      let hit = try #require(webView.hitTest(Self.islandPoint, with: nil))
      #expect(hit.isDescendant(of: cta.view))
      #expect(webView.hitTest(Self.awayPoint, with: nil)?.isDescendant(of: cta.view) != true)
    }

    @Test
    func aSubclassKeepsItsOwnOverridesAndItsOtherWebViewsAreUntouched() throws {
      let attached = CountingWebView(frame: Self.frame)
      let other = CountingWebView(frame: Self.frame)
      let window = show(attached)
      window.addSubview(other)
      other.frame = Self.frame.offsetBy(dx: 0, dy: 900)
      defer { window.isHidden = true }
      let host = attach(attached)
      #expect(WebViewForwarding.isInstalled(on: CountingWebView.self))
      let cta = try mount(host)

      // On an island the host answers, as IslandWebView does, without running
      // the class's own hitTest; anywhere else that runs once, as before.
      let before = attached.hitTests
      let hit = attached.hitTest(Self.islandPoint, with: nil)
      #expect(hit?.isDescendant(of: cta.view) == true)
      #expect(attached.hitTests == before)
      _ = attached.hitTest(Self.awayPoint, with: nil)
      #expect(attached.hitTests == before + 1)

      let otherBefore = other.hitTests
      let otherHit = other.hitTest(Self.islandPoint, with: nil)
      #expect(other.hitTests == otherBefore + 1)
      #expect(otherHit?.isDescendant(of: cta.view) != true)
      #expect(WebViewForwarding.host(of: other) == nil)

      let moves = (attached.windowMoves, other.windowMoves)
      attached.removeFromSuperview()
      other.removeFromSuperview()
      #expect(attached.windowMoves == moves.0 + 1)
      #expect(other.windowMoves == moves.1 + 1)
    }

    @Test
    func aSubclassOfAForwardedClassForwardsOnce() throws {
      _ = attach(CountingWebView(frame: Self.frame))
      let webView = NestedCountingWebView(frame: Self.frame)
      let window = show(webView)
      defer { window.isHidden = true }
      let host = attach(webView)
      #expect(WebViewForwarding.isInstalled(on: NestedCountingWebView.self))
      let cta = try mount(host)
      let before = webView.hitTests
      #expect(webView.hitTest(Self.islandPoint, with: nil)?.isDescendant(of: cta.view) == true)
      #expect(webView.hitTests == before)
      _ = webView.hitTest(Self.awayPoint, with: nil)
      #expect(webView.hitTests == before + 1)
      let moves = webView.windowMoves
      webView.removeFromSuperview()
      #expect(webView.windowMoves == moves + 1)
    }

    @Test
    func islandsFollowTheWebViewIntoAController() throws {
      let webView = PlainSubclassWebView(frame: Self.frame)
      let bare = show(webView)
      let host = attach(webView)
      let cta = try mount(host)
      #expect(cta.host.parent == nil)

      let controller = UIViewController()
      let window = UIWindow(frame: Self.frame)
      window.rootViewController = controller
      window.isHidden = false
      defer {
        window.isHidden = true
        bare.isHidden = true
      }
      controller.view.addSubview(webView)
      #expect(cta.host.parent === controller)
    }

    @Test
    func attachingTwiceReturnsTheSameHost() {
      let webView = PlainSubclassWebView(frame: Self.frame)
      let first = attach(webView)
      #expect(attach(webView) === first)
      first.detach()
      #expect(WebViewForwarding.host(of: webView) == nil)
    }

    @Test
    func attachingReturnsAHostTheWebViewAlreadyHas() {
      let islandWebView = IslandWebView(frame: Self.frame, registry: WebViewTests.registry)
      #expect(attach(islandWebView) === islandWebView.islands)
      #expect(WebViewForwarding.host(of: islandWebView) == nil)

      let webView = PlainSubclassWebView(frame: Self.frame)
      let own = NativeIslandsHost(webView: webView, registry: WebViewTests.registry)
      defer { own.detach() }
      #expect(attach(webView) === own)
      #expect(WebViewForwarding.host(of: webView) == nil)
    }

    @Test
    func detachingLetsTheHostGoAndTheWebViewBehaveAsBefore() throws {
      let webView = CountingWebView(frame: Self.frame)
      let window = show(webView)
      defer { window.isHidden = true }
      weak var released: NativeIslandsHost?
      do {
        let host = attach(webView)
        released = host
        _ = try mount(host)
        host.detach()
      }
      #expect(released == nil)
      #expect(WebViewForwarding.host(of: webView) == nil)
      let before = webView.hitTests
      _ = webView.hitTest(Self.islandPoint, with: nil)
      #expect(webView.hitTests == before + 1)
    }

    @Test
    func aWebViewObservedWithKeyValueObservingForwardsOnItsOwnClass() throws {
      let webView = PlainSubclassWebView(frame: Self.frame)
      let observation = webView.observe(\.title) { _, _ in }
      #expect(object_getClass(webView) !== PlainSubclassWebView.self)
      #expect(WebViewForwarding.ownClass(of: webView) === PlainSubclassWebView.self)
      let window = show(webView)
      defer { window.isHidden = true }
      let host = attach(webView)
      let cta = try mount(host)
      observation.invalidate()
      #expect(webView.hitTest(Self.islandPoint, with: nil)?.isDescendant(of: cta.view) == true)
    }
  }
}
