import CoreGraphics
import Foundation

public struct NativeIslandAlignment: Equatable, Sendable, Codable {
  public let id: String
  public let component: String
  public let frame: CGRect
  public let web: CGRect?
  public let visible: Bool
  public let acknowledged: Bool
  public let shown: Bool
  public let handoff: String?
  /// The test page's scenario and what it expects of the island, read from
  /// its `data-scenario` and `data-expect` attributes.
  @_spi(Testing) public let scenario: String?
  @_spi(Testing) public let expect: String?

  public var deltas: [Double] {
    guard let web else { return [] }
    return [
      Double(frame.minX - web.minX),
      Double(frame.minY - web.minY),
      Double(frame.width - web.width),
      Double(frame.height - web.height)
    ]
  }

  public func isMisaligned(tolerance: Double = NativeIslandAlignment.tolerance) -> Bool {
    visible && deltas.contains { abs($0) > tolerance }
  }

  public static let tolerance: Double = 0.5

  static func compare(frames: [NativeIslandFrame], dom: [String: [String: Any]]) -> [NativeIslandAlignment] {
    frames.map { frame in
      let entry = dom[frame.id]
      var web: CGRect?
      if let entry,
        let x = entry["x"] as? Double,
        let y = entry["y"] as? Double,
        let width = entry["width"] as? Double,
        let height = entry["height"] as? Double {
        web = CGRect(x: x, y: y, width: width, height: height)
      }
      return NativeIslandAlignment(
        id: frame.id,
        component: frame.component,
        frame: frame.frame,
        web: web,
        visible: frame.visible,
        acknowledged: frame.acknowledged,
        shown: entry?["shown"] as? Bool ?? false,
        handoff: entry?["handoff"] as? String,
        scenario: entry?["scenario"] as? String,
        expect: entry?["expect"] as? String
      )
    }
  }
}
