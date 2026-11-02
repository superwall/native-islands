import CoreGraphics
import Testing
@testable import NativeIslands

extension NativeBridgeTests {
  @Suite
  struct MaskTests {
    private let area = CGRect(x: 0, y: 0, width: 362, height: 52)

    private func covers(_ parts: [CGRect], _ point: CGPoint) -> Bool {
      parts.contains { $0.contains(point) }
    }

    @Test("Leaves nothing drawn when overlapping holes cover all of the area")
    func overlappingHolesCoverAll() {
      let parts = NativeIslandMask.visibleParts(of: area, less: [
        CGRect(x: 0, y: 0, width: 362, height: 37),
        CGRect(x: 147, y: 4, width: 78, height: 22.5),
        CGRect(x: 0, y: 0, width: 362, height: 52)
      ])
      #expect(parts.isEmpty)
    }

    @Test("Draws what no hole covers, as rects that do not overlap")
    func partialHoles() {
      let parts = NativeIslandMask.visibleParts(of: area, less: [
        CGRect(x: 0, y: 0, width: 100, height: 52),
        CGRect(x: 50, y: 0, width: 100, height: 20)
      ])
      #expect(!covers(parts, CGPoint(x: 10, y: 10)))
      #expect(!covers(parts, CGPoint(x: 120, y: 10)))
      #expect(covers(parts, CGPoint(x: 120, y: 30)))
      #expect(covers(parts, CGPoint(x: 300, y: 10)))
      for (index, part) in parts.enumerated() {
        for other in parts[(index + 1)...] {
          #expect(!part.intersects(other))
        }
      }
    }

    @Test("Draws the whole area with no holes, ignoring holes outside it")
    func noHoles() {
      #expect(NativeIslandMask.visibleParts(of: area, less: []) == [area])
      #expect(NativeIslandMask.visibleParts(of: area, less: [CGRect(x: 0, y: 60, width: 10, height: 10)]) == [area])
    }
  }
}
