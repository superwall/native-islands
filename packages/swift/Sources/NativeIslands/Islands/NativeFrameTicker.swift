import QuartzCore

/// Runs work on the next display frame, at a fixed rate so a number of
/// frames is a fixed amount of time on every screen.
@MainActor
final class NativeFrameTicker {
  static let shared = NativeFrameTicker()
  static let framesPerSecond = 60

  private var link: CADisplayLink?
  private var pending: [@MainActor () -> Void] = []

  var isRunning: Bool {
    link != nil
  }

  func next(_ work: @escaping @MainActor () -> Void) {
    pending.append(work)
    guard link == nil else { return }
    let link = CADisplayLink(target: Target(self), selector: #selector(Target.tick))
    let rate = Float(Self.framesPerSecond)
    link.preferredFrameRateRange = CAFrameRateRange(minimum: rate, maximum: rate, preferred: rate)
    link.add(to: .main, forMode: .common)
    self.link = link
  }

  func tick() {
    let work = pending
    pending.removeAll()
    work.forEach { $0() }
    if pending.isEmpty {
      link?.invalidate()
      link = nil
    }
  }

  // CADisplayLink keeps its target alive until it is invalidated.
  private final class Target: NSObject {
    weak var ticker: NativeFrameTicker?

    init(_ ticker: NativeFrameTicker) {
      self.ticker = ticker
    }

    @objc func tick() {
      MainActor.assumeIsolated { ticker?.tick() }
    }
  }
}
