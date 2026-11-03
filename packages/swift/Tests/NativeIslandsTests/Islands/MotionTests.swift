import QuartzCore
import SwiftUI
import Testing
import UIKit
@testable import NativeIslands

private let push = NativeMotion(
  keyframes: [.init(offset: 0, x: 402, y: 0), .init(offset: 1, x: 0, y: 0)],
  easings: [[0.32, 0.72, 0, 1]],
  duration: 500,
  elapsed: 100,
  fill: .both
)

private func slide(_ id: String, motion: NativeMotion?) -> NativeOperation {
  .update(NativeUpdate(id: id, frame: NativeFrame(x: 10, y: 20, width: 100, height: 44), motion: motion))
}

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct MotionTests {
    @Test
    func aSlideRunsOnTheViewFromWhereThePageMeasuredIt() throws {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp("back"), slide("back", motion: push)))
      let view = try #require(harness.island("back")?.view)
      #expect(view.frame.origin == CGPoint(x: 10, y: 20))
      let animation = try #require(
        view.layer.animation(forKey: NativeIsland.motionKey) as? CAKeyframeAnimation
      )
      #expect(animation.keyPath == "position")
      #expect(animation.isAdditive)
      #expect(animation.values as? [NSValue] == [NSValue(cgPoint: CGPoint(x: 402, y: 0)), NSValue(cgPoint: .zero)])
      #expect(animation.keyTimes == [0, 1])
      #expect(animation.duration == 0.5)
      #expect(animation.fillMode == .both)
      #expect(animation.timingFunctions?.count == 1)
      let now = view.layer.convertTime(CACurrentMediaTime(), from: nil)
      #expect(abs(now - animation.beginTime - 0.1) < 0.05)
    }

    @Test
    func theSameSlideSentAgainKeepsRunning() throws {
      let harness = NativeTestHarness()
      harness.manager.apply(batch(1, mountOp("back"), slide("back", motion: push)))
      let view = try #require(harness.island("back")?.view)
      let first = view.layer.animation(forKey: NativeIsland.motionKey)
      let later = NativeMotion(
        keyframes: push.keyframes,
        easings: push.easings,
        duration: push.duration,
        elapsed: 300,
        fill: push.fill
      )
      harness.manager.apply(batch(2, slide("back", motion: later)))
      #expect(view.layer.animation(forKey: NativeIsland.motionKey) === first)
      harness.manager.apply(batch(3, slide("back", motion: nil)))
      #expect(view.layer.animation(forKey: NativeIsland.motionKey) == nil)
    }

    @Test
    func anIslandGoingUnderHidesWhileThePageComingInCoversIt() throws {
      let harness = NativeTestHarness()
      let under = NativeMotion(
        keyframes: [.init(offset: 0, x: 0, y: 0), .init(offset: 1, x: -120, y: 0)],
        duration: 500,
        cover: .init(
          frame: NativeFrame(x: -300, y: -20, width: 400, height: 800),
          keyframes: [.init(offset: 0, x: 400, y: 0), .init(offset: 1, x: 120, y: 0)]
        )
      )
      harness.manager.apply(batch(1, mountOp("back"), slide("back", motion: under)))
      let view = try #require(harness.island("back")?.view)
      let island = try #require(harness.island("back"))
      // The cover's left edge slides from 100 to -180 across a view 100
      // wide: shown until the edge reaches it, then hidden for good.
      let changes = NativeIsland.coverChanges(under, cover: try #require(under.cover), in: view.bounds)
      #expect(changes.count == 1)
      #expect(changes.first?.covered == true)
      #expect((changes.first?.time ?? 0) > 0)
      #expect((changes.first?.time ?? 1) < 0.05)
      #expect(!view.isHidden)
      island.setCoverHidden(true)
      #expect(view.isHidden)

      harness.manager.apply(batch(2, slide("back", motion: nil)))
      #expect(!view.isHidden)
      #expect(view.layer.animation(forKey: NativeIsland.motionKey) == nil)
    }

    @Test
    func refusesSlidesItCannotRunInStep() {
      let frames: [NativeMotion.Keyframe] = [.init(offset: 0, x: 0, y: 0), .init(offset: 1, x: 1, y: 0)]
      #expect(push.isValid)
      #expect(!NativeMotion(keyframes: Array(frames.prefix(1)), duration: 500).isValid)
      #expect(!NativeMotion(keyframes: frames.reversed(), duration: 500).isValid)
      #expect(!NativeMotion(keyframes: frames, duration: 0).isValid)
      #expect(!NativeMotion(keyframes: frames, duration: 500, elapsed: .infinity).isValid)
      #expect(!NativeMotion(keyframes: frames, easings: [[0, 0, 1]], duration: 500).isValid)
      #expect(!NativeMotion(keyframes: frames, easings: [[2, 0, 1, 1]], duration: 500).isValid)
      let offBeat = NativeMotion.Cover(
        frame: NativeFrame(x: 0, y: 0, width: 10, height: 10),
        keyframes: [.init(offset: 0, x: 0, y: 0), .init(offset: 0.5, x: 0, y: 0)]
      )
      #expect(!NativeMotion(keyframes: frames, duration: 500, cover: offBeat).isValid)
    }

    @Test
    func anIslandCoveredWhenTheSlideStartsStartsHidden() throws {
      let harness = NativeTestHarness()
      let popUnder = NativeMotion(
        keyframes: [.init(offset: 0, x: -120, y: 0), .init(offset: 1, x: 0, y: 0)],
        duration: 500,
        cover: .init(
          frame: NativeFrame(x: -300, y: -20, width: 400, height: 800),
          keyframes: [.init(offset: 0, x: 120, y: 0), .init(offset: 1, x: 400, y: 0)]
        )
      )
      harness.manager.apply(batch(1, mountOp("back"), slide("back", motion: popUnder)))
      let view = try #require(harness.island("back")?.view)
      #expect(view.isHidden)
      let changes = NativeIsland.coverChanges(popUnder, cover: try #require(popUnder.cover), in: view.bounds)
      #expect(changes.map(\.covered) == [true, false])
      #expect(changes.first?.time == 0)
    }

    @Test
    func slidingGlassTakesNoTouchesUntilItComesToRest() throws {
      let harness = NativeTestHarness()
      harness.registry.register(
        "glassButton",
        glass: { _ in NativeGlass(shape: .circle) },
        content: { _ in Color.clear }
      )
      harness.manager.apply(batch(1, mountOp("back"), slide("back", motion: push)))
      let glass = try #require(harness.island("back")?.view as? NativeGlassView)
      #expect(glass.isSliding)
      #expect(glass.glass.isInteractive)
      harness.manager.apply(batch(2, slide("back", motion: nil)))
      #expect(!glass.isSliding)
    }

    @Test
    func keyframesAreEasedAsCoreAnimationEasesThem() {
      let frames: [NativeMotion.Keyframe] = [.init(offset: 0, x: 0, y: 0), .init(offset: 1, x: 100, y: 0)]
      #expect(NativeIsland.offset(of: frames, easings: nil, at: 0.25).x == 25)
      #expect(NativeIsland.offset(of: frames, easings: nil, at: -1).x == 0)
      #expect(NativeIsland.offset(of: frames, easings: nil, at: 2).x == 100)
      let eased = NativeIsland.offset(of: frames, easings: [[0.32, 0.72, 0, 1]], at: 0.25).x
      #expect(eased > 60)
      #expect(abs(NativeIsland.bezier([0.42, 0, 0.58, 1], at: 0.5) - 0.5) < 0.001)
      #expect(NativeIsland.bezier([0, 0, 1, 1], at: 0.3) == 0.3 || abs(NativeIsland.bezier([0, 0, 1, 1], at: 0.3) - 0.3) < 0.001)
    }

    @Test
    func fillModesFollowTheCSSFill() {
      #expect(NativeIsland.fillMode(nil) == .removed)
      #expect(NativeIsland.fillMode(NativeMotion.Fill.none) == .removed)
      #expect(NativeIsland.fillMode(.forwards) == .forwards)
      #expect(NativeIsland.fillMode(.backwards) == .backwards)
      #expect(NativeIsland.fillMode(.both) == .both)
    }
  }
}
