import QuartzCore
import UIKit

/// The slide a native island runs, and what it has hidden of it.
struct NativeIslandSlide {
  var motion: NativeMotion?
  /// Whatever slides over the island hides it now.
  var coverHidden = false
  var timers: [DispatchWorkItem] = []
}

extension NativeIsland {
  static let motionKey = "nativeIslands.motion"
  static let coverSamples = 120

  /// Runs the slide the page sent on the view, from as far in as the page
  /// measured it, so it moves in step with the page WebKit slides. A slide
  /// sent again from a later measurement keeps running as it is.
  func applyMotion() {
    if let motion, motion.isSameSlide(as: sliding.motion) { return }
    stopMotion()
    guard let motion else { return }
    sliding.motion = motion
    glassView?.isSliding = true
    let layers = [view.layer] + (shadeHost.map { [$0.layer] } ?? [])
    for layer in layers {
      let now = layer.convertTime(CACurrentMediaTime(), from: nil)
      layer.add(Self.slide(motion, beginTime: now - motion.elapsed / 1000), forKey: Self.motionKey)
    }
    guard let cover = motion.cover else { return }
    // The page coming in over this one is web content, so the view hides
    // while it covers it, as glass ignores an animated mask or opacity. A
    // control is crossed by the cover's edge within a frame or two.
    let elapsed = motion.elapsed / 1000
    let changes = Self.coverChanges(motion, cover: cover, in: view.bounds)
    setCoverHidden(changes.last { $0.time <= elapsed }?.covered ?? false)
    for change in changes where change.time > elapsed {
      let timer = DispatchWorkItem { [weak self] in
        MainActor.assumeIsolated { self?.setCoverHidden(change.covered) }
      }
      sliding.timers.append(timer)
      DispatchQueue.main.asyncAfter(deadline: .now() + (change.time - elapsed), execute: timer)
    }
  }

  func setCoverHidden(_ hidden: Bool) {
    guard sliding.coverHidden != hidden else { return }
    sliding.coverHidden = hidden
    UIView.performWithoutAnimation { applyShape() }
  }

  func stopMotion() {
    guard sliding.motion != nil else { return }
    for layer in [view.layer] + (shadeHost.map { [$0.layer] } ?? []) {
      layer.removeAnimation(forKey: Self.motionKey)
    }
    sliding.timers.forEach { $0.cancel() }
    sliding.timers = []
    sliding.motion = nil
    glassView?.isSliding = false
    setCoverHidden(false)
  }

  static func slide(_ motion: NativeMotion, beginTime: CFTimeInterval) -> CAKeyframeAnimation {
    let animation = CAKeyframeAnimation(keyPath: "position")
    animation.isAdditive = true
    animation.values = motion.keyframes.map { NSValue(cgPoint: CGPoint(x: $0.x, y: $0.y)) }
    time(animation, motion, beginTime: beginTime)
    return animation
  }

  static func time(_ animation: CAKeyframeAnimation, _ motion: NativeMotion, beginTime: CFTimeInterval) {
    animation.keyTimes = motion.keyframes.map { NSNumber(value: $0.offset) }
    animation.timingFunctions = motion.easings?.map { easing in
      CAMediaTimingFunction(
        controlPoints: Float(easing[0]),
        Float(easing[1]),
        Float(easing[2]),
        Float(easing[3])
      )
    }
    animation.duration = motion.duration / 1000
    animation.beginTime = beginTime
    animation.fillMode = fillMode(motion.fill)
    animation.isRemovedOnCompletion = false
  }

  static func fillMode(_ fill: NativeMotion.Fill?) -> CAMediaTimingFillMode {
    switch fill {
    case .some(.forwards): return .forwards
    case .some(.backwards): return .backwards
    case .some(.both): return .both
    case .some(.none), nil: return .removed
    }
  }

  /// When the cover starts and stops overlapping the view, in seconds
  /// from the start of the slide, sampled along its own eased timeline.
  static func coverChanges(
    _ motion: NativeMotion,
    cover: NativeMotion.Cover,
    in bounds: CGRect
  ) -> [(time: TimeInterval, covered: Bool)] {
    let area = bounds.insetBy(dx: 0.5, dy: 0.5)
    let duration = motion.duration / 1000
    var changes: [(time: TimeInterval, covered: Bool)] = []
    for sample in 0...coverSamples {
      let progress = Double(sample) / Double(coverSamples)
      let shift = offset(of: cover.keyframes, easings: motion.easings, at: progress)
      let covered = cover.frame.cgRect.offsetBy(dx: shift.x, dy: shift.y).intersects(area)
      if changes.last?.covered != covered && !(changes.isEmpty && !covered) {
        changes.append((progress * duration, covered))
      }
    }
    return changes
  }

  /// Where keyframes put something at a point of the slide's timeline, with
  /// each segment eased as Core Animation eases it.
  static func offset(
    of keyframes: [NativeMotion.Keyframe],
    easings: [[Double]]?,
    at progress: Double
  ) -> CGPoint {
    guard let first = keyframes.first, let last = keyframes.last else { return .zero }
    if progress <= first.offset { return CGPoint(x: first.x, y: first.y) }
    for (index, (start, end)) in zip(keyframes, keyframes.dropFirst()).enumerated() where progress <= end.offset {
      let span = end.offset - start.offset
      let local = span > 0 ? (progress - start.offset) / span : 1
      let eased = easings.flatMap { $0.indices.contains(index) ? $0[index] : nil }
        .map { bezier($0, at: local) } ?? local
      return CGPoint(x: start.x + (end.x - start.x) * eased, y: start.y + (end.y - start.y) * eased)
    }
    return CGPoint(x: last.x, y: last.y)
  }

  /// The value of a CSS cubic Bézier easing at a point of its timeline.
  static func bezier(_ points: [Double], at time: Double) -> Double {
    guard points.count == 4 else { return time }
    func curve(_ along: Double, _ first: Double, _ second: Double) -> Double {
      let rest = 1 - along
      return 3 * rest * rest * along * first + 3 * rest * along * along * second + along * along * along
    }
    var low = 0.0
    var high = 1.0
    var along = time
    for _ in 0..<40 {
      let reached = curve(along, points[0], points[2])
      if abs(reached - time) < 1e-6 { break }
      if reached < time { low = along } else { high = along }
      along = (low + high) / 2
    }
    return curve(along, points[1], points[3])
  }
}
