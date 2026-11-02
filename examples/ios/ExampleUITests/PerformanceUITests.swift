import UIKit
import XCTest

/// Opens the performance page with 10, 50 and 100 islands and records how
/// long the first frame takes to show, the memory each island costs, the
/// frames dropped while the page sweeps through its scroll, and the JS time a
/// layout pass costs. Writes them to `PERF_OUTPUT` as JSON, which
/// `performance/check.ts` compares with `performance/baseline.json`.
final class PerformanceUITests: XCTestCase {
  static let counts = [10, 50, 100]

  override func setUp() {
    continueAfterFailure = false
  }

  func testIslandCounts() throws {
    var runs: [[String: Any]] = []
    for count in Self.counts {
      let app = XCUIApplication.pages(route: "perf", arguments: ["-count", "\(count)", "-perf", "YES"])
      let report = app.waitForReport(timeout: 60) { $0.perf != nil }
      let perf = try XCTUnwrap(report?.perf, "No measurements for \(count) islands")
      XCTAssertEqual(perf.islands, count, "The page drew \(perf.islands) islands, not \(count)")
      XCTAssertEqual(
        report?.readyReason,
        "ready",
        "With \(count) islands the host showed the page on its timeout, not when the page announced ready"
      )
      // The report that carries the measurements can be taken mid-scroll, so
      // alignment is checked once the sweep has settled.
      app.waitUntilAligned()
      runs.append([
        "islands": count,
        "mountToVisibleMs": perf.mountToVisibleMs,
        "memoryPerIslandBytes": perf.memoryPerIslandBytes,
        "droppedFrames": perf.droppedFrames,
        "layoutMs": perf.layoutMs
      ])
      app.terminate()
    }
    let result: [String: Any] = [
      "device": ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] ?? UIDevice.current.model,
      "runs": runs
    ]
    let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
    let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
    attachment.name = "performance"
    attachment.lifetime = .keepAlways
    add(attachment)
    if let output = ProcessInfo.processInfo.environment["PERF_OUTPUT"], !output.isEmpty {
      try data.write(to: URL(fileURLWithPath: output))
    }
  }
}
