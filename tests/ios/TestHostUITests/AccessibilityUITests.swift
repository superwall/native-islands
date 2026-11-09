import XCTest

/// Checks what VoiceOver can reach: every island once, whether it sits in the
/// page's scroll, an inner scroll view or the fixed screen layer.
///
/// Islands in the page and in inner scroll views are read through their web
/// version, which stays in the accessibility tree behind the native view; the
/// host hides those native views so nothing is read twice. Islands in the
/// screen layer are read from the native view.
final class AccessibilityUITests: XCTestCase {
  override func setUp() {
    continueAfterFailure = false
  }

  func testIslandsInAnInnerScrollViewAreReachableOnce() {
    let app = XCUIApplication.pages(route: "scrolling")
    app.waitUntilAligned()
    for row in ["Unlimited projects", "Offline mode", "Family sharing", "Priority support"] {
      let toggle = app.reachableOnce(.switch, labelled: row)
      XCTAssertEqual(toggle.value as? String, row == "Offline mode" ? "1" : "0", row)
    }
  }

  func testIslandsInThePageScrollAreReachableOnce() {
    let app = XCUIApplication.pages(route: "scrolling")
    app.waitUntilAligned()
    app.reachableOnce(.button, labelled: "Scroll me with the page")
    app.reachableOnce(.button, labelled: "Anchored to the page scroll")
  }

  func testIslandsInTheScreenLayerAreReachableOnce() {
    let app = XCUIApplication.pages(route: "scrolling")
    app.waitUntilAligned()
    app.reachableOnce(.button, labelled: "Sticky footer")
  }

  /// The gallery's web version draws each segment as a pressed or unpressed
  /// button, which VoiceOver reads as a toggle with the selected one on.
  func testEachSegmentIsReachableOnItsOwn() {
    let app = XCUIApplication.pages(route: "controls")
    app.waitUntilAligned()
    for segment in ["Weekly", "Annual", "Lifetime"] {
      let button = app.reachableOnce(.switch, labelled: segment)
      XCTAssertEqual(button.value as? String, segment == "Annual" ? "1" : "0", segment)
    }
    app.reachableOnce(.switch, labelled: "Bill annually")
  }
}

extension XCUIApplication {
  /// Fails unless exactly one accessibility element of `type` reads `label`.
  @discardableResult
  func reachableOnce(
    _ type: XCUIElement.ElementType,
    labelled label: String,
    file: StaticString = #filePath,
    line: UInt = #line
  ) -> XCUIElement {
    let matches = descendants(matching: type).matching(NSPredicate(format: "label == %@", label))
    XCTAssertEqual(
      matches.count,
      1,
      "VoiceOver should reach \"\(label)\" exactly once.\n\(debugDescription)",
      file: file,
      line: line
    )
    return matches.firstMatch
  }
}
