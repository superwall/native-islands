import os
import WebKit

/// In DEBUG builds, lets the page ask where every native island is drawn:
///
/// ```js
/// const islands = await window.webkit.messageHandlers.nativeIslandsFrames.postMessage(null);
/// // [{ id, component, x, y, width, height, visible, acknowledged }, ...]
/// ```
///
/// Frames are in viewport CSS pixels, the space `getBoundingClientRect`
/// measures in, so a test page can compare each one with its
/// `[data-island-id]` element. Release builds don't install it.
@MainActor
final class NativeFrameReporter: NSObject, WKScriptMessageHandlerWithReply {
  static let name = "nativeIslandsFrames"

  weak var islands: NativeIslandManager?

  init(islands: NativeIslandManager) {
    self.islands = islands
  }

  static func install(in controller: WKUserContentController, islands: NativeIslandManager) {
    #if DEBUG
    controller.addScriptMessageHandler(
      NativeFrameReporter(islands: islands),
      contentWorld: .page,
      name: name
    )
    #endif
  }

  func report() -> [[String: Any]] {
    islands?.frames().map(\.json) ?? []
  }

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage,
    replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void
  ) {
    replyHandler(report(), nil)
  }
}

/// In DEBUG builds launched with `-NativeIslandsAlignmentLog YES`, logs every
/// island's native frame beside its web element's rect twice a second, as
/// `NATIVE-ISLANDS-ALIGN {json}` lines in the unified log, so a simulator run can be
/// checked with `log stream` without touching the page.
@MainActor
final class NativeAlignmentProbe {
  static let argument = "NativeIslandsAlignmentLog"
  static let tolerance: Double = 0.5
  static let log = os.Logger(subsystem: "com.superwall.native-islands", category: "alignment")

  /// Reads each `[data-island-id]` element's rect in viewport
  /// coordinates the way the page measures it: the union of its element
  /// children while it is `display: contents`, its own box once it takes the
  /// native view's size.
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
    let frames = islands.frames()
    webView.evaluateJavaScript(Self.domScript) { result, _ in
      MainActor.assumeIsolated {
        guard
          let json = result as? String,
          let data = json.data(using: .utf8),
          let dom = (try? JSONSerialization.jsonObject(with: data)) as? [String: [String: Any]]
        else { return }
        for line in Self.compare(frames: frames, dom: dom) {
          Self.log.notice("NATIVE-ISLANDS-ALIGN \(line, privacy: .public)")
        }
      }
    }
  }

  /// One JSON line per island: its native and DOM frames, the difference,
  /// and whether a shown island is off by more than half a point.
  static func compare(frames: [NativeIslandFrame], dom: [String: [String: Any]]) -> [String] {
    frames.compactMap { frame in
      let web = dom[frame.id]
      var entry: [String: Any] = frame.json
      if let web,
        let x = web["x"] as? Double,
        let y = web["y"] as? Double,
        let width = web["width"] as? Double,
        let height = web["height"] as? Double {
        let deltas = [
          Double(frame.frame.minX) - x,
          Double(frame.frame.minY) - y,
          Double(frame.frame.width) - width,
          Double(frame.frame.height) - height
        ]
        entry["dx"] = deltas[0]
        entry["dy"] = deltas[1]
        entry["dw"] = deltas[2]
        entry["dh"] = deltas[3]
        entry["misaligned"] = frame.visible && deltas.contains { abs($0) > tolerance }
        entry["scenario"] = web["scenario"] ?? NSNull()
        entry["expect"] = web["expect"] ?? NSNull()
        entry["shown"] = web["shown"] ?? false
        entry["handoff"] = web["handoff"] ?? NSNull()
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
