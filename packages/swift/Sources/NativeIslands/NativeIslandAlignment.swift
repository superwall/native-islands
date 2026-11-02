import CoreGraphics
import Foundation

/// Where one island is drawn compared with its web element, from
/// ``NativeIslandsHost/alignment()``.
public struct NativeIslandAlignment: Equatable, Sendable, Codable {
  /// The island's id, the `data-island-id` of its web element.
  public let id: String
  /// The component it draws.
  public let component: String
  /// The native view's frame, in viewport CSS pixels.
  public let frame: CGRect
  /// The web element's rect, or `nil` when the page has no element for it.
  public let web: CGRect?
  /// Whether the native view is drawn and on screen.
  public let visible: Bool
  /// Whether the host has acknowledged its mount.
  public let acknowledged: Bool
  /// Whether the page shows the native view in place of its web version.
  public let shown: Bool
  /// Why the page hands this island to the web, when it does.
  public let handoff: String?
  /// The `data-scenario` around the element, when there is one.
  public let scenario: String?
  /// The `data-expect` of that scenario, when there is one.
  public let expect: String?

  /// How far each edge of the native frame is from the web rect, as
  /// `[dx, dy, dwidth, dheight]`. Empty when there is no web element.
  public var deltas: [Double] {
    guard let web else { return [] }
    return [
      Double(frame.minX - web.minX),
      Double(frame.minY - web.minY),
      Double(frame.width - web.width),
      Double(frame.height - web.height)
    ]
  }

  /// Whether a visible island is more than `tolerance` points off its web element.
  public func isMisaligned(tolerance: Double = NativeIslandAlignment.tolerance) -> Bool {
    visible && deltas.contains { abs($0) > tolerance }
  }

  /// The largest distance the frames may differ by: half a point.
  public static let tolerance: Double = 0.5

  /// Pairs each native frame with the element the page reports for it.
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
