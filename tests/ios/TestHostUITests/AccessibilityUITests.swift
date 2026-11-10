import ObjectiveC
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

  /// The ready-made web versions read as their native controls do: a switch,
  /// a group of radios with one selected, and two adjustable values.
  func testReadyMadeControlsReadLikeTheirNativeControls() {
    let app = XCUIApplication.pages(route: "accessibility")
    app.waitUntilAligned()
    XCTAssertEqual(app.reachableOnce(.switch, labelled: "Reminders").value as? String, "0")
    app.reachableOnce(.other, labelled: "Plan")
    for segment in ["Weekly", "Annual", "Lifetime"] {
      let radio = app.reachableOnce(.other, labelled: segment)
      XCTAssertEqual(radio.value as? String, segment == "Annual" ? "1" : "0", segment)
    }
    XCTAssertEqual(app.reachableOnce(.slider, labelled: "Volume").value as? String, "40.00")
    XCTAssertEqual(app.reachableOnce(.slider, labelled: "Seats").value as? String, "3.00")
  }

  @MainActor
  func testADoubleTapTurnsAToggleOn() throws {
    let app = XCUIApplication.pages(route: "accessibility")
    app.waitUntilAligned()
    let toggle = app.switches["Reminders"]
    try toggle.perform(.activate)
    app.waitForPageState(#""reminders":true"#)
    XCTAssertEqual(toggle.value as? String, "1")
  }

  @MainActor
  func testADoubleTapSelectsASegment() throws {
    let app = XCUIApplication.pages(route: "accessibility")
    app.waitUntilAligned()
    try app.otherElements["Lifetime"].perform(.activate)
    app.waitForPageState(#""plan":"Lifetime""#)
    XCTAssertEqual(app.otherElements["Lifetime"].value as? String, "1")
    XCTAssertEqual(app.otherElements["Annual"].value as? String, "0")
  }

  @MainActor
  func testSwipingUpAndDownAdjustsASlider() throws {
    let app = XCUIApplication.pages(route: "accessibility")
    app.waitUntilAligned()
    let slider = app.sliders["Volume"]
    try slider.perform(.increment)
    app.waitForPageState(#""volume":50"#)
    XCTAssertEqual(slider.value as? String, "50.00")
    try slider.perform(.decrement)
    try slider.perform(.decrement)
    app.waitForPageState(#""volume":30"#)
  }

  @MainActor
  func testSwipingUpAndDownAdjustsAStepper() throws {
    let app = XCUIApplication.pages(route: "accessibility")
    app.waitUntilAligned()
    let stepper = app.sliders["Seats"]
    try stepper.perform(.increment)
    app.waitForPageState(#""seats":4"#)
    XCTAssertEqual(stepper.value as? String, "4.00")
    try stepper.perform(.decrement)
    try stepper.perform(.decrement)
    app.waitForPageState(#""seats":2"#)
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

/// The actions VoiceOver sends an element: a double-tap activates it, and a
/// swipe up or down on an adjustable one increments or decrements it.
enum VoiceOverAction: Int32 {
  case increment = 2004
  case decrement = 2005
  case activate = 2010
}

struct VoiceOverActionUnavailable: Error, CustomStringConvertible {
  let description = "This XCTest cannot send accessibility actions; update `perform(_:)` for it."
}

extension XCUIElement {
  /// Sends the element the accessibility action itself, as VoiceOver does,
  /// where `tap()` would send a touch to whatever is drawn at that point.
  ///
  /// XCTest has no public call for this, so it goes through the one its own
  /// `XCUIAccessibilityAction` uses. Where that is gone the test fails, so a
  /// new Xcode cannot quietly stop these tests from proving anything.
  @MainActor
  func perform(_ voiceOver: VoiceOverAction) throws {
    typealias Make = @convention(c) (AnyObject, Selector, Int32) -> AnyObject
    typealias Perform = @convention(c) (
      AnyObject, Selector, AnyObject, AnyObject, AnyObject?, UnsafeMutablePointer<NSError?>?
    ) -> Bool
    let make = NSSelectorFromString("initWithAXAction:")
    let perform = NSSelectorFromString("performAction:onElement:value:error:")
    guard
      let actions = NSClassFromString("XCUIAccessibilityAction") as? NSObject.Type,
      let makeAction = class_getMethodImplementation(actions, make),
      actions.instancesRespond(to: make),
      let client = XCUIDevice.shared.value(forKey: "accessibilityInterface") as? NSObject,
      client.responds(to: perform),
      let target = (try snapshot() as AnyObject).value(forKey: "accessibilityElement")
    else {
      throw VoiceOverActionUnavailable()
    }
    let allocated = actions.perform(NSSelectorFromString("alloc")).takeUnretainedValue()
    let action = unsafeBitCast(makeAction, to: Make.self)(allocated, make, voiceOver.rawValue)
    var error: NSError?
    let sent = unsafeBitCast(client.method(for: perform), to: Perform.self)(
      client, perform, action, target as AnyObject, nil, &error
    )
    XCTAssertTrue(sent, "VoiceOver's \(voiceOver) did not reach \(self): \(String(describing: error))")
  }
}

extension XCUIApplication {
  /// Waits until the accessibility page's echo of its React state holds `fragment`.
  func waitForPageState(_ fragment: String, file: StaticString = #filePath, line: UInt = #line) {
    let echo = staticTexts.matching(NSPredicate(format: "label CONTAINS %@", fragment)).firstMatch
    XCTAssertTrue(
      echo.waitForExistence(timeout: 5),
      "The page never reached \(fragment).\n\(debugDescription)",
      file: file,
      line: line
    )
  }
}
