import SwiftUI
import Testing
import WebKit
@testable import NativeIslands

@MainActor
final class ManualScheduler {
  private(set) var pending: [(delay: TimeInterval, work: @MainActor () -> Void)] = []

  var schedule: NativeIslandsScheduler {
    { [weak self] delay, work in self?.pending.append((delay, work)) }
  }

  func runAll() {
    let due = pending
    pending.removeAll()
    for item in due { item.work() }
  }
}

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct RevealTests {
    private func registry() -> NativeComponentRegistry {
      let registry = NativeComponentRegistry()
      registry.register("glassButton") { _ in Color.clear }
      return registry
    }

    private func host(
      _ webView: WKWebView = RecordingWebView(),
      reveal: NativeIslandsReveal = .whenIslandsReady(timeout: 1),
      registry: NativeComponentRegistry? = nil
    ) -> (NativeIslandsHost, ManualScheduler) {
      let scheduler = ManualScheduler()
      let host = NativeIslandsHost(
        webView: webView,
        registry: registry ?? self.registry(),
        reveal: reveal,
        schedule: scheduler.schedule
      )
      return (host, scheduler)
    }

    @Test
    func holdsTheFirstDocumentUntilThePageIsReady() {
      let webView = RecordingWebView()
      let (host, scheduler) = host(webView)
      var seen: [NativeIslandsReadiness] = []
      host.onReady = { seen.append($0) }
      #expect(webView.isConcealed)
      #expect(host.isReady == false)
      #expect(scheduler.pending.map(\.delay) == [1])
      host.receive(["event_name": "native_islands_ready", "sequence": 1])
      #expect(!webView.isConcealed)
      #expect(host.isReady)
      #expect(seen == [.ready])
      host.receive(["event_name": "native_islands_ready", "sequence": 1])
      scheduler.runAll()
      #expect(seen == [.ready])
    }

    @Test
    func waitsForThePageToLayOutBeforeShowingIt() {
      let webView = RecordingWebView()
      let scheduler = ManualScheduler()
      var settling: [@MainActor () -> Void] = []
      let host = NativeIslandsHost(
        webView: webView,
        registry: registry(),
        reveal: .whenIslandsReady(timeout: 1),
        schedule: scheduler.schedule
      ) { _, done in
        settling.append(done)
      }
      var seen: [NativeIslandsReadiness] = []
      host.onReady = { seen.append($0) }
      host.receive(["event_name": "native_islands_ready", "sequence": 1])
      #expect(webView.isConcealed)
      #expect(settling.count == 1)
      settling.removeFirst()()
      #expect(!webView.isConcealed)
      #expect(seen == [.ready])

      host.receive(NativeIslandsHost.documentStartMarker)
      host.receive(["event_name": "native_islands_ready", "sequence": 1])
      scheduler.runAll()
      settling.forEach { $0() }
      #expect(seen == [.ready, .timedOut])
    }

    @Test
    func showsTheDocumentWhenThePageNeverAnnounces() {
      let webView = RecordingWebView()
      let (host, scheduler) = host(webView)
      var seen: [NativeIslandsReadiness] = []
      host.onReady = { seen.append($0) }
      scheduler.runAll()
      #expect(!webView.isConcealed)
      #expect(seen == [.timedOut])
    }

    @Test
    func holdsEachNewDocumentAgainAndIgnoresTheOldTimeout() {
      let webView = RecordingWebView()
      let (host, scheduler) = host(webView)
      var seen: [NativeIslandsReadiness] = []
      host.onReady = { seen.append($0) }
      host.receive(NativeIslandsHost.documentStartMarker)
      #expect(scheduler.pending.count == 2)
      #expect(webView.isConcealed)
      scheduler.pending.first?.work()
      #expect(host.isReady == false)
      host.receive(["event_name": "native_islands_ready", "sequence": 0])
      #expect(seen == [.ready])
    }

    @Test
    func coversThePageWithoutTouchingTheWebViewAndRestoresInteraction() {
      let webView = RecordingWebView()
      let mask = CALayer()
      webView.layer.mask = mask
      webView.isUserInteractionEnabled = false
      let (host, _) = host(webView)
      #expect(webView.isConcealed)
      #expect(webView.alpha == 1)
      #expect(webView.layer.mask === mask)
      host.receive(["event_name": "native_islands_ready", "sequence": 0])
      #expect(webView.layer.mask === mask)
      #expect(webView.isUserInteractionEnabled == false)
      #expect(!webView.isConcealed)
    }

    @Test
    func takesTheColourBehindATransparentWebView() {
      let container = UIView()
      container.backgroundColor = .systemTeal
      let webView = RecordingWebView()
      webView.backgroundColor = .clear
      container.addSubview(webView)
      let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
      window.addSubview(container)
      window.isHidden = false
      defer { window.isHidden = true }
      let (host, _) = host(webView)
      let cover = webView.subviews.compactMap { $0 as? NativeIslandsCover }.first
      #expect(cover?.backgroundColor == .systemTeal)
      #expect(NativeIslandsCover.colorBehind(UIView()) == nil)
      host.detach()
    }

    @Test
    func keepsTheCoverAboveTheScreenLayer() throws {
      let webView = RecordingWebView()
      let (host, _) = host(webView)
      let screen = try #require(host.manager?.surface?.screenLayer)
      #expect(webView.subviews.last is NativeIslandsCover)
      #expect(webView.subviews.contains(screen))
      host.receive(["event_name": "native_islands_ready", "sequence": 0])
      _ = host.manager?.surface?.screenLayer
      #expect(webView.subviews.last === screen)
    }

    @Test
    func showsAtOnceWhenAskedTo() {
      let webView = RecordingWebView()
      let (host, scheduler) = host(webView, reveal: .immediately)
      #expect(!webView.isConcealed)
      #expect(host.isReady)
      #expect(scheduler.pending.isEmpty)
      host.receive(NativeIslandsHost.documentStartMarker)
      #expect(!webView.isConcealed)
    }

    @Test
    func holdsNothingWhenItOffersNothing() {
      let webView = RecordingWebView()
      let (host, scheduler) = host(webView, registry: NativeComponentRegistry())
      #expect(!webView.isConcealed)
      #expect(host.isReady)
      #expect(scheduler.pending.isEmpty)
    }

    @Test
    func showsTheWebViewWhenDetached() {
      let webView = RecordingWebView()
      let (host, scheduler) = host(webView)
      var seen: [NativeIslandsReadiness] = []
      host.onReady = { seen.append($0) }
      host.detach()
      scheduler.runAll()
      #expect(!webView.isConcealed)
      #expect(seen.isEmpty)
    }

    @Test
    func decodesTheReadyMessage() throws {
      #expect(
        try NativeHostMessage.decode(body: ["event_name": "native_islands_ready", "sequence": 3])
          == .ready(sequence: 3)
      )
      #expect(throws: (any Error).self) {
        try NativeHostMessage.decode(body: ["event_name": "native_islands_ready", "sequence": -1])
      }
      #expect(throws: (any Error).self) {
        try NativeHostMessage.decode(body: ["event_name": "native_islands_ready"])
      }
    }

    @Test
    func aHiddenWebViewStillRunsThePageUntilItAnnounces() async throws {
      let webView = IslandWebView(
        frame: CGRect(x: 0, y: 0, width: 400, height: 800),
        registry: registry(),
        reveal: .whenIslandsReady(timeout: 30)
      )
      let window = UIWindow(frame: webView.frame)
      window.addSubview(webView)
      window.isHidden = false
      defer { window.isHidden = true }
      var seen: [NativeIslandsReadiness] = []
      webView.islands?.onReady = { seen.append($0) }
      #expect(webView.isConcealed)
      webView.loadHTMLString(
        """
        <!doctype html><html><body><script>
        window.webkit.messageHandlers.nativeIslands.postMessage({
          event_name: "native_islands_ready", sequence: 0
        });
        </script></body></html>
        """,
        baseURL: nil
      )
      let deadline = Date().addingTimeInterval(30)
      while webView.islands?.isReady != true, Date() < deadline {
        try await Task.sleep(nanoseconds: 20_000_000)
      }
      #expect(seen == [.ready])
      #expect(!webView.isConcealed)
    }
  }
}

private extension WKWebView {
  var isConcealed: Bool {
    subviews.last is NativeIslandsCover && !isUserInteractionEnabled
  }
}
