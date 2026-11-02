import SwiftUI
import Testing
import WebKit
@testable import NativeIslands

@MainActor
final class RecordingWebView: WKWebView {
  var scripts: [String] = []

  override func evaluateJavaScript(
    _ javaScriptString: String,
    completionHandler: (@MainActor (Any?, (any Error)?) -> Void)? = nil
  ) {
    scripts.append(javaScriptString)
  }
}

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct HostTests {
    private func registry() -> NativeComponentRegistry {
      let registry = NativeComponentRegistry()
      registry.register("glassButton") { _ in Color.clear }
      return registry
    }

    private func pageMount(id: String = "cta") -> [String: Any] {
      [
        "event_name": "native_component_batch",
        "protocol": 1,
        "sequence": 1,
        "operations": [
          [
            "op": "mount",
            "id": id,
            "component": "glassButton",
            "version": 1,
            "props": ["title": "Go"],
            "frame": ["x": 10, "y": 20, "width": 100, "height": 44],
            "anchor": ["type": "page"],
            "visible": true,
            "order": 0,
            "sizing": "web"
          ]
        ]
      ]
    }

    private func delivered(_ webView: RecordingWebView) throws -> [[String: Any]] {
      try webView.scripts.flatMap { script -> [[String: Any]] in
        let prefix = "window.__nativeIslands && window.__nativeIslands.accept64(\""
        guard script.hasPrefix(prefix) else { return [] }
        let base64 = String(script.dropFirst(prefix.count).dropLast(3))
        let data = try #require(Data(base64Encoded: base64))
        return try #require(try JSONSerialization.jsonObject(with: data) as? [[String: Any]])
      }
    }

    @Test
    func injectsTheCapabilityAndDocumentStartScripts() {
      let webView = WKWebView()
      let host = NativeIslandsHost(webView: webView, registry: registry())
      let sources = webView.configuration.userContentController.userScripts.map(\.source)
      #expect(host.isOffering)
      #expect(sources.contains { $0.hasPrefix("window.__NATIVE_ISLANDS__ = ") && $0.contains("\"glassButton\":1") })
      #expect(sources.contains(NativeIslandsHost.documentStartScript))
      #expect(webView.configuration.userContentController.userScripts.allSatisfy { $0.injectionTime == .atDocumentStart })
    }

    @Test
    func offersNothingWithAnEmptyRegistry() {
      let webView = RecordingWebView()
      let host = NativeIslandsHost(webView: webView, registry: NativeComponentRegistry())
      #expect(!host.isOffering)
      #expect(webView.configuration.userContentController.userScripts.isEmpty)
      host.receive(pageMount())
      #expect(webView.scripts.isEmpty)
      #expect(host.hitTest(.zero, with: nil) { nil } == nil)
    }

    @Test
    func usesTheSharedRegistryByDefault() {
      let host = NativeIslandsHost(webView: WKWebView())
      #expect(host.registry === NativeComponentRegistry.shared)
      #expect(IslandWebView().islands?.registry === NativeComponentRegistry.shared)
    }

    @Test
    func drawsAMountAndAcksItThroughTheReceiver() throws {
      let webView = RecordingWebView(frame: CGRect(x: 0, y: 0, width: 400, height: 800))
      let host = NativeIslandsHost(webView: webView, registry: registry())
      host.receive(pageMount())
      let island = try #require(host.manager?.islands["cta"])
      #expect(island.view.superview === webView.scrollView)
      #expect(island.view.frame == CGRect(x: 10, y: 20, width: 100, height: 44))
      let replies = try delivered(webView)
      #expect(replies.first?["event_name"] as? String == "native_component_ack")
      #expect(replies.first?["ids"] as? [String] == ["cta"])
    }

    @Test
    func acceptsBodiesAsJSONStrings() throws {
      let webView = RecordingWebView()
      let host = NativeIslandsHost(webView: webView, registry: registry())
      let data = try JSONSerialization.data(withJSONObject: pageMount())
      host.receive(try #require(String(bytes: data, encoding: .utf8)))
      #expect(host.manager?.islands["cta"] != nil)
    }

    @Test
    func clearsIslandsWhenANewDocumentStarts() {
      let webView = RecordingWebView()
      let host = NativeIslandsHost(webView: webView, registry: registry())
      host.receive(pageMount())
      webView.scripts.removeAll()
      host.receive(NativeIslandsHost.documentStartMarker)
      #expect(host.manager?.islands.isEmpty == true)
      #expect(webView.scripts.isEmpty)
    }

    @Test
    func clearsIslandsWhenTheProcessEnds() {
      let host = NativeIslandsHost(webView: RecordingWebView(), registry: registry())
      host.receive(pageMount())
      host.webContentProcessDidTerminate()
      #expect(host.manager?.islands.isEmpty == true)
    }

    @Test
    func dropsWhatItCannotRead() {
      let webView = RecordingWebView()
      let host = NativeIslandsHost(webView: webView, registry: registry())
      host.receive(["event_name": "something_else"])
      host.receive(42)
      #expect(webView.scripts.isEmpty)
    }

    @Test
    func asksForAResetAfterAnUnreadableBatch() throws {
      let webView = RecordingWebView()
      let host = NativeIslandsHost(webView: webView, registry: registry())
      host.receive(pageMount())
      webView.scripts.removeAll()
      host.receive(["event_name": "native_component_batch", "protocol": 1, "sequence": 2, "operations": "nope"])
      #expect(host.manager?.islands.isEmpty == true)
      #expect(try delivered(webView).map { $0["event_name"] as? String } == ["native_component_reset"])
    }

    @Test
    func refusesACommandForAnUnknownIsland() async throws {
      let webView = RecordingWebView()
      let host = NativeIslandsHost(webView: webView, registry: registry())
      host.receive([
        "event_name": "native_component_command",
        "id": "ghost",
        "request_id": "r1",
        "name": "focus"
      ])
      host.manager?.flush()
      let reply = try #require(try delivered(webView).first)
      #expect(reply["event_name"] as? String == "native_component_reply")
      #expect(reply["ok"] as? Bool == false)
    }

    @Test
    func routesResponsesToTheirRequest() async throws {
      let webView = RecordingWebView()
      let host = NativeIslandsHost(webView: webView, registry: registry())
      host.receive(pageMount())
      let manager = try #require(host.manager)
      async let answer = manager.request(from: "cta", name: "validate", payload: nil)
      await Task.yield()
      host.receive([
        "event_name": "native_component_response",
        "id": "cta",
        "request_id": "ios-1",
        "ok": true,
        "value": "fine"
      ])
      #expect(try await answer == .string("fine"))
    }

    @Test
    func detachingClearsAndStopsListening() {
      let webView = RecordingWebView()
      let host = NativeIslandsHost(webView: webView, registry: registry())
      host.receive(pageMount())
      host.detach()
      #expect(host.manager?.islands.isEmpty == true)
    }

    @Test
    func deliveryScriptIsNilWithNothingToSay() {
      #expect(NativeIslandsHost.deliveryScript([]) == nil)
      #expect(NativeIslandsHost.deliveryScript([.reset])?.hasPrefix("window.__nativeIslands && ") == true)
    }

    @Test
    func islandWebViewHandsTouchesOnIslandsToThem() throws {
      let webView = IslandWebView(frame: CGRect(x: 0, y: 0, width: 400, height: 800), registry: registry())
      let window = UIWindow(frame: webView.frame)
      window.addSubview(webView)
      window.isHidden = false
      let host = try #require(webView.islands)
      host.receive(pageMount())
      let island = try #require(host.manager?.islands["cta"])
      let hit = webView.hitTest(CGPoint(x: 30, y: 30), with: nil)
      #expect(hit?.isDescendant(of: island.view) == true)
      let away = webView.hitTest(CGPoint(x: 300, y: 600), with: nil)
      #expect(away?.isDescendant(of: island.view) != true)
    }
  }
}

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct RegistryTests {
    @Test
    func ignoresInvalidNamesAndVersions() {
      let registry = NativeComponentRegistry()
      registry.register("") { _ in Color.clear }
      registry.register(String(repeating: "a", count: NativeComponentLimits.maxComponentNameLength + 1)) { _ in Color.clear }
      registry.register("rating", version: 0) { _ in Color.clear }
      #expect(registry.registeredComponents.isEmpty)
      #expect(registry.capability == nil)
    }

    @Test
    func offersWhatIsRegistered() {
      let registry = NativeComponentRegistry()
      registry.register("rating", version: 2) { _ in Color.clear }
      #expect(registry.capability == NativeCapability(components: ["rating": 2]))
    }
  }
}
