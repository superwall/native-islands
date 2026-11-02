import SwiftUI

/// Register before attaching a ``NativeIslandsHost``: a page learns what is
/// offered when its document starts.
@MainActor
public final class NativeComponentRegistry {
  public static let shared = NativeComponentRegistry()

  struct Entry {
    let version: Int
    let waitsUntilReady: Bool
    let glass: (@MainActor (NativeComponentProps) -> NativeGlass?)?
    let make: @MainActor (NativeComponentContext) -> AnyView
  }

  private(set) var entries: [String: Entry] = [:]

  public init() {}

  public func register<Content: View>(
    _ name: String,
    version: Int = 1,
    waitsUntilReady: Bool = false,
    glass: (@MainActor (NativeComponentProps) -> NativeGlass?)? = nil,
    @ViewBuilder content: @escaping @MainActor (NativeComponentContext) -> Content
  ) {
    guard
      !name.isEmpty,
      name.count <= NativeComponentLimits.maxComponentNameLength,
      version > 0
    else {
      NativeIslandsLog.main.warning(
        "Ignored a native component registration with an invalid name or version: \(name, privacy: .public) \(version)"
      )
      return
    }
    entries[name] = Entry(
      version: version,
      waitsUntilReady: waitsUntilReady,
      glass: glass
    ) { context in
      AnyView(content(context))
    }
  }

  public func unregister(_ name: String) {
    entries[name] = nil
  }

  public var registeredComponents: [String: Int] {
    entries.mapValues(\.version)
  }

  var capability: NativeCapability? {
    guard #available(iOS 26.0, *), !entries.isEmpty else { return nil }
    return NativeCapability(components: registeredComponents)
  }
}
