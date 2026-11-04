import os
import WebKit

@MainActor
final class NativeFrameReporter: NSObject, WKScriptMessageHandlerWithReply {
  static let name = "nativeIslandsFrames"

  private let islands: @MainActor (WKWebView?) -> NativeIslandManager?

  init(islands: @escaping @MainActor (WKWebView?) -> NativeIslandManager?) {
    self.islands = islands
  }

  convenience init(islands: NativeIslandManager) {
    self.init { [weak islands] _ in islands }
  }

  func report(for webView: WKWebView? = nil) -> [[String: Any]] {
    islands(webView)?.frames().map(\.json) ?? []
  }

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage,
    replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void
  ) {
    replyHandler(report(for: message.webView), nil)
  }
}

@MainActor
final class NativeAlignmentProbe {
  static let argument = "NativeIslandsAlignmentLog"
  static let tolerance: Double = 0.5
  static let log = os.Logger(subsystem: "com.superwall.native-islands", category: "alignment")

  static let domScript = """
    (() => {
      const out = {};
      for (const wrapper of document.querySelectorAll('[data-island-id]')) {
        const own = getComputedStyle(wrapper).display !== 'contents';
        const boxes = (own ? [wrapper] : [...wrapper.children])
          .map((c) => c.getBoundingClientRect())
          .filter((r) => r.width > 0 || r.height > 0);
        if (!boxes.length) continue;
        const left = Math.min(...boxes.map((r) => r.left));
        const top = Math.min(...boxes.map((r) => r.top));
        const right = Math.max(...boxes.map((r) => r.right));
        const bottom = Math.max(...boxes.map((r) => r.bottom));
        const scenario = wrapper.closest('[data-scenario]');
        out[wrapper.dataset.islandId] = {
          x: left, y: top, width: right - left, height: bottom - top,
          shown: wrapper.hasAttribute('data-island-shown'),
          handoff: wrapper.dataset.islandHandoff ?? null,
          scenario: scenario ? scenario.dataset.scenario : null,
          expect: scenario ? scenario.dataset.expect : null
        };
      }
      return JSON.stringify(out);
    })()
    """

  private weak var webView: WKWebView?
  private weak var islands: NativeIslandManager?
  private var timer: Timer?

  init(webView: WKWebView, islands: NativeIslandManager) {
    self.webView = webView
    self.islands = islands
  }

  static func isRequested(_ arguments: [String] = ProcessInfo.processInfo.arguments) -> Bool {
    guard let index = arguments.firstIndex(of: "-\(argument)") else { return false }
    let value = arguments.indices.contains(index + 1) ? arguments[index + 1] : "YES"
    return ["YES", "1", "true"].contains(value)
  }

  func start() {
    timer?.invalidate()
    timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
      MainActor.assumeIsolated { self?.sample() }
    }
  }

  func stop() {
    timer?.invalidate()
    timer = nil
  }

  private func sample() {
    guard let webView, let islands, !islands.islands.isEmpty else { return }
    Self.measure(webView: webView, islands: islands) { alignments in
      for line in Self.lines(alignments) {
        Self.log.notice("NATIVE-ISLANDS-ALIGN \(line, privacy: .public)")
      }
    }
  }

  static func measure(
    webView: WKWebView,
    islands: NativeIslandManager,
    completion: @escaping @MainActor ([NativeIslandAlignment]) -> Void
  ) {
    let frames = islands.frames()
    webView.evaluateJavaScript(domScript) { result, _ in
      MainActor.assumeIsolated {
        guard
          let json = result as? String,
          let data = json.data(using: .utf8),
          let dom = (try? JSONSerialization.jsonObject(with: data)) as? [String: [String: Any]]
        else {
          completion(NativeIslandAlignment.compare(frames: frames, dom: [:]))
          return
        }
        completion(NativeIslandAlignment.compare(frames: frames, dom: dom))
      }
    }
  }

  static func compare(frames: [NativeIslandFrame], dom: [String: [String: Any]]) -> [String] {
    lines(NativeIslandAlignment.compare(frames: frames, dom: dom))
  }

  static func lines(_ alignments: [NativeIslandAlignment]) -> [String] {
    alignments.compactMap { alignment in
      var entry: [String: Any] = [
        "id": alignment.id,
        "component": alignment.component,
        "x": Double(alignment.frame.minX),
        "y": Double(alignment.frame.minY),
        "width": Double(alignment.frame.width),
        "height": Double(alignment.frame.height),
        "visible": alignment.visible,
        "acknowledged": alignment.acknowledged
      ]
      let deltas = alignment.deltas
      if deltas.count == 4 {
        entry["dx"] = deltas[0]
        entry["dy"] = deltas[1]
        entry["dw"] = deltas[2]
        entry["dh"] = deltas[3]
        entry["misaligned"] = alignment.isMisaligned(tolerance: tolerance)
        entry["scenario"] = alignment.scenario ?? NSNull()
        entry["expect"] = alignment.expect ?? NSNull()
        entry["shown"] = alignment.shown
        entry["handoff"] = alignment.handoff ?? NSNull()
      } else {
        entry["missing"] = true
      }
      guard let data = try? JSONSerialization.data(withJSONObject: entry, options: [.sortedKeys]) else {
        return nil
      }
      return String(data: data, encoding: .utf8)
    }
  }
}

struct NativeIslandFrame: Equatable {
  let id: String
  let component: String
  let frame: CGRect
  let visible: Bool
  let acknowledged: Bool

  var json: [String: Any] {
    [
      "id": id,
      "component": component,
      "x": Double(frame.origin.x),
      "y": Double(frame.origin.y),
      "width": Double(frame.width),
      "height": Double(frame.height),
      "visible": visible,
      "acknowledged": acknowledged
    ]
  }
}
