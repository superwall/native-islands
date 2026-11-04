import Testing

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

  @Test("Looks for a parked mount's scroll view every frame for one second")
  func parksForOneSecondOfFrames() {
    let seconds = Double(NativeIslandManager.parkingAttempts) / Double(NativeFrameTicker.framesPerSecond)
    #expect(seconds == 1)
    #expect(NativeIslandManager.parkingAttempts == 60)
  }
}
