import SwiftUI
import UIKit

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
  var parked: [String: ParkedMount] = [:]
  let retry: @MainActor (@escaping @MainActor () -> Void) -> Void
  static let parkingAttempts = 20
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
    let island = NativeIsland(context: context, host: host, mount: mount, glass: entry.glass)
    if mount.sizing == .native {
      island.watchSize { [weak self, weak island] in
        guard let self, let island else { return }
        contentSizeChanged(island)
      }
    }
    host.view.backgroundColor = .clear
    if #available(iOS 16.4, *) {
      host.safeAreaRegions = []
    }
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
      reanchor(island, to: anchor)
    }
    var refade = false
    if let frame = update.frame {
      refade = island.opacity != update.opacity
      island.place(frame, geometryOf: update)
      island.layOut()
    }
    if let order = update.order {
      island.reorder(order)
    }
    apply(update, to: island, refade: refade)
    if update.props != nil, island.sizing == .native, let size = island.measure() {
      post(.size(id: update.id, size: size, sequence: island.context.sequence))
    }
    return nil
  }

  private func apply(_ update: NativeUpdate, to island: NativeIsland, refade: Bool) {
    let wasVisible = island.context.isVisible
    let wasGroup = island.glassGroup
    island.context.apply(update)
    if update.props != nil {
      island.refreshGlass()
    }
    if island.context.isVisible != wasVisible {
      island.applyVisibility(animated: true)
    } else if refade {
      island.applyVisibility(animated: false)
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
    island.sizeObservation?.invalidate()
    detachFromParent(island.host)
    island.view.removeFromSuperview()
    island.removeShades()
    pruneGroups(in: island.container)
    failRequests(for: id)
  }

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

// MARK: - Containment

extension NativeIslandManager {
  /// The view controller that owns the web view, found through the
  /// responder chain so any `WKWebView` works. UIKit only supports
  /// presenting (a color picker, a menu, a sheet) from a controller in
  /// the hierarchy, so each island's hosting controller becomes its child.
  var parentController: UIViewController? {
    guard let viewport = surface?.viewport else { return nil }
    return sequence(first: viewport as UIResponder, next: \.next)
      .lazy
      .compactMap { $0 as? UIViewController }
      .first
  }

  /// Makes every island's hosting controller a child of the web view's
  /// controller, for islands mounted before the web view had one.
  func adoptIslands() {
    for island in islands.values {
      adopt(island)
    }
  }

  func adopt(_ island: NativeIsland) {
    let host = island.host
    guard let parent = parentController, host.parent !== parent else { return }
    detachFromParent(host)
    parent.addChild(host)
    host.didMove(toParent: parent)
  }

  private func detachFromParent(_ host: UIViewController) {
    guard host.parent != nil else { return }
    host.willMove(toParent: nil)
    host.removeFromParent()
  }
}

// MARK: - Recovery

extension NativeIslandManager {
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

extension NativeIslandManager {
  // WebKit can give a scroller a new scroll view without the page noticing,
  // such as a screen parked off to the side that slides in: the old one stays
  // at the parked spot. Once the island's scroll view has left the viewport
  // and another one matches the scroller, the island follows it. One still on
  // screen is kept: while it scrolls, the page's anchor lags its offset and a
  // parked twin could match better.
  private func reanchor(_ island: NativeIsland, to anchor: NativeAnchor) {
    guard case .scroller = anchor, let surface,
      !isOnScreen(island.container, in: surface.viewport),
      let container = container(for: anchor, in: surface), container !== island.container
    else { return }
    let previous = island.container
    attach(island, to: container)
    pruneGroups(in: previous)
  }

  private func isOnScreen(_ container: UIView?, in viewport: UIView) -> Bool {
    guard let container, container.isDescendant(of: viewport) else { return false }
    return container.convert(container.bounds, to: viewport).intersects(viewport.bounds)
  }
}
