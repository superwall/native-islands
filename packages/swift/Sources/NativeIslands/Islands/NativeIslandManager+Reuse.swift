import UIKit

// MARK: - Retired islands

extension NativeIslandManager {
  struct RetiredIsland {
    let island: NativeIsland
    let order: Int
  }

  static let retiredLimit = 128
  static let retiredLifetime: TimeInterval = 65

  /// Keeps the view of an island the page unmounted, hidden, so an island
  /// that comes back with the same component can take it over in the
  /// frame it mounts instead of building a new one. A glass view stays in
  /// its group while hidden, so the group's effect is still there for it.
  func retire(_ id: String) {
    guard let island = islands[id], island.container != nil else {
      remove(id)
      return
    }
    _ = takeOut(id)
    parked[id] = nil
    failRequests(for: id)
    island.sizeObservation?.invalidate()
    island.sizeObservation = nil
    island.removeShades()
    island.view.isHidden = true
    island.view.isUserInteractionEnabled = false
    retiredCount += 1
    let order = retiredCount
    retired[id] = RetiredIsland(island: island, order: order)
    if retired.count > Self.retiredLimit,
      let oldest = retired.min(by: { $0.value.order < $1.value.order })?.key {
      discardRetired(oldest)
    }
    expire { [weak self] in
      guard let self, retired[id]?.order == order else { return }
      discardRetired(id)
    }
  }

  /// Shows the retired view a mount asks for at the mount's place, as its
  /// island. Returns false when there is none to take over.
  func takeOver(_ mount: NativeMount, sequence: Int) -> Bool {
    guard let from = mount.reuse, let entry = retired.removeValue(forKey: from) else { return false }
    let island = entry.island
    guard
      island.context.component == mount.component,
      island.sizing == mount.sizing,
      let registered = registry.entries[mount.component], registered.version >= mount.version,
      islands.count < NativeComponentLimits.maxIslands,
      let surface, let container = mountContainer(for: mount.anchor, in: surface, besides: island)
    else {
      discard(island)
      return false
    }
    remove(mount.id)
    island.context.takeOver(mount, sequence: sequence)
    island.move(to: mount.anchor)
    island.place(
      mount.frame,
      sticky: mount.sticky,
      clip: mount.clip,
      holes: mount.holes,
      shades: mount.shades,
      transform: mount.transform,
      opacity: mount.opacity,
      motion: mount.motion
    )
    island.reorder(mount.order)
    put(island, as: mount.id)
    attach(island, to: container)
    island.layOut()
    island.view.isHidden = false
    UIView.performWithoutAnimation {
      island.view.layoutIfNeeded()
    }
    island.applyVisibility(animated: false)
    island.applyAccessibility()
    if mount.sizing.isNative {
      island.watchSize { [weak self, weak island] in
        guard let self, let island else { return }
        contentSizeChanged(island)
      }
    }
    return true
  }

  func discardRetired(_ id: String) {
    guard let entry = retired.removeValue(forKey: id) else { return }
    discard(entry.island)
  }

  func discardRetired() {
    for id in Array(retired.keys) {
      discardRetired(id)
    }
  }

  private func discard(_ island: NativeIsland) {
    if island.host.parent != nil {
      island.host.willMove(toParent: nil)
      island.host.removeFromParent()
    }
    let container = island.container
    island.view.removeFromSuperview()
    pruneGroups(in: container)
  }
}
