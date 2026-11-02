import SwiftUI
import UIKit

/// Draws the native views a page asks for and carries their messages.
///
/// It mirrors the reference simulator (`simulator.ts`): a batch is
/// applied unmounts first, then mounts, then updates; every mount that drew is
/// acknowledged in one `native_component_ack`; every message about an island
/// carries the sequence of the batch that mounted it, so the page can drop
/// one meant for an earlier mount of the same id.
@MainActor
final class NativeIslandManager: NativeIslandMessaging {
  let registry: NativeComponentRegistry
  private(set) weak var surface: NativeHostSurface?
  let send: @MainActor ([NativeReply]) -> Void
  let schedule: @MainActor (@escaping @MainActor () -> Void) -> Void
  private(set) var islands: [String: NativeIsland] = [:]
  var outbox: [NativeReply] = []
  private(set) var recoveredUnreadableBatch = false
  var flushScheduled = false
  private(set) var applyingBatch = false
  var requestCount = 0
  var pendingRequests: [String: PendingRequest] = [:]
  var scrollObservations: [ObjectIdentifier: NSKeyValueObservation] = [:]
  /// Scroller mounts whose scroll view WebKit hasn't built yet, by id.
  var parked: [String: ParkedMount] = [:]
  /// Runs `work` again a little later, to look for a parked mount's scroll view.
  let retry: @MainActor (@escaping @MainActor () -> Void) -> Void
  /// How many times a parked mount looks for its scroll view before it is refused.
  static let parkingAttempts = 20
  /// How long a native view waits for the page to answer a request.
  var requestTimeoutNanoseconds: UInt64 = 10_000_000_000

  struct PendingRequest {
    let islandId: String
    let continuation: CheckedContinuation<NativeValue?, Error>
  }

  init(
    registry: NativeComponentRegistry,
    surface: NativeHostSurface,
    send: @escaping @MainActor ([NativeReply]) -> Void,
    schedule: @escaping @MainActor (@escaping @MainActor () -> Void) -> Void = { work in
      DispatchQueue.main.async { MainActor.assumeIsolated { work() } }
    },
    retry: @escaping @MainActor (@escaping @MainActor () -> Void) -> Void = { work in
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { MainActor.assumeIsolated { work() } }
    }
  ) {
    self.registry = registry
    self.surface = surface
    self.send = send
    self.schedule = schedule
    self.retry = retry
  }

  // MARK: - Batches

  func apply(_ batch: NativeComponentBatch) {
    applyingBatch = true
    var replies: [NativeReply] = []
    var acknowledged: [String] = []
    var waiting: [String] = []
    let operations = Self.ordered(batch.operations)
    for operation in operations {
      switch operation {
      case .unmount(let id):
        remove(id)
      case .mount(let mount):
        if shouldPark(mount) {
          park(mount, sequence: batch.sequence)
        } else if let error = mountIsland(mount, sequence: batch.sequence) {
          replies.append(error)
        } else if registry.entries[mount.component]?.waitsUntilReady == true {
          waiting.append(mount.id)
        } else {
          islands[mount.id]?.context.acknowledge()
          acknowledged.append(mount.id)
        }
      case .update(let update):
        if parked[update.id] != nil {
          parked[update.id]?.updates.append(update)
        } else if let error = updateIsland(update) {
          replies.append(error)
        }
      case .invalid(let id):
        guard let id else { continue }
        let sequence = islands[id]?.context.sequence ?? batch.sequence
        remove(id)
        replies.append(
          .error(
            id: id,
            reason: .invalidProps,
            message: "The host couldn't read this island's operation.",
            sequence: sequence
          )
        )
      }
    }
    if !acknowledged.isEmpty {
      replies.insert(.ack(sequence: batch.sequence, ids: acknowledged), at: 0)
    }
    reportSizes(of: acknowledged + waiting)
    updateObscured()
    applyingBatch = false
    replies.append(contentsOf: outbox)
    outbox.removeAll()
    if !replies.isEmpty {
      send(replies)
    }
  }

  /// Unmounts first, then mounts, then everything else, each in batch order,
  /// so an id can be unmounted and mounted again in one batch.
  static func ordered(_ operations: [NativeOperation]) -> [NativeOperation] {
    func rank(_ operation: NativeOperation) -> Int {
      switch operation {
      case .unmount: return 0
      case .mount: return 1
      case .update, .invalid: return 2
      }
    }
    return operations.enumerated()
      .sorted { (rank($0.element), $0.offset) < (rank($1.element), $1.offset) }
      .map(\.element)
  }

  func reportSizes(of ids: [String]) {
    for id in ids {
      guard let island = islands[id], island.sizing == .native, let size = island.measure() else { continue }
      outbox.append(.size(id: id, size: size, sequence: island.context.sequence))
    }
  }

  func mountIsland(_ mount: NativeMount, sequence: Int) -> NativeReply? {
    func failure(_ reason: NativeErrorReason, _ message: String) -> NativeReply {
      .error(id: mount.id, reason: reason, message: message, sequence: sequence)
    }
    guard let entry = registry.entries[mount.component] else {
      return failure(.unknownComponent, "The app registered no component named \(mount.component).")
    }
    guard entry.version >= mount.version else {
      return failure(
        .unsupportedVersion,
        "The app registered \(mount.component) at version \(entry.version), not \(mount.version)."
      )
    }
    remove(mount.id)
    guard islands.count < NativeComponentLimits.maxIslands else {
      return failure(.limitExceeded, "A page can show at most \(NativeComponentLimits.maxIslands) islands.")
    }
    guard let surface, let container = container(for: mount.anchor, in: surface) else {
      return failure(.anchorNotFound, "No scroll view matches this island's scroller.")
    }
    let context = NativeComponentContext(
      mount: mount,
      sequence: sequence,
      waitsUntilReady: entry.waitsUntilReady,
      host: self
    )
    let host = UIHostingController(rootView: NativeIslandRoot(context: context, make: entry.make))
    host.view.backgroundColor = .clear
    if #available(iOS 16.4, *) {
      host.safeAreaRegions = []
    }
    let island = NativeIsland(context: context, host: host, mount: mount, glass: entry.glass)
    islands[mount.id] = island
    attach(island, to: container)
    island.layOut()
    UIView.performWithoutAnimation {
      island.view.layoutIfNeeded()
    }
    island.applyVisibility(animated: false)
    island.applyAccessibility()
    return nil
  }

  func updateIsland(_ update: NativeUpdate) -> NativeReply? {
    guard let island = islands[update.id] else { return nil }
    if let anchor = update.anchor, needsMove(island, to: anchor) {
      guard let surface, let container = container(for: anchor, in: surface) else {
        let sequence = island.context.sequence
        remove(update.id)
        return .error(
          id: update.id,
          reason: .anchorNotFound,
          message: "No scroll view matches this island's new scroller.",
          sequence: sequence
        )
      }
      island.move(to: anchor)
      attach(island, to: container)
    } else if let anchor = update.anchor {
      island.move(to: anchor)
    }
    if let frame = update.frame {
      island.place(frame, sticky: update.sticky, clip: update.clip)
      island.layOut()
    }
    if let order = update.order {
      island.reorder(order)
    }
    apply(update, to: island)
    if update.props != nil, island.sizing == .native, let size = island.measure() {
      post(.size(id: update.id, size: size, sequence: island.context.sequence))
    }
    return nil
  }

  private func apply(_ update: NativeUpdate, to island: NativeIsland) {
    let wasVisible = island.context.isVisible
    let wasGroup = island.glassGroup
    island.context.apply(update)
    if update.props != nil {
      island.refreshGlass()
    }
    if island.context.isVisible != wasVisible {
      island.applyVisibility(animated: true)
    }
    if update.accessibility != nil {
      island.applyAccessibility()
    }
    if let container = island.container,
      island.glassGroup != wasGroup || update.order != nil || update.frame != nil {
      attach(island, to: container)
    }
  }

  private func needsMove(_ island: NativeIsland, to anchor: NativeAnchor) -> Bool {
    switch (island.anchor, anchor) {
    case (.page, .page), (.screen, .screen):
      return false
    case let (.scroller(current), .scroller(next)):
      return current.id != next.id
    default:
      return true
    }
  }

  func container(for anchor: NativeAnchor, in surface: NativeHostSurface) -> UIView? {
    switch anchor {
    case .page:
      return surface.pageScrollView
    case .screen:
      return surface.screenLayer
    case .scroller(let scroller):
      return NativeScrollerMatcher.match(
        scroller,
        among: NativeScrollerMatcher.candidates(in: surface.pageScrollView),
        in: surface.viewport
      )
    }
  }

  // MARK: - Removal

  func remove(_ id: String) {
    parked[id] = nil
    guard let island = islands.removeValue(forKey: id) else { return }
    island.view.removeFromSuperview()
    pruneGroups(in: island.container)
    failRequests(for: id)
  }

  /// Removes every island. With `notifyPage`, the page is asked to mount
  /// them all again, for when the views went away but the page lives on.
  func clear(notifyPage: Bool) {
    parked.removeAll()
    for id in Array(islands.keys) {
      remove(id)
    }
    outbox.removeAll()
    if notifyPage {
      send([.reset])
    } else {
      recoveredUnreadableBatch = false
    }
  }
}

// MARK: - Recovery

extension NativeIslandManager {
  /// A batch arrived that the host couldn't read, so its mounts were neither
  /// drawn nor refused and the page would wait on them. Clears every island
  /// and asks the page to mount them all again, once per page, so a page
  /// that keeps sending the same broken batch can't loop.
  func recoverFromUnreadableBatch() {
    guard !recoveredUnreadableBatch else { return }
    recoveredUnreadableBatch = true
    clear(notifyPage: true)
  }

  func failRequests(for id: String) {
    for (requestId, pending) in pendingRequests where pending.islandId == id {
      pendingRequests[requestId] = nil
      pending.continuation.resume(throwing: NativeComponentError.unmounted)
    }
  }
}

// MARK: - Frames

extension NativeIslandManager {
  /// Where each island is drawn, in the page's viewport coordinates (CSS
  /// pixels), for checking it against the web element it stands in for.
  func frames() -> [NativeIslandFrame] {
    guard let viewport = surface?.viewport else { return [] }
    return islands.map { id, island in
      let rect = island.view.convert(island.view.bounds, to: viewport)
      return NativeIslandFrame(
        id: id,
        component: island.context.component,
        frame: rect,
        visible: island.isShown && island.view.window != nil,
        acknowledged: island.context.isAcknowledged
      )
    }
    .sorted { $0.id < $1.id }
  }
}

/// One island as drawn, as the DEBUG frame reporter returns it.
struct NativeIslandFrame: Equatable {
  let id: String
  let component: String
  let frame: CGRect
  let visible: Bool
  let acknowledged: Bool

  var json: [String: Any] {
    [
      "id": id,
      "component": component,
      "x": Double(frame.origin.x),
      "y": Double(frame.origin.y),
      "width": Double(frame.width),
      "height": Double(frame.height),
      "visible": visible,
      "acknowledged": acknowledged
    ]
  }
}
