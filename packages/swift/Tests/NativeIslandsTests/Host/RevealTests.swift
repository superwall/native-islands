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
      let registry = NativeComponentRegistry(includingBuiltIns: false)
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
      #expect(webView.alpha == 0)
      #expect(host.isReady == false)
      #expect(scheduler.pending.map(\.delay) == [1])
      host.receive(["event_name": "native_islands_ready", "sequence": 1])
      #expect(webView.alpha == 1)
      #expect(host.isReady)
      #expect(seen == [.ready])
      host.receive(["event_name": "native_islands_ready", "sequence": 1])
      scheduler.runAll()
      #expect(seen == [.ready])
    }

    @Test
    func showsTheDocumentWhenThePageNeverAnnounces() {
      let webView = RecordingWebView()
      let (host, scheduler) = host(webView)
      var seen: [NativeIslandsReadiness] = []
      host.onReady = { seen.append($0) }
      scheduler.runAll()
      #expect(webView.alpha == 1)
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
      #expect(webView.alpha == 0)
      scheduler.pending.first?.work()
      #expect(host.isReady == false)
      host.receive(["event_name": "native_islands_ready", "sequence": 0])
      #expect(seen == [.ready])
    }

    @Test
    func restoresTheAlphaTheWebViewHadBeforeTheHold() {
      let webView = RecordingWebView()
      webView.alpha = 0.5
      let (host, _) = host(webView)
      #expect(webView.alpha == 0)
      host.receive(["event_name": "native_islands_ready", "sequence": 0])
      #expect(webView.alpha == 0.5)
    }

    @Test
    func showsAtOnceWhenAskedTo() {
      let webView = RecordingWebView()
      let (host, scheduler) = host(webView, reveal: .immediately)
      #expect(webView.alpha == 1)
      #expect(host.isReady)
      #expect(scheduler.pending.isEmpty)
      host.receive(NativeIslandsHost.documentStartMarker)
      #expect(webView.alpha == 1)
    }

    @Test
    func holdsNothingWhenItOffersNothing() {
      let webView = RecordingWebView()
      let (host, scheduler) = host(webView, registry: NativeComponentRegistry(includingBuiltIns: false))
      #expect(webView.alpha == 1)
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
      #expect(webView.alpha == 1)
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
      #expect(webView.alpha == 0)
      webView.loadHTMLString(
        """
        <!doctype html><html><body><script>
        requestAnimationFrame(() => requestAnimationFrame(() =>
          window.webkit.messageHandlers.nativeIslands.postMessage({
            event_name: "native_islands_ready", sequence: 0
          })));
        </script></body></html>
        """,
        baseURL: nil
      )
      for _ in 0..<1000 where webView.islands?.isReady != true {
        try await Task.sleep(nanoseconds: 10_000_000)
      }
      #expect(seen == [.ready])
      #expect(webView.alpha == 1)
    }
  }
}
