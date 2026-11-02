import SwiftUI

public enum NativeComponentError: Error, Equatable, LocalizedError {
  case notShowing
  case unmounted
  case invalidValue
  case refused(String)
  case timedOut

  public var errorDescription: String? {
    switch self {
    case .notShowing:
      return "The native component isn't showing."
    case .unmounted:
      return "The native component was removed."
    case .invalidValue:
      return "Only JSON values can be sent to the page."
    case .refused(let reason):
      return reason
    case .timedOut:
      return "The page didn't answer in time."
    }
  }
}

@MainActor
protocol NativeIslandMessaging: AnyObject {
  func post(_ reply: NativeReply)
  func ready(_ id: String)
  func request(
    from id: String,
    name: String,
    payload: NativeValue?
  ) async throws -> NativeValue?
}

@MainActor
public final class NativeComponentContext: ObservableObject {
  public let id: String
  public let component: String
  @Published public private(set) var props: NativeComponentProps
  @Published public private(set) var accessibility: NativeComponentAccessibility?
  @Published public private(set) var isVisible: Bool

  let sequence: Int
  private(set) var isAcknowledged = false
  private(set) var revision = 0
  private(set) var localState: [String: NativeValue] = [:]
  private var pageProps: [String: NativeValue]
  private var pageRevision: Int
  private(set) var commandHandler: (@MainActor (String, Any?) async throws -> Any?)?
  private let waitsUntilReady: Bool
  weak var host: NativeIslandMessaging?

  init(
    mount: NativeMount,
    sequence: Int,
    waitsUntilReady: Bool,
    host: NativeIslandMessaging?
  ) {
    id = mount.id
    component = mount.component
    self.sequence = sequence
    self.waitsUntilReady = waitsUntilReady
    self.host = host
    pageProps = mount.props
    pageRevision = mount.stateRevision ?? 0
    props = NativeComponentProps(mount.props)
    accessibility = mount.accessibility.map(NativeComponentAccessibility.init)
    isVisible = mount.visible
  }

  public var state: [String: Any] {
    localState.mapValues(\.anyValue)
  }

  public func emit(_ event: String, payload: Any? = nil) {
    guard !event.isEmpty, isAcknowledged, isVisible else { return }
    let value: NativeValue?
    if let payload {
      guard let converted = NativeValue(any: payload) else {
        warnInvalid("event \(event)")
        return
      }
      value = converted
    } else {
      value = nil
    }
    host?.post(.event(id: id, name: event, payload: value, sequence: sequence))
  }

  public func setState(_ values: [String: Any], replace: Bool = false) {
    var converted: [String: NativeValue] = [:]
    for (key, value) in values {
      guard let nativeValue = NativeValue(any: value) else {
        warnInvalid("state \(key)")
        return
      }
      converted[key] = nativeValue
    }
    revision += 1
    if replace {
      localState = converted
    } else {
      localState.merge(converted) { _, new in new }
    }
    refreshProps()
    host?.post(
      .state(id: id, revision: revision, values: converted, replace: replace, sequence: sequence)
    )
  }

  public func request(_ name: String, payload: Any? = nil) async throws -> Any? {
    guard isAcknowledged, let host else { throw NativeComponentError.notShowing }
    let value: NativeValue?
    if let payload {
      guard let converted = NativeValue(any: payload) else {
        throw NativeComponentError.invalidValue
      }
      value = converted
    } else {
      value = nil
    }
    let answer = try await host.request(from: id, name: name, payload: value)
    return answer?.anyValue
  }

  public func onCommand(_ handler: @escaping @MainActor (_ name: String, _ args: Any?) async throws -> Any?) {
    commandHandler = handler
  }

  public func ready() {
    guard waitsUntilReady, !isAcknowledged else { return }
    host?.ready(id)
  }

  func acknowledge() {
    isAcknowledged = true
  }

  func apply(_ update: NativeUpdate) {
    // Props echoing an older state than the view has sent are dropped
    // whole, as the reference simulator does: the page will echo
    // the newer state next.
    let stale = update.stateRevision.map { $0 < revision } ?? false
    if let revision = update.stateRevision {
      pageRevision = revision
    }
    if let props = update.props, !stale {
      pageProps = props
    }
    if update.props != nil || update.stateRevision != nil {
      refreshProps()
    }
    if let accessibility = update.accessibility {
      self.accessibility = NativeComponentAccessibility(accessibility)
    }
    if let visible = update.visible, visible != isVisible {
      isVisible = visible
    }
  }

  private func refreshProps() {
    var merged = pageProps
    if pageRevision < revision {
      merged.merge(localState) { _, local in local }
    }
    let next = NativeComponentProps(merged)
    if next != props {
      props = next
    }
  }

  private func warnInvalid(_ what: String) {
    NativeIslandsLog.main.warning(
      "\(self.component, privacy: .public) sent a value JSON can't carry, so it was dropped: \(what, privacy: .public)"
    )
  }
}

struct NativeIslandRoot: View {
  @ObservedObject var context: NativeComponentContext
  let make: @MainActor (NativeComponentContext) -> AnyView

  var body: some View {
    make(context)
      .modifier(NativeAccessibilityModifier(accessibility: context.accessibility))
  }
}
