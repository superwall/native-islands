import SwiftUI
import Testing
import UIKit

@testable import NativeIslands

@Suite
@MainActor
struct FrameTickerTests {
  @Test("Runs work on the next display frame, not at once")
  func runsWorkOnTheNextFrame() async {
    let ticker = NativeFrameTicker()
    var ran = false
    await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
      ticker.next {
        ran = true
        done.resume()
      }
      #expect(!ran)
      #expect(ticker.isRunning)
    }
    #expect(ran)
    #expect(!ticker.isRunning)
  }

  @Test("Runs work queued during a frame on the frame after it")
  func runsWorkQueuedDuringAFrameOnTheNextOne() {
    let ticker = NativeFrameTicker()
    var order: [Int] = []
    ticker.next {
      order.append(1)
      ticker.next { order.append(2) }
    }
    ticker.tick()
    #expect(order == [1])
    #expect(ticker.isRunning)
    ticker.tick()
    #expect(order == [1, 2])
    #expect(!ticker.isRunning)
  }

  @Test("Looks for a parked mount's scroll view on each frame, for one second of frames")
  func looksForAParkedMountEveryFrame() {
    let ticker = NativeFrameTicker()
    let registry = NativeComponentRegistry()
    registry.register("glassButton") { _ in Color.clear }
    let surface = FakeSurface()
    let manager = NativeIslandManager(
      registry: registry,
      surface: surface,
      send: { _ in },
      schedule: { _ in },
      retry: { ticker.next($0) }
    )
    let far = surface.addScroller(
      frame: CGRect(x: 800, y: 0, width: 400, height: 800),
      contentSize: CGSize(width: 400, height: 801)
    )
    let anchor = scroller(
      "pushed",
      frame: NativeFrame(x: 400, y: 0, width: 400, height: 800),
      contentSize: NativeSize(width: 400, height: 801)
    )
    manager.apply(batch(1, mountOp(anchor: anchor)))
    #expect(manager.parked["cta"] != nil)
    for frame in 1..<NativeIslandManager.parkingAttempts {
      ticker.tick()
      #expect(manager.parked["cta"]?.attempts == frame)
      #expect(ticker.isRunning)
    }
    ticker.tick()
    #expect(manager.parked["cta"] == nil)
    #expect(manager.islands["cta"]?.view.superview === far)
    #expect(!ticker.isRunning)
    #expect(Double(NativeIslandManager.parkingAttempts) / Double(NativeFrameTicker.framesPerSecond) == 1)
  }
}
