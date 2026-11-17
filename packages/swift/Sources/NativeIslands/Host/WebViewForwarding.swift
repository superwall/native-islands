import ObjectiveC
import UIKit
import WebKit

/// Gives a web view the app doesn't subclass the two calls ``IslandWebView``
/// overrides, for ``NativeIslandsHost/attach(to:registry:reveal:)``.
///
/// It installs `hitTest(_:with:)` and `didMoveToWindow()` once on the web
/// view's class. Each forwards to the host attached to that one web view and
/// otherwise runs what the class ran before, so the class's other web views
/// behave as they did.
@MainActor
enum WebViewForwarding {
  private static var hostKey: UInt8 = 0
  private static var installed: Set<ObjectIdentifier> = []
  private static var forwarding: Set<ObjectIdentifier> = []

  static func host(of webView: WKWebView) -> NativeIslandsHost? {
    objc_getAssociatedObject(webView, &hostKey) as? NativeIslandsHost
  }

  /// Keeps `host` alive with `webView` and forwards to it, or stops with `nil`.
  static func set(_ host: NativeIslandsHost?, on webView: WKWebView) {
    objc_setAssociatedObject(webView, &hostKey, host, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
    if host != nil {
      install(on: ownClass(of: webView))
    }
  }

  /// The web view's class, under the subclass key-value observing swaps in
  /// while something observes it: that one goes away with the last observer.
  static func ownClass(of webView: WKWebView) -> AnyClass {
    var current: AnyClass = object_getClass(webView) ?? WKWebView.self
    while NSStringFromClass(current).hasPrefix("NSKVONotifying_"), let superclass = class_getSuperclass(current) {
      current = superclass
    }
    return current
  }

  static func isInstalled(on cls: AnyClass) -> Bool {
    installed.contains(ObjectIdentifier(cls))
  }

  private static func install(on cls: AnyClass) {
    guard installed.insert(ObjectIdentifier(cls)).inserted else { return }
    override(#selector(UIView.hitTest(_:with:)), in: cls, with: hitTest)
    override(#selector(UIView.didMoveToWindow), in: cls, with: didMoveToWindow)
  }

  private static func forwardingHost(of webView: WKWebView) -> NativeIslandsHost? {
    forwarding.contains(ObjectIdentifier(webView)) ? nil : host(of: webView)
  }

  private static func forward<T>(_ webView: WKWebView, _ work: () -> T) -> T {
    let id = ObjectIdentifier(webView)
    forwarding.insert(id)
    defer { forwarding.remove(id) }
    return work()
  }

  // MARK: - Overrides

  private typealias Original = () -> IMP?
  private typealias HitTestIMP = @convention(c) (AnyObject, Selector, CGPoint, UIEvent?) -> UIView?
  private typealias DidMoveIMP = @convention(c) (AnyObject, Selector) -> Void

  private nonisolated static func hitTest(_ original: @escaping Original) -> Any {
    let selector = #selector(UIView.hitTest(_:with:))
    let block: @convention(block) (WKWebView, CGPoint, UIEvent?) -> UIView? = { webView, point, event in
      MainActor.assumeIsolated {
        let webHit = { () -> UIView? in
          guard let imp = original() else { return nil }
          return unsafeBitCast(imp, to: HitTestIMP.self)(webView, selector, point, event)
        }
        guard let host = forwardingHost(of: webView) else { return webHit() }
        return forward(webView) {
          host.hitTest(point, with: event, webHit: webHit) ?? webHit()
        }
      }
    }
    return block
  }

  private nonisolated static func didMoveToWindow(_ original: @escaping Original) -> Any {
    let selector = #selector(UIView.didMoveToWindow)
    let block: @convention(block) (WKWebView) -> Void = { webView in
      MainActor.assumeIsolated {
        let callOriginal = {
          guard let imp = original() else { return }
          unsafeBitCast(imp, to: DidMoveIMP.self)(webView, selector)
        }
        guard let host = forwardingHost(of: webView) else { return callOriginal() }
        forward(webView) {
          callOriginal()
          host.webViewDidMoveToWindow()
        }
      }
    }
    return block
  }

  /// Installs the block `make` returns as `selector` on `cls`. `make` gets
  /// what `cls` ran before: its own method when it has one, or else its
  /// superclass's, looked up at each call so later changes there still apply.
  private static func override(_ selector: Selector, in cls: AnyClass, with make: (@escaping Original) -> Any) {
    guard let method = class_getInstanceMethod(cls, selector) else { return }
    let types = method_getTypeEncoding(method)
    let superclass: AnyClass? = class_getSuperclass(cls)
    let inherited = imp_implementationWithBlock(make { class_getMethodImplementation(superclass, selector) })
    if class_addMethod(cls, selector, inherited, types) {
      return
    }
    imp_removeBlock(inherited)
    let own = method_getImplementation(method)
    method_setImplementation(method, imp_implementationWithBlock(make { own }))
  }
}
