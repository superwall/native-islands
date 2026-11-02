import SwiftUI

/// The native views a page may draw in place of its web elements.
///
/// A page using `@superwall/native-islands` wraps a web element in a native
/// component, such as `<GlassButton>` or one defined with
/// `defineNativeComponent("rating")`. When the app registered a component of
/// that name, at that version or later, the host draws the registered SwiftUI
/// view over the element and the web copy fades out. Otherwise the page keeps
/// its web version, so a component never has to exist for a page to work.
///
/// Register before attaching a ``NativeIslandsHost``: a page learns what is
/// available when its document starts.
///
/// ```swift
/// NativeComponentRegistry.shared.register("rating") { component in
///   RatingView(
///     value: component.props.int("value") ?? 0,
///     onChange: { component.emit("change", payload: $0) }
///   )
/// }
/// ```
///
/// The host offers the built-in components, `glassButton`,
/// `closeButton`, `toggle`, `segmentedControl` and `symbol`, without any
/// registration. Register a name again to draw your own view instead, or
/// unregister it to keep the web version.
///
/// Native components need iOS 26 or later. On earlier versions no component is
/// offered and every page shows its web version.
@MainActor
public final class NativeComponentRegistry {
  /// The registry hosts use unless given another, with the built-ins registered.
  public static let shared = NativeComponentRegistry()

  struct Entry {
    let version: Int
    let waitsUntilReady: Bool
    let glass: (@MainActor (NativeComponentProps) -> NativeGlass?)?
    let make: @MainActor (NativeComponentContext) -> AnyView
  }

  private(set) var entries: [String: Entry] = [:]

  /// Creates a registry, with the built-in components unless `includingBuiltIns` is `false`.
  public init(includingBuiltIns: Bool = true) {
    if includingBuiltIns {
      NativeBuiltIns.register(in: self)
    }
  }

  /// Registers the view to draw for the page component `name`.
  ///
  /// - Parameters:
  ///   - name: The name the page uses, such as `"rating"`. Registering a
  ///     name again replaces the earlier view.
  ///   - version: The version of the component's props this view understands.
  ///     A page asking for a later version keeps its web version.
  ///     Defaults to `1`.
  ///   - waitsUntilReady: Pass `true` when the view needs time before it can
  ///     be shown, such as an image or animation that loads. The page keeps
  ///     its web version until the view calls
  ///     ``NativeComponentContext/ready()``. Defaults to `false`.
  ///   - glass: Puts the view on Liquid Glass drawn by the host, chosen from
  ///     the props each time they change; return `nil` for no glass. Views
  ///     on glass whose props share a `glassGroup` string merge and morph
  ///     like system glass. Defaults to no glass.
  ///   - content: Builds the view. It runs again whenever the page changes
  ///     the component's props.
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

  /// Removes the view registered for `name`. Pages that start afterwards
  /// show their web version for it.
  public func unregister(_ name: String) {
    entries[name] = nil
  }

  /// Every registered component and its version.
  public var registeredComponents: [String: Int] {
    entries.mapValues(\.version)
  }

  /// What a page is told it may ask for, or `nil` when it may ask for
  /// nothing: no component is registered, or the OS is older than iOS 26.
  var capability: NativeCapability? {
    guard #available(iOS 26.0, *), !entries.isEmpty else { return nil }
    return NativeCapability(components: registeredComponents)
  }
}
