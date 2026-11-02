import Darwin
import NativeIslands
import QuartzCore
import UIKit
import WebKit

/// What the UI tests read, launched with `-UITestReport YES`: a tiny
/// invisible label whose accessibility label is a JSON summary of the page,
/// refreshed four times a second. With `-perf YES` it also runs the
/// performance measurements once the page is shown.
@MainActor
final class TestReport {
  static let identifier = "islands-report"

  /// Keeps the page's console warnings and errors in `window.__testWarnings`,
  /// so the report can say why an island shows its web version.
  static let consoleScript = WKUserScript(
    source: """
      window.__testWarnings = [];
      for (const level of ['warn', 'error']) {
        const original = console[level].bind(console);
        console[level] = (...args) => {
          window.__testWarnings.push(args.map(String).join(' ').slice(0, 200));
          original(...args);
        };
      }
      """,
    injectionTime: .atDocumentStart,
    forMainFrameOnly: true
  )

  static func isRequested(_ name: String, defaults: UserDefaults = .standard) -> Bool {
    defaults.bool(forKey: name)
  }

  private let label = UILabel(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
  private weak var webView: IslandWebView?
  private let started = CACurrentMediaTime()
  private let memoryAtStart = TestReport.footprint()
  private var readyMs: Double?
  private var readyReason: String?
  private var perf: [String: Any]?
  private var timer: Timer?

  init(in view: UIView, webView: IslandWebView, measuresPerformance: Bool) {
    self.webView = webView
    label.text = "."
    label.textColor = .clear
    label.accessibilityIdentifier = Self.identifier
    label.accessibilityLabel = "{}"
    view.addSubview(label)
    webView.islands?.onReady = { [weak self] reason in
      guard let self else { return }
      readyMs = (CACurrentMediaTime() - started) * 1000
      readyReason = reason == .ready ? "ready" : "timedOut"
      if measuresPerformance {
        Task { await self.measurePerformance() }
      }
    }
    timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
      MainActor.assumeIsolated {
        guard let self else { return }
        Task { await self.refresh() }
      }
    }
  }

  private func refresh() async {
    guard let islands = webView?.islands else { return }
    let measured = perf
    let alignments = await islands.alignment()
    let misaligned = alignments.filter { $0.isMisaligned() }.map { alignment -> [String: Any] in
      let deltas = alignment.deltas
      return [
        "id": alignment.id,
        "scenario": alignment.scenario ?? "",
        "deltaX": deltas[0], "deltaY": deltas[1], "deltaWidth": deltas[2], "deltaHeight": deltas[3]
      ]
    }
    let screen = webView?.bounds ?? .zero
    let waiting = alignments.filter { alignment in
      guard alignment.expect == "native", alignment.handoff == nil, let web = alignment.web else { return false }
      return !(alignment.visible && alignment.shown) && screen.contains(CGPoint(x: web.midX, y: web.midY))
    }
    let unmounted = await pageWaiting()
    var report: [String: Any] = [
      "ready": islands.isReady,
      "readyMs": readyMs ?? NSNull(),
      "readyReason": readyReason ?? NSNull(),
      "islands": alignments.count,
      "acknowledged": alignments.filter(\.acknowledged).count,
      "shown": alignments.filter { $0.visible && $0.shown }.count,
      "misaligned": misaligned,
      "waiting": waiting.map(\.id) + unmounted,
      "missing": alignments.filter { $0.web == nil }.map(\.id),
      "frames": Dictionary(
        uniqueKeysWithValues: alignments.filter { $0.visible && $0.shown }.map { alignment in
          (alignment.id, [alignment.frame.minX, alignment.frame.minY, alignment.frame.width, alignment.frame.height])
        }
      )
    ]
    if let measured {
      report["perf"] = measured
    }
    if let data = try? JSONSerialization.data(withJSONObject: report, options: [.sortedKeys]) {
      label.accessibilityLabel = String(data: data, encoding: .utf8)
    }
  }

  /// Wrappers on screen whose scenario expects native but that the page still
  /// shows as web with no hand-off reason, such as one never mounted: the host
  /// knows nothing of those, so its alignment alone cannot see them.
  private func pageWaiting() async -> [String] {
    let script = """
      const out = [];
      for (const el of document.querySelectorAll('[data-island-id]')) {
        const scenario = el.closest('[data-scenario]');
        if (!scenario || scenario.getAttribute('data-expect') !== 'native') continue;
        if (el.hasAttribute('data-island-shown') || el.hasAttribute('data-island-handoff')) continue;
        if (el.closest('[data-island-phase],[inert]')) continue;
        const box = [...el.children].map((c) => c.getBoundingClientRect()).find((r) => r.width > 0);
        if (!box) continue;
        const x = box.left + box.width / 2, y = box.top + box.height / 2;
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        if (out.length === 0) {
          out.push('warnings=' + JSON.stringify((window.__testWarnings || []).slice(-6)));
        }
        out.push(el.getAttribute('data-island-id') + ':' + (el.getAttribute('data-island-mode') || '?'));
      }
      return out;
      """
    let result = try? await webView?.callAsyncJavaScript(script, contentWorld: .page)
    return result as? [String] ?? []
  }

  /// Memory per island, the median frames dropped over three sweeps of the page, and the JS
  /// time a layout pass costs. Waits until every perf island is drawn, then half a second more so the views settle.
  private func measurePerformance() async {
    guard let webView else { return }
    let expected = UserDefaults.standard.integer(forKey: "count")
    var count = 0
    for _ in 0..<40 {
      try? await Task.sleep(nanoseconds: 250_000_000)
      count = await webView.islands?.alignment().filter { $0.id.hasPrefix("perf-") && $0.acknowledged }.count ?? 0
      if expected > 0 && count >= expected { break }
    }
    try? await Task.sleep(nanoseconds: 500_000_000)
    count = max(1, count)
    let memory = Double(Self.footprint() - memoryAtStart) / Double(count)
    var sweeps: [Int] = []
    for _ in 0..<3 {
      let counter = FrameCounter()
      counter.start()
      _ = try? await webView.callAsyncJavaScript("await window.__perf.sweep()", contentWorld: .page)
      sweeps.append(counter.stop())
    }
    let dropped = sweeps.sorted()[1]
    let layout = try? await webView.callAsyncJavaScript(
      "return await window.__perf.measureLayout()",
      contentWorld: .page
    )
    perf = [
      "islands": count,
      "mountToVisibleMs": readyMs ?? -1,
      "memoryPerIslandBytes": memory,
      "droppedFrames": dropped,
      "layoutMs": (layout as? Double) ?? -1
    ]
  }

  /// The app's physical memory footprint, as Xcode's memory gauge shows it.
  static func footprint() -> Int64 {
    var info = task_vm_info_data_t()
    var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size)
    let result = withUnsafeMutablePointer(to: &info) { pointer in
      pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
        task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
      }
    }
    return result == KERN_SUCCESS ? Int64(info.phys_footprint) : 0
  }
}

/// Counts the frames the display missed while it runs.
@MainActor
private final class FrameCounter: NSObject {
  private var link: CADisplayLink?
  private var last: CFTimeInterval?
  private var dropped = 0

  func start() {
    let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
    link.add(to: .main, forMode: .common)
    self.link = link
  }

  func stop() -> Int {
    link?.invalidate()
    link = nil
    return dropped
  }

  @objc private func tick(_ link: CADisplayLink) {
    let expected = link.targetTimestamp - link.timestamp
    if let last, expected > 0 {
      let missed = Int(((link.timestamp - last) / expected).rounded()) - 1
      dropped += max(0, missed)
    }
    last = link.timestamp
  }
}
