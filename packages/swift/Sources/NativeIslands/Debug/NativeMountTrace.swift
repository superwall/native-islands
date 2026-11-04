import os
import QuartzCore

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

  static func ms(_ seconds: CFTimeInterval) -> String {
    String(format: "%.1f ms", seconds * 1000)
  }
}
