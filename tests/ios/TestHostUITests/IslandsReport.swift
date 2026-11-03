import XCTest

/// The JSON summary the example app exposes when launched with `-UITestReport YES`.
struct IslandsReport: Decodable {
  struct Misaligned: Decodable, CustomStringConvertible {
    let id: String
    let scenario: String
    let deltaX: Double
    let deltaY: Double
    let deltaWidth: Double
    let deltaHeight: Double

    var description: String {
      "\(id) (\(scenario)) x \(deltaX) y \(deltaY) width \(deltaWidth) height \(deltaHeight)"
    }
  }

  struct Perf: Decodable {
    let islands: Int
    let mountToVisibleMs: Double
    let memoryPerIslandBytes: Double
    let droppedFrames: Int
    let layoutMs: Double
  }

  let ready: Bool
  let readyMs: Double?
  /// `ready` when the page announced its islands, `timedOut` when the host gave up waiting.
  let readyReason: String?
  let islands: Int
  let acknowledged: Int
  let shown: Int
  let misaligned: [Misaligned]
  let missing: [String]
  /// Islands on screen whose scenario expects native but that still show their web version.
  let waiting: [String]
  /// Each shown island's frame as `[x, y, width, height]`, in points.
  let frames: [String: [Double]]
  let perf: Perf?

  /// Whether island `id` is shown and its frame starts on screen, so its page is the one on top.
  func isOnScreen(_ id: String, width: CGFloat) -> Bool {
    guard let frame = frames[id], frame.count == 4 else { return false }
    return frame[0] >= 0 && frame[0] < Double(width)
  }
}

extension XCUIApplication {
  /// Launches the example app on `route`, reporting to the tests.
  static func pages(route: String, arguments: [String] = []) -> XCUIApplication {
    let app = XCUIApplication()
    app.launchArguments = ["-UITestReport", "YES", "-route", route] + arguments
    app.launch()
    return app
  }

  var report: IslandsReport? {
    let element = staticTexts["islands-report"]
    guard element.exists else { return nil }
    return try? JSONDecoder().decode(IslandsReport.self, from: Data(element.label.utf8))
  }

  /// Waits until `condition` holds for the report, or fails after `timeout`.
  @discardableResult
  func waitForReport(
    timeout: TimeInterval = 20,
    file: StaticString = #filePath,
    line: UInt = #line,
    _ condition: (IslandsReport) -> Bool
  ) -> IslandsReport? {
    let deadline = Date().addingTimeInterval(timeout)
    var last: IslandsReport?
    while Date() < deadline {
      if let report {
        last = report
        if condition(report) { return report }
      }
      RunLoop.current.run(until: Date().addingTimeInterval(0.25))
    }
    XCTFail(
      "The page never reached the expected state. Last report: \(String(describing: last))",
      file: file,
      line: line
    )
    return last
  }

  /// Taps the native island `id` at its centre, once it is shown.
  func tapIsland(_ id: String, file: StaticString = #filePath, line: UInt = #line) {
    guard
      let frame = waitForReport(file: file, line: line, { $0.frames[id] != nil })?.frames[id],
      frame.count == 4
    else { return }
    coordinate(withNormalizedOffset: .zero)
      .withOffset(CGVector(dx: frame[0] + frame[2] / 2, dy: frame[1] + frame[3] / 2))
      .tap()
  }

  /// Waits until the page is shown and every drawn island has sat on its
  /// web element for `streak` reports in a row.
  @discardableResult
  func waitUntilAligned(
    timeout: TimeInterval = 45,
    allowingMissing: Bool = false,
    streak required: Int = 3,
    file: StaticString = #filePath,
    line: UInt = #line
  ) -> IslandsReport? {
    var streak = 0
    let report = waitForReport(timeout: timeout, file: file, line: line) { report in
      let settled = report.ready && report.islands > 0 && report.shown > 0 && report.misaligned.isEmpty
        && report.waiting.isEmpty && (allowingMissing || report.missing.isEmpty)
      streak = settled ? streak + 1 : 0
      return streak >= required
    }
    if let report, !report.misaligned.isEmpty {
      XCTFail("Islands off their web elements by more than 0.5 pt: \(report.misaligned)", file: file, line: line)
    }
    if let report, !allowingMissing, !report.missing.isEmpty {
      XCTFail("Islands with no web element: \(report.missing)", file: file, line: line)
    }
    return report
  }
}
