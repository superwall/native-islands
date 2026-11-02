import UIKit

/// Draws the visible part of an island: its area, with the holes the page
/// covers left out.
final class NativeIslandMask: UIView {
  private let shape = CAShapeLayer()

  override init(frame: CGRect) {
    super.init(frame: frame)
    shape.fillColor = UIColor.black.cgColor
    layer.addSublayer(shape)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("NativeIslandMask is created in code.")
  }

  func draw(area: CGRect, holes: [CGRect]) {
    Self.draw(shape, in: bounds, area: area, holes: holes)
  }

  static func shapeLayer() -> CAShapeLayer {
    let layer = CAShapeLayer()
    layer.fillColor = UIColor.black.cgColor
    return layer
  }

  /// Fills `area` of `layer`, less `holes`.
  static func draw(_ layer: CAShapeLayer, in bounds: CGRect, area: CGRect, holes: [CGRect]) {
    let path = CGMutablePath()
    path.addRects(visibleParts(of: area, less: holes))
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    layer.frame = bounds
    layer.path = path
    CATransaction.commit()
  }

  /// The parts of `area` no hole covers, as rects that do not overlap.
  /// Holes may overlap or nest, so they cannot simply be cut with the
  /// even-odd rule: two holes over one spot would fill it again.
  static func visibleParts(of area: CGRect, less holes: [CGRect]) -> [CGRect] {
    let cuts = holes.map { $0.intersection(area) }.filter { !$0.isNull && !$0.isEmpty }
    guard !cuts.isEmpty else { return [area] }
    let columns = Set([area.minX, area.maxX] + cuts.flatMap { [$0.minX, $0.maxX] }).sorted()
    let rows = Set([area.minY, area.maxY] + cuts.flatMap { [$0.minY, $0.maxY] }).sorted()
    var parts: [CGRect] = []
    for (top, bottom) in zip(rows, rows.dropFirst()) {
      var row: CGRect?
      for (left, right) in zip(columns, columns.dropFirst()) {
        let cell = CGRect(x: left, y: top, width: right - left, height: bottom - top)
        let middle = CGPoint(x: cell.midX, y: cell.midY)
        if cuts.contains(where: { $0.contains(middle) }) {
          if let row { parts.append(row) }
          row = nil
        } else {
          row = row.map { $0.union(cell) } ?? cell
        }
      }
      if let row { parts.append(row) }
    }
    return parts
  }
}
