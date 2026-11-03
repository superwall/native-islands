import Foundation

/// A slide the page runs with a CSS animation, for the host to run on the
/// native view in step. The island's frame is where it rests; each keyframe
/// is an offset from there.
struct NativeMotion: Decodable, Equatable, Sendable {
  struct Keyframe: Decodable, Equatable, Sendable {
    let offset: Double
    let x: Double
    let y: Double
  }

  /// A box above the island that slides with it, in the island's own
  /// coordinates, with its keyframes relative to the island's.
  struct Cover: Decodable, Equatable, Sendable {
    let frame: NativeFrame
    let keyframes: [Keyframe]
  }

  enum Fill: String, Decodable, Sendable {
    case none
    case forwards
    case backwards
    case both
  }

  static let maxKeyframes = 16
  static let maxMilliseconds = 10_000.0

  let keyframes: [Keyframe]
  let easings: [[Double]]?
  /// In milliseconds.
  let duration: Double
  /// How far into the slide the page measured it, in milliseconds.
  let elapsed: Double
  let fill: Fill?
  let cover: Cover?

  init(
    keyframes: [Keyframe],
    easings: [[Double]]? = nil,
    duration: Double,
    elapsed: Double = 0,
    fill: Fill? = nil,
    cover: Cover? = nil
  ) {
    self.keyframes = keyframes
    self.easings = easings
    self.duration = duration
    self.elapsed = elapsed
    self.fill = fill
    self.cover = cover
  }

  var isValid: Bool {
    guard
      (2...Self.maxKeyframes).contains(keyframes.count),
      Self.validKeyframes(keyframes),
      duration.isFinite, duration > 0, duration <= Self.maxMilliseconds,
      elapsed.isFinite, abs(elapsed) <= Self.maxMilliseconds
    else {
      return false
    }
    if let easings {
      let valid = easings.count == keyframes.count - 1 && easings.allSatisfy { easing in
        easing.count == 4 && easing.allSatisfy(\.isFinite) && (0...1).contains(easing[0]) && (0...1).contains(easing[2])
      }
      if !valid { return false }
    }
    if let cover {
      guard
        cover.frame.isValid,
        cover.keyframes.count == keyframes.count,
        Self.validKeyframes(cover.keyframes),
        zip(cover.keyframes, keyframes).allSatisfy({ $0.offset == $1.offset })
      else {
        return false
      }
    }
    return true
  }

  private static func validKeyframes(_ keyframes: [Keyframe]) -> Bool {
    var last = -Double.infinity
    for frame in keyframes {
      guard frame.offset.isFinite, frame.x.isFinite, frame.y.isFinite,
            (0...1).contains(frame.offset), frame.offset >= last else {
        return false
      }
      last = frame.offset
    }
    return true
  }

  /// Whether `other` is this slide again, measured later: everything but
  /// how far in it was.
  func isSameSlide(as other: NativeMotion?) -> Bool {
    guard let other else { return false }
    return keyframes == other.keyframes &&
      easings == other.easings &&
      duration == other.duration &&
      fill == other.fill &&
      cover == other.cover
  }
}
