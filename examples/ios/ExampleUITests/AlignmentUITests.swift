import XCTest

/// Opens every page of the gallery on its own and checks each island that
/// is drawn sits within half a point of its web element.
final class AlignmentUITests: XCTestCase {
  override func setUp() {
    continueAfterFailure = false
  }

  func testIndex() { check("index") }
  func testButtons() { check("buttons") }
  func testControls() { check("controls") }
  func testScrolling() { check("scrolling") }
  func testMotion() { check("motion") }
  func testOverlays() { check("overlays") }
  /// The stress page mounts and unmounts islands on a timer, so it is checked
  /// on one clean report rather than three in a row.
  func testStress() { check("stress", allowingMissing: true, streak: 1) }
  func testState() { check("state") }
  func testFlow() { check("flow-plans") }
  func testOnboarding() { check("onboarding") }
  func testPlayer() { check("app-player") }
  func testPaywall() { check("app-paywall") }
  func testSettings() { check("app-settings") }
  func testMap() { check("app-map") }

  func testScrollingStaysAlignedAfterScrolling() {
    let app = XCUIApplication.pages(route: "scrolling")
    app.waitUntilAligned()
    XCTExpectFailure(
      "After a fast fling, the buttons in the carousel nested inside a list (S19) can sit about 0.52 pt "
        + "above their web elements. See the README's known issues.",
      options: .nonStrict()
    ) {
      for _ in 0..<2 {
        app.swipeUp(velocity: .fast)
        app.waitUntilAligned()
      }
      app.swipeDown(velocity: .fast)
      app.waitUntilAligned()
    }
  }

  func testPagesPushAndPopWithTheirIslandsAligned() {
    let app = XCUIApplication.pages(route: "flow-plans")
    app.waitUntilAligned()
    app.tapIsland("flow-next-details")
    app.waitForReport { $0.isOnScreen("flow-next-done", width: app.frame.width) }
    app.waitUntilAligned()
    app.tapIsland("flow-next-done")
    app.waitForReport { $0.isOnScreen("flow-done", width: app.frame.width) }
    app.waitUntilAligned()
    app.tapIsland("chrome-back")
    app.waitForReport { $0.isOnScreen("flow-next-done", width: app.frame.width) }
    app.waitUntilAligned()
  }

  private func check(
    _ route: String,
    allowingMissing: Bool = false,
    streak: Int = 3,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let app = XCUIApplication.pages(route: route)
    app.waitUntilAligned(allowingMissing: allowingMissing, streak: streak, file: file, line: line)
  }
}
