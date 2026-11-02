import SwiftUI

/// Why a native component's call to the page didn't go through.
public enum NativeComponentError: Error, Equatable, LocalizedError {
  /// The page hasn't accepted this view yet, or the view is hidden.
  case notShowing
  /// The page removed the view before it answered.
  case unmounted
  /// The value can't be sent: only JSON values cross the bridge.
  case invalidValue
  /// The page's handler refused, with its reason.
  case refused(String)
  /// The page didn't answer in time.
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

/// One native component on a page, handed to the view the app registered.
///
/// It carries what the page sent, ``props``, and is how the view talks
/// back:
///
/// - ``emit(_:payload:)`` reports something that happened, such as a tap.
/// - ``setState(_:replace:)`` reports values the view owns, such as what was
///   typed, so the page's React state stays in step.
/// - ``request(_:payload:)`` asks the page a question and waits for the
///   answer, such as whether an email address is valid.
/// - ``onCommand(_:)`` answers what the page asks the view to do, such as
///   moving focus to a field.
///
/// The view is rebuilt whenever ``props`` change.
@MainActor
public final class NativeComponentContext: ObservableObject {
  /// The page's id for this component. Unique on the page.
  public let id: String
  /// The name the component was registered under.
  public let component: String
  /// What the page sent. Values the view set with ``setState(_:replace:)``
  /// take the place of the page's own until the page has seen them, so
  /// an edit is never undone by an older copy of itself.
  @Published public private(set) var props: NativeComponentProps
  /// What VoiceOver should read, derived from the web version.
  @Published public private(set) var accessibility: NativeComponentAccessibility?
  /// Whether the page wants the view shown. It hides it while the web
  /// element moves, is covered or is clipped.
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

  /// The values this view set with ``setState(_:replace:)``.
  public var state: [String: Any] {
    localState.mapValues(\.anyValue)
  }

  /// Reports something that happened, such as `"press"`. The page calls
  /// the component's matching handler, `onPress`. Dropped while the view is
  /// hidden or not yet accepted, since the page shows its web version then.
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

  /// Reports values the view owns, such as a field's text, merged into what
  /// the page knows unless `replace` is `true`. The page passes them
  /// back as props; until it has, ``props`` shows these values.
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

  /// Asks the page's handler for the request `name` and waits for its
  /// answer, as Foundation types.
  ///
  /// - Throws: ``NativeComponentError``: `.refused` with the handler's reason,
  ///   `.notShowing` before the page accepted the view, `.unmounted` if it
  ///   goes away first, `.timedOut` after 10 seconds without an answer.
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

  /// Answers the page's commands, such as `"focus"`. The handler gets the
  /// command's name and arguments and returns a JSON value, or throws to
  /// refuse. Replaces the previous handler.
  public func onCommand(_ handler: @escaping @MainActor (_ name: String, _ args: Any?) async throws -> Any?) {
    commandHandler = handler
  }

  /// Tells the page the view can be shown, for a component registered with
  /// `waitsUntilReady: true`. Does nothing otherwise, or when called again.
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
