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

  private let islands: @MainActor (WKWebView?) -> NativeIslandManager?

  /// Reports the islands of the web view each message comes from.
  init(islands: @escaping @MainActor (WKWebView?) -> NativeIslandManager?) {
    self.islands = islands
  }

  /// Reports `islands`, whichever web view asks.
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
    Self.measure(webView: webView, islands: islands) { alignments in
      for line in Self.lines(alignments) {
        Self.log.notice("NATIVE-ISLANDS-ALIGN \(line, privacy: .public)")
      }
    }
  }

  /// Reads the page's element rects and pairs them with the native frames
  /// taken at the same moment.
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

  /// One JSON line per island: its native and DOM frames, the difference,
  /// and whether a shown island is off by more than half a point.
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
