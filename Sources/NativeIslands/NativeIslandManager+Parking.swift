import Foundation

// MARK: - Parked mounts

extension NativeIslandManager {
  /// WebKit builds an inner scrolling area's scroll view some frames after the
  /// page lays it out, so a mount can arrive before its scroller exists.
  struct ParkedMount {
    let mount: NativeMount
    let sequence: Int
    var updates: [NativeUpdate] = []
    var attempts = 0
  }


  /// Whether `mount` asks for a scroller that has no scroll view yet, while
  /// the component itself would be drawn.
  func shouldPark(_ mount: NativeMount) -> Bool {
    guard case .scroller = mount.anchor, let surface,
      let entry = registry.entries[mount.component], entry.version >= mount.version
    else { return false }
    return container(for: mount.anchor, in: surface) == nil
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

  /// Looks again for a parked mount's scroll view: draws and acknowledges it
  /// once there, replaying the updates that came meanwhile, or refuses it
  /// with `anchor_not_found` after ``parkingAttempts`` tries.
  func retryParked(_ id: String, sequence: Int) {
    guard var entry = parked[id], entry.sequence == sequence else { return }
    entry.attempts += 1
    let found = surface.flatMap { container(for: entry.mount.anchor, in: $0) } != nil
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
