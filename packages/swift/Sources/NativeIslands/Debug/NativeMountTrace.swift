import os
import QuartzCore
import UIKit

/// Times how each batch's mounts reach the screen, for `-NativeIslandsMountTrace YES`.
@MainActor
final class NativeMountTrace {
  static let argument = "NativeIslandsMountTrace"
  nonisolated static let log = os.Logger(subsystem: "com.superwall.native-islands", category: "mounts")

  enum Outcome: String {
    case tookOver = "took over"
    case parked
    case mounted
    case failed
  }

  /// How a scroller's island found the scroll view it is drawn in.
  enum Choice: String {
    /// A mount: a matching scroll view near the scroller's spot.
    case nearby = "near its spot"
    /// A mount: the scroll view the scroller's other islands live in.
    case known = "beside its scroller's islands"
    /// A mount: the nearest matching scroll view at any distance.
    case anywhere = "anywhere"
    /// An update gave the island a new scroller, matched at any distance.
    case moved = "moved to a new scroller"
    /// Followed its scroller while its scroll view was on screen.
    case followedNearby = "followed, near its spot"
    /// Followed its scroller after its scroll view left the viewport.
    case followedAnywhere = "followed, anywhere"
  }

  private let now: () -> CFTimeInterval
  private let write: (String) -> Void
  private let onCommit: (@escaping () -> Void) -> Void
  private var start: CFTimeInterval = 0
  private var outcomes: [Outcome: Int] = [:]
  private var mountTime: CFTimeInterval = 0
  private var parkedAt: [String: CFTimeInterval] = [:]

  init(
    now: @escaping () -> CFTimeInterval = CACurrentMediaTime,
    write: @escaping (String) -> Void = { NativeMountTrace.log.info("\($0, privacy: .public)") },
    onCommit: @escaping (@escaping () -> Void) -> Void = { work in
      CATransaction.setCompletionBlock(work)
    }
  ) {
    self.now = now
    self.write = write
    self.onCommit = onCommit
  }

  static func isRequested(_ arguments: [String] = ProcessInfo.processInfo.arguments) -> Bool {
    guard let index = arguments.firstIndex(of: "-\(argument)") else { return false }
    let value = arguments.indices.contains(index + 1) ? arguments[index + 1] : "YES"
    return ["YES", "1", "true"].contains(value)
  }

  func begin() {
    start = now()
    outcomes = [:]
    mountTime = 0
  }

  func record(_ outcome: Outcome, id: String, since mountStart: CFTimeInterval? = nil) {
    outcomes[outcome, default: 0] += 1
    if let mountStart {
      mountTime += now() - mountStart
    }
    if outcome == .parked {
      parkedAt[id] = now()
    }
  }

  func timestamp() -> CFTimeInterval {
    now()
  }

  func finish(sequence: Int) {
    guard !outcomes.isEmpty else { return }
    let counts = [Outcome.tookOver, .parked, .mounted, .failed]
      .compactMap { outcome in outcomes[outcome].map { "\($0) \(outcome.rawValue)" } }
      .joined(separator: ", ")
    let start = start
    let applied = now() - start
    let building = mountTime
    onCommit { [weak self] in
      guard let self else { return }
      let committed = now() - start
      write(
        "batch \(sequence): \(counts); building \(Self.ms(building)), applied \(Self.ms(applied)), "
          + "committed \(Self.ms(committed))"
      )
    }
  }

  func unparked(_ id: String, attempts: Int, found: Bool) {
    guard let parkedAt = parkedAt.removeValue(forKey: id) else { return }
    let waited = now() - parkedAt
    let how = found ? "found its scroll view" : "gave up waiting"
    write("parked \(id): \(how) after \(attempts) checks, \(Self.ms(waited))")
  }

  /// One line per scroller container choice: the scroller as the page
  /// measured it, and the scroll view chosen for it, in the viewport.
  func chose(_ choice: Choice?, id: String, for scroller: NativeScroller, container: UIView?, in viewport: UIView) {
    let frame = scroller.frame
    let wanted = "scroller \(scroller.id) at \(Self.rect(frame.x, frame.y, frame.width, frame.height)) "
      + "content \(Self.size(scroller.contentSize.width, scroller.contentSize.height))"
    guard let choice, let container else {
      write("container \(id): no scroll view for \(wanted)")
      return
    }
    let found = container.convert(container.bounds, to: viewport)
    let distance = hypot(found.minX - CGFloat(frame.x), found.minY - CGFloat(frame.y))
    var line = "container \(id) \(choice.rawValue): \(wanted); chose "
      + Self.rect(Double(found.minX), Double(found.minY), Double(found.width), Double(found.height))
    if let scrollView = container as? UIScrollView {
      line += " content " + Self.size(Double(scrollView.contentSize.width), Double(scrollView.contentSize.height))
    }
    line += String(format: ", %.0f pt away", distance)
    write(line)
  }

  private static func rect(_ x: Double, _ y: Double, _ width: Double, _ height: Double) -> String {
    String(format: "(%.0f, %.0f, %.0f×%.0f)", x, y, width, height)
  }

  private static func size(_ width: Double, _ height: Double) -> String {
    String(format: "%.0f×%.0f", width, height)
  }

  static func ms(_ seconds: CFTimeInterval) -> String {
    String(format: "%.1f ms", seconds * 1000)
  }
}
