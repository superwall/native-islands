import UIKit

extension NativeIslandManager {
  func reportSizes(of ids: [String]) {
    for id in ids {
      guard let island = islands[id], island.sizing == .native, let size = island.measure() else { continue }
      outbox.append(.size(id: id, size: size, sequence: island.context.sequence))
    }
  }

  /// Reports a natively sized island's new size once its content changed
  /// size on its own. Before its first report (while it mounts) the batch
  /// reports it, so this stays quiet until then.
  func contentSizeChanged(_ island: NativeIsland) {
    guard
      islands[island.context.id] === island,
      island.reportedSize != nil,
      let size = island.measure()
    else { return }
    post(.size(id: island.context.id, size: size, sequence: island.context.sequence))
  }
}
