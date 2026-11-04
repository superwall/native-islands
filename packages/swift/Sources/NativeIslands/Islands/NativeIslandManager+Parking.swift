import UIKit

// MARK: - Parked mounts

extension NativeIslandManager {
  struct ParkedMount {
    let mount: NativeMount
    let sequence: Int
    var updates: [NativeUpdate] = []
    var attempts = 0
  }

  // WebKit builds a new scroller's scroll view a moment after the page
  // reports it. Until it does, another screen's scroll view with the same
  // geometry would match from afar, so a mount waits for one at its own spot.
  func shouldPark(_ mount: NativeMount) -> Bool {
    guard case .scroller = mount.anchor, surface != nil,
      let entry = registry.entries[mount.component], entry.version >= mount.version
    else { return false }
    return ownContainer(for: mount.anchor) == nil
  }

  private func ownContainer(for anchor: NativeAnchor) -> UIView? {
    guard case .scroller(let scroller) = anchor, let surface else { return nil }
    return NativeScrollerMatcher.match(
      scroller,
      among: NativeScrollerMatcher.candidates(in: surface.pageScrollView),
      in: surface.viewport,
      within: NativeScrollerMatcher.reach(of: scroller)
    ) { self.holdsIslands(of: $0, otherThan: scroller.id) }
  }

  func park(_ mount: NativeMount, sequence: Int) {
    remove(mount.id)
    parked[mount.id] = ParkedMount(mount: mount, sequence: sequence)
    scheduleParkedRetry(mount.id, sequence: sequence)
  }

  private func scheduleParkedRetry(_ id: String, sequence: Int) {
    retry { [weak self] in
      self?.retryParked(id, sequence: sequence)
    }
  }

  func retryParked(_ id: String, sequence: Int) {
    guard var entry = parked[id], entry.sequence == sequence else { return }
    entry.attempts += 1
    let found = ownContainer(for: entry.mount.anchor) != nil
    guard found || entry.attempts >= Self.parkingAttempts else {
      parked[id] = entry
      scheduleParkedRetry(id, sequence: sequence)
      return
    }
    parked[id] = nil
    var replies: [NativeReply] = []
    if let error = mountIsland(entry.mount, sequence: sequence) {
      replies.append(error)
    } else {
      for update in entry.updates {
        if let error = updateIsland(update) {
          replies.append(error)
        }
      }
      if islands[id] != nil, registry.entries[entry.mount.component]?.waitsUntilReady != true {
        islands[id]?.context.acknowledge()
        replies.insert(.ack(sequence: sequence, ids: [id]), at: 0)
      }
      reportSizes(of: islands[id] == nil ? [] : [id])
      updateObscured()
    }
    replies.append(contentsOf: outbox)
    outbox.removeAll()
    if !replies.isEmpty {
      send(replies)
    }
  }
}
