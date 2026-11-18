import Foundation
import SwiftUI
import Testing
import UIKit
import WebKit
@testable import NativeIslands

/// Two same-size screens as `tests/pages` lays them out: the shown one at the
/// left edge and a parked one a row of screens to the right, each scrolling on
/// its own. The web view is see-through and slides up while the islands go in,
/// as a Superwall paywall does when it is presented.
extension NativeBridgeTests {
  @Suite(.serialized)
  @MainActor
  struct WebKitRouteTests {
    static let viewport = CGSize(width: 390, height: 844)
    static let parkedX = 390.0 * 17

    static let html = """
      <!doctype html>
      <html>
      <head>
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
      <style>
        body { margin: 0; overflow: hidden; height: 100vh; }
        .route { position: absolute; top: 0; width: 390px; height: 844px; overflow-y: auto; }
        .content { background: linear-gradient(#fff, #99f); }
      </style>
      </head>
      <body>
        <section class="route" id="shown" style="left: 0"><div class="content" style="height: 1017px"></div></section>
        <section class="route" id="parked" style="left: \(Int(parkedX))px"><div class="content" style="height: 920px"></div></section>
        <script>
          window.measure = (id) => {
            const route = document.getElementById(id);
            const box = route.getBoundingClientRect();
            return JSON.stringify([box.left, box.top, box.width, box.height, route.scrollWidth, route.scrollHeight]);
          };
          window.grow = (id, height) => {
            document.querySelector('#' + id + ' .content').style.height = height + 'px';
            return window.measure(id);
          };
        </script>
      </body>
      </html>
      """

    struct Page {
      let webView: WKWebView
      let window: UIWindow
      let surface: WebViewSurface
    }

    private func loaded() async throws -> Page {
      let frame = CGRect(origin: .zero, size: Self.viewport)
      let window = UIWindow(frame: frame)
      let webView = WKWebView(frame: frame.offsetBy(dx: 0, dy: frame.height / 3))
      webView.isOpaque = false
      webView.backgroundColor = .clear
      window.addSubview(webView)
      window.isHidden = false
      webView.loadHTMLString(Self.html, baseURL: nil)
      try await until(seconds: 120) {
        (try? await webView.evaluateJavaScript("typeof window.measure") as? String) == "function"
      }
      let surface = WebViewSurface(webView: webView)
      try await until(seconds: 30) {
        let shown = try await scroller("shown", in: webView)
        let parked = try await scroller("parked", in: webView)
        return match(shown, in: surface) != nil && match(parked, in: surface) != nil
      }
      return Page(webView: webView, window: window, surface: surface)
    }

    private func until(seconds: TimeInterval, _ condition: () async throws -> Bool) async throws {
      let deadline = Date().addingTimeInterval(seconds)
      while Date() < deadline, try await !condition() {
        try await Task.sleep(nanoseconds: 25_000_000)
      }
      try #require(try await condition())
    }

    private func scroller(_ id: String, in webView: WKWebView, grownTo height: Int? = nil) async throws -> NativeScroller {
      let script = height.map { "window.grow('\(id)', \($0))" } ?? "window.measure('\(id)')"
      let json = try #require(try await webView.evaluateJavaScript(script) as? String)
      let box = try JSONDecoder().decode([Double].self, from: Data(json.utf8))
      return NativeScroller(
        id: id,
        frame: NativeFrame(x: box[0], y: box[1], width: box[2], height: box[3]),
        contentSize: NativeSize(width: box[4], height: box[5]),
        scrollOffset: NativePoint(x: 0, y: 0)
      )
    }

    private func match(_ scroller: NativeScroller, in surface: WebViewSurface) -> UIScrollView? {
      NativeScrollerMatcher.match(
        scroller,
        among: NativeScrollerMatcher.candidates(in: surface.pageScrollView),
        in: surface.viewport,
        within: NativeScrollerMatcher.reach(of: scroller)
      )
    }

    @Test
    func eachIslandStaysInItsOwnRoutesScrollViewWhileTheWebViewSlidesIn() async throws {
      let page = try await loaded()
      let registry = NativeComponentRegistry()
      registry.register("toggle") { _ in Color.clear.frame(width: 51, height: 31) }
      var retries: [@MainActor () -> Void] = []
      let manager = NativeIslandManager(
        registry: registry,
        surface: page.surface,
        send: { _ in },
        retry: { retries.append($0) }
      )
      let shown = try await scroller("shown", in: page.webView)
      let parked = try await scroller("parked", in: page.webView)
      let shownView = try #require(match(shown, in: page.surface))
      let parkedView = try #require(match(parked, in: page.surface))
      #expect(shownView !== parkedView)

      UIView.animate(withDuration: 0.6) {
        page.webView.frame = CGRect(origin: .zero, size: Self.viewport)
      }
      manager.apply(batch(
        1,
        mountOp("own", component: "toggle", frame: NativeFrame(x: 20, y: 40, width: 51, height: 31), anchor: .scroller(shown)),
        mountOp("parked", component: "toggle", frame: NativeFrame(x: 20, y: 40, width: 51, height: 31), anchor: .scroller(parked))
      ))
      #expect(manager.islands["own"]?.view.superview === shownView)
      #expect(manager.islands["parked"]?.view.superview === parkedView)

      // The parked page grows to a height within a point of the shown one's.
      // The page reports it at once; WebKit resizes the scroll view later.
      let grown = try await scroller("parked", in: page.webView, grownTo: 1016)
      manager.apply(batch(2, .update(NativeUpdate(id: "parked", anchor: .scroller(grown)))))
      withKnownIssue("SW-499: a parked island follows a same-size scroll view at any distance") {
        #expect(manager.islands["parked"]?.view.superview === parkedView)
        #expect(manager.islands["parked"]?.view.superview !== shownView)
      }

      try await until(seconds: 30) { abs(parkedView.contentSize.height - 1016) < 1 }
      for _ in 0..<NativeIslandManager.parkingAttempts where !retries.isEmpty {
        let work = retries
        retries.removeAll()
        work.forEach { $0() }
      }
      #expect(manager.islands["own"]?.view.superview === shownView)
      withKnownIssue("SW-499: a parked island follows a same-size scroll view at any distance") {
        #expect(manager.islands["parked"]?.view.superview === parkedView)
      }
      _ = page.window
    }
  }
}
