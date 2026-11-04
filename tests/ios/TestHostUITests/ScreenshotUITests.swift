import CoreGraphics
import UIKit
import XCTest

/// Compares each still page, once its islands are drawn, with a recorded
/// screenshot. Baselines live in `BASELINES_DIR/iOS-<major>/<device>/<page>.png`; run with
/// `RECORD_BASELINES=1` to write them. Moving pages (motion, stress) are left out.
final class ScreenshotUITests: XCTestCase {
  /// A pixel differs when any channel moves by more than this, out of 255.
  static let channelTolerance = 24
  /// The share of differing pixels a page may have before it fails.
  static let allowedShare = 0.002
  /// The strip at the bottom left out of the comparison, in points: the
  /// home indicator UIKit lightens or darkens over the page between runs.
  static let homeIndicatorStrip: CGFloat = 21

  override func setUp() {
    continueAfterFailure = false
  }

  func testIndex() throws { try compare("index") }
  func testButtons() throws { try compare("buttons") }
  func testControls() throws { try compare("controls") }
  func testScrolling() throws { try compare("scrolling") }
  func testOverlays() throws { try compare("overlays") }
  func testState() throws { try compare("state") }
  func testFlow() throws { try compare("flow-plans") }

  private func compare(_ route: String) throws {
    let environment = ProcessInfo.processInfo.environment
    guard let root = environment["BASELINES_DIR"], !root.isEmpty else {
      throw XCTSkip("Set BASELINES_DIR (scripts/ui-tests.sh does) to compare screenshots.")
    }
    let app = XCUIApplication.pages(route: route, arguments: ["-AppleInterfaceStyle", "Light"])
    app.waitUntilAligned()
    let screenshot = Self.settledScreenshot()
    let directory = URL(fileURLWithPath: root).appendingPathComponent(Self.deviceFolder)
    let baseline = directory.appendingPathComponent("\(route).png")
    attach(screenshot.pngRepresentation, named: "\(route) actual")
    if environment["RECORD_BASELINES"] == "1" {
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      try screenshot.pngRepresentation.write(to: baseline)
      return
    }
    guard let expected = try? Data(contentsOf: baseline) else {
      XCTFail("No baseline at \(baseline.path). Record one with scripts/ui-tests.sh --record.")
      return
    }
    let result = try XCTUnwrap(
      ImageDiff.compare(
        screenshot.pngRepresentation,
        expected,
        channelTolerance: Self.channelTolerance,
        ignoringBottom: Self.homeIndicatorStrip * screenshot.image.scale
      )
    )
    if result.share > Self.allowedShare {
      attach(expected, named: "\(route) baseline")
      if let output = environment["OUTPUT_DIR"], !output.isEmpty {
        let failures = URL(fileURLWithPath: output).appendingPathComponent(Self.deviceFolder)
        try? FileManager.default.createDirectory(at: failures, withIntermediateDirectories: true)
        try? screenshot.pngRepresentation.write(to: failures.appendingPathComponent("\(route)-actual.png"))
      }
      XCTFail(
        "\(route) differs from its baseline in \(result.differing) pixels "
          + "(\(result.share * 100)% of \(result.total))."
      )
    }
  }

  /// A screenshot once two taken half a second apart match, so glass that
  /// is still fading in its edge is not compared halfway; the last one after
  /// `timeout` otherwise.
  static func settledScreenshot(timeout: TimeInterval = 6) -> XCUIScreenshot {
    let deadline = Date().addingTimeInterval(timeout)
    RunLoop.current.run(until: Date().addingTimeInterval(0.5))
    var last = XCUIScreen.main.screenshot()
    while Date() < deadline {
      RunLoop.current.run(until: Date().addingTimeInterval(0.5))
      let next = XCUIScreen.main.screenshot()
      let change = ImageDiff.compare(
        next.pngRepresentation,
        last.pngRepresentation,
        channelTolerance: channelTolerance,
        ignoringBottom: homeIndicatorStrip * next.image.scale
      )
      last = next
      if let change, change.differing == 0 { break }
    }
    return last
  }

  private func attach(_ png: Data, named name: String) {
    let attachment = XCTAttachment(data: png, uniformTypeIdentifier: "public.png")
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  /// One folder per iOS major release, then per simulator model and screen
  /// size, since each draws its controls and glass differently.
  static var deviceFolder: String {
    let size = XCUIScreen.main.screenshot().image.size
    let model = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] ?? UIDevice.current.model
    return "\(osFolder(UIDevice.current.systemVersion))/\(model)-\(Int(size.width))x\(Int(size.height))"
  }

  /// `iOS-18` for `18.6`; a version with no number is filed as `iOS-unknown`.
  static func osFolder(_ version: String) -> String {
    let major = version.split(separator: ".").first.flatMap { Int($0) }
    return "iOS-\(major.map(String.init) ?? "unknown")"
  }
}

/// Counts the pixels two PNGs of the same size differ in.
enum ImageDiff {
  struct Result {
    let differing: Int
    let total: Int
    var share: Double { total == 0 ? 1 : Double(differing) / Double(total) }
  }

  /// Leaves out the bottom `ignoringBottom` rows of pixels.
  static func compare(_ first: Data, _ second: Data, channelTolerance: Int, ignoringBottom: CGFloat = 0) -> Result? {
    guard let one = pixels(first), let two = pixels(second) else { return nil }
    guard one.width == two.width, one.height == two.height else {
      return Result(differing: max(one.width * one.height, 1), total: max(one.width * one.height, 1))
    }
    let rows = max(0, one.height - Int(ignoringBottom.rounded(.up)))
    var differing = 0
    for index in stride(from: 0, to: rows * one.width * 4, by: 4) {
      for channel in 0..<3
      where abs(Int(one.bytes[index + channel]) - Int(two.bytes[index + channel])) > channelTolerance {
        differing += 1
        break
      }
    }
    return Result(differing: differing, total: max(rows * one.width, 1))
  }

  struct Bitmap {
    let bytes: [UInt8]
    let width: Int
    let height: Int
  }

  private static func pixels(_ png: Data) -> Bitmap? {
    guard let image = UIImage(data: png)?.cgImage else { return nil }
    let width = image.width
    let height = image.height
    var bytes = [UInt8](repeating: 0, count: width * height * 4)
    let drawn = bytes.withUnsafeMutableBytes { buffer -> Bool in
      guard let context = CGContext(
        data: buffer.baseAddress,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
      ) else { return false }
      context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    return drawn ? Bitmap(bytes: bytes, width: width, height: height) : nil
  }
}
