import SwiftUI
import Testing
import WebKit
@testable import NativeIslands

extension NativeBridgeTests {
  /// Loads real pages into a real web view, so the scripts, the message
  /// handler and the reply receiver are exercised as a page sees them.
  @Suite(.serialized)
  @MainActor
  struct WebViewTests {
    static let builtIns: [(id: String, component: String, props: String, sizing: String)] = [
      ("cta", "glassButton", #"{"title":"Continue","systemImage":"sparkles","prominence":"prominent","tint":"rgb(10, 132, 255)","glassGroup":"bar"}"#, "web"),
      ("close", "closeButton", #"{"glassGroup":"bar"}"#, "web"),
      ("annual", "toggle", #"{"isOn":true,"tint":"rgba(52, 199, 89, 1)"}"#, "native"),
      ("plans", "segmentedControl", #"{"segments":["Monthly","Annual"],"selectedIndex":1}"#, "web"),
      ("star", "symbol", #"{"name":"star.fill","tint":"rgb(255, 204, 0)","weight":"bold","pointSize":22}"#, "web")
    ]

    static func page() -> String {
      let operations = builtIns.enumerated().map { index, island in
        """
        {"op":"mount","id":"\(island.id)","component":"\(island.component)","version":1,\
        "props":\(island.props),"frame":{"x":20,"y":\(20 + index * 60),"width":200,"height":44},\
        "anchor":{"type":"page"},"visible":true,"order":\(index),"sizing":"\(island.sizing)",\
        "accessibility":{"label":"\(island.id)","traits":["button"]}}
        """
      }
      return """
        <!doctype html><html><body style="margin:0;height:2000px">
        <script>
        window.received = [];
        window.__nativeIslands = { accept64: (b) => window.received.push(...JSON.parse(atob(b))) };
        window.offered = JSON.stringify(window.__NATIVE_ISLANDS__ || null);
        window.webkit.messageHandlers.nativeIslands.postMessage({
          event_name: "native_component_batch", protocol: 1, sequence: 1,
          operations: [\(operations.joined(separator: ","))]
        });
        </script></body></html>
        """
    }

    private func until(_ condition: () -> Bool) async throws {
      for _ in 0..<200 where !condition() {
        try await Task.sleep(nanoseconds: 25_000_000)
      }
      try #require(condition())
    }

    private func evaluate(_ webView: WKWebView, _ script: String) async throws -> Any? {
      try await webView.callAsyncJavaScript(script, contentWorld: .page)
    }

    private func loaded() async throws -> (IslandWebView, UIWindow) {
      let webView = IslandWebView(frame: CGRect(x: 0, y: 0, width: 400, height: 800))
      let window = UIWindow(frame: webView.frame)
      window.addSubview(webView)
      window.isHidden = false
      webView.loadHTMLString(Self.page(), baseURL: nil)
      try await until { webView.islands?.manager?.islands.count == Self.builtIns.count }
      return (webView, window)
    }

    @Test
    func aPageMountsEveryBuiltInAndHearsTheAck() async throws {
      let (webView, window) = try await loaded()
      defer { window.isHidden = true }
      let offered = try #require(try await evaluate(webView, "return window.offered") as? String)
      #expect(offered.contains("\"glassButton\":1"))
      try await until {
        webView.islands?.manager?.islands.values.allSatisfy(\.context.isAcknowledged) == true
      }
      var events: [String] = []
      for _ in 0..<200 {
        let received = try await evaluate(webView, "return window.received.map((m) => m.event_name)")
        events = received as? [String] ?? []
        if events.contains("native_component_ack") { break }
        try await Task.sleep(nanoseconds: 25_000_000)
      }
      #expect(events.first == "native_component_ack")
      #expect(events.contains("native_component_size"))
      for island in try #require(webView.islands?.manager).islands.values {
        island.view.layoutIfNeeded()
        #expect(island.view.superview != nil)
      }
    }

    @Test
    func theFrameReporterAnswersThePage() async throws {
      let (webView, window) = try await loaded()
      defer { window.isHidden = true }
      let frames = try await evaluate(
        webView,
        "return await window.webkit.messageHandlers.nativeIslandsFrames.postMessage(null)"
      )
      let list = try #require(frames as? [[String: Any]])
      #expect(Set(list.compactMap { $0["id"] as? String }) == Set(Self.builtIns.map(\.id)))
    }

    @Test
    func theAlignmentProbeSamplesWithoutThrowing() async throws {
      let (webView, window) = try await loaded()
      defer { window.isHidden = true }
      let probe = NativeAlignmentProbe(webView: webView, islands: try #require(webView.islands?.manager))
      probe.start()
      try await Task.sleep(nanoseconds: 700_000_000)
      probe.stop()
    }

    @Test
    func aNewDocumentClearsTheIslands() async throws {
      let (webView, window) = try await loaded()
      defer { window.isHidden = true }
      webView.loadHTMLString("<!doctype html><p>next</p>", baseURL: nil)
      try await until { webView.islands?.manager?.islands.isEmpty == true }
    }
  }
}
