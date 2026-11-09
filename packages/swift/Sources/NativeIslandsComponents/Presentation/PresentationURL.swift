import Foundation

/// Which page a presentation may load.
enum PresentationURL {
  /// The page to present, read relative to the presenting page. Only a page
  /// of the presenting page's own origin is presented: the presented web view
  /// shares the presenting configuration, with its message handlers, so a
  /// page from anywhere else would be handed the app's bridge.
  static func resolve(_ string: String?, from presenter: URL?) -> URL? {
    guard let string, let presenter,
      let url = URL(string: string, relativeTo: presenter)?.absoluteURL
    else { return nil }
    let sameOrigin = url.scheme?.lowercased() == presenter.scheme?.lowercased()
      && url.host?.lowercased() == presenter.host?.lowercased()
      && url.port == presenter.port
    guard sameOrigin else {
      NativeIslandsComponents.logger.error(
        "Not presenting \(url.absoluteString, privacy: .public): it is not from the presenting page's origin."
      )
      return nil
    }
    return url
  }
}
