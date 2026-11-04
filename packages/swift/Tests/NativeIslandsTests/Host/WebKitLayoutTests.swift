import Foundation
import Testing
import UIKit
import WebKit
@testable import NativeIslands

/// What the host assumes about the views WebKit builds for a page, checked
/// against the WebKit of the runtime the tests run on. With
/// `WEBKIT_TREE_DIR` set (`TEST_RUNNER_WEBKIT_TREE_DIR` through xcodebuild),
/// the view tree is written there as JSON for `scripts/webkit-tree-diff.ts`.
extension NativeBridgeTests {
  @Suite(.serialized)
  @MainActor
  struct WebKitLayoutTests {
    struct Element: Decodable {
      let rect: [Double]
      let box: [Double]
      let content: [Double]
      let offset: [Double]
      let child: [Double]?
    }

    struct Page: Decodable {
      let content: [Double]
      let offset: [Double]
    }

    struct Measure: Decodable {
      let elements: [String: Element]
      let page: Page
      let userAgent: String
    }

    /// Where the page is scrolled while the probes in it are measured: WebKit
    /// only keeps views for what is near the visible rect.
    static let stops: [(scrollY: CGFloat, scrollers: [String], layers: [String])] = [
      (0, ["list", "list-scrolled", "nested-outer", "nested-inner", "horizontal", "sticky", "fixed", "transformed", "isolated"], ["cover", "animated-child"]),
      (600, ["contents", "route", "fixed"], []),
      (1900, ["parked", "parked-twin", "fixed"], [])
    ]

    /// 25 ms apart: the first page after launch waits for WebKit's processes.
    static let attempts = 1200

    struct Probe {
      let webView: WKWebView
      let window: UIWindow
    }

    private func loaded() async throws -> Probe {
      let frame = CGRect(origin: .zero, size: WebKitLayoutFixture.viewport)
      let webView = WKWebView(frame: frame)
      let window = UIWindow(frame: frame)
      window.addSubview(webView)
      window.isHidden = false
      webView.loadHTMLString(WebKitLayoutFixture.html, baseURL: nil)
      // A runtime's first web view after a cold boot can wait most of a minute
      // for its WebContent process.
      try await until(seconds: 120) {
        (try? await webView.evaluateJavaScript("typeof window.probe") as? String) == "function"
      }
      // The scroll view takes the document's size only once WebKit commits its
      // first layers; an offset set before that is clamped to zero.
      try await until(seconds: 30) {
        let measured = try await measure(webView)
        return abs(webView.scrollView.contentSize.height - measured.page.content[1]) <= 1
      }
      return Probe(webView: webView, window: window)
    }

    private func until(seconds: TimeInterval, _ condition: () async throws -> Bool) async throws {
      let deadline = Date().addingTimeInterval(seconds)
      while Date() < deadline, try await !condition() {
        try await Task.sleep(nanoseconds: 25_000_000)
      }
      try #require(try await condition())
    }

    private func measure(_ webView: WKWebView) async throws -> Measure {
      let json = try #require(try await webView.evaluateJavaScript("window.probe()") as? String)
      return try JSONDecoder().decode(Measure.self, from: Data(json.utf8))
    }

    private func scroll(_ webView: WKWebView, to y: CGFloat) async throws {
      try await until(seconds: 30) {
        if abs(webView.scrollView.contentOffset.y - y) >= 1 {
          webView.scrollView.setContentOffset(CGPoint(x: 0, y: y), animated: false)
        }
        let measured = try await measure(webView)
        return abs((measured.page.offset.last ?? -1) - y) < 1
      }
      // WebKit holds an animation back until its box scrolls into view, so the
      // route slides in only once its stop is reached.
      try await until(seconds: 30) {
        let script = "document.getAnimations().every(a => a.playState !== 'running')"
        return try await webView.evaluateJavaScript(script) as? Bool == true
      }
    }

    static func scroller(_ element: Element) -> NativeScroller {
      NativeScroller(
        id: "",
        frame: NativeFrame(x: element.box[0], y: element.box[1], width: element.box[2], height: element.box[3]),
        contentSize: NativeSize(width: element.content[0], height: element.content[1]),
        scrollOffset: NativePoint(x: element.offset[0], y: element.offset[1])
      )
    }

    private func matches(_ measured: Measure, _ ids: [String], in webView: WKWebView) -> [String: UIScrollView] {
      let candidates = NativeScrollerMatcher.candidates(in: webView.scrollView)
      var found: [String: UIScrollView] = [:]
      for id in ids {
        guard let element = measured.elements[id] else { continue }
        found[id] = NativeScrollerMatcher.match(Self.scroller(element), among: candidates, in: webView)
      }
      return found
    }

    /// Scrolls to each stop and hands over its scrollers, matched the way the
    /// host matches them once the page settled there, while the page is still
    /// at that stop.
    private func eachStop(
      _ webView: WKWebView,
      _ body: (_ stop: Int, _ measured: Measure, _ found: [String: UIScrollView]) throws -> Void
    ) async throws {
      for (index, stop) in Self.stops.enumerated() {
        try await scroll(webView, to: stop.scrollY)
        var measured = try await measure(webView)
        var found = matches(measured, stop.scrollers, in: webView)
        for _ in 0..<Self.attempts where found.count < stop.scrollers.count {
          try await Task.sleep(nanoseconds: 25_000_000)
          measured = try await measure(webView)
          found = matches(measured, stop.scrollers, in: webView)
        }
        try body(index, measured, found)
      }
    }

    @Test
    func theWebViewsScrollViewIsThePageAndItsContentIsTheDocument() async throws {
      let probe = try await loaded()
      defer { probe.window.isHidden = true }
      try await scroll(probe.webView, to: 600)
      let measured = try await measure(probe.webView)
      let scrollView = probe.webView.scrollView
      #expect(abs(scrollView.contentOffset.y - 600) < 1)
      #expect(abs(scrollView.contentSize.width - measured.page.content[0]) <= 1)
      #expect(abs(scrollView.contentSize.height - measured.page.content[1]) <= 1)
      #expect(scrollView.adjustedContentInset == .zero)
      let cover = try #require(measured.elements["cover"])
      let marker = UIView(frame: CGRect(x: cover.rect[0], y: cover.rect[1] + 600, width: cover.rect[2], height: cover.rect[3]))
      scrollView.addSubview(marker)
      defer { marker.removeFromSuperview() }
      #expect(Self.near(marker.convert(marker.bounds, to: probe.webView), cover.rect))
    }

    @Test
    func everyScrollingAreaHasItsOwnScrollViewUnderThePage() async throws {
      let probe = try await loaded()
      defer { probe.window.isHidden = true }
      var seen: [String: UIScrollView] = [:]
      try await eachStop(probe.webView) { index, _, found in
        for id in Self.stops[index].scrollers {
          let scrollView = found[id]
          #expect(scrollView != nil, "WebKit built no scroll view the matcher finds for \(id)")
          guard let scrollView else { continue }
          #expect(scrollView !== probe.webView.scrollView)
          #expect(scrollView.isDescendant(of: probe.webView.scrollView))
          if let earlier = seen[id] {
            #expect(earlier === scrollView, "\(id) changed scroll view when the page scrolled")
          }
          seen[id] = scrollView
        }
      }
      let distinct = Set(seen.values.map(ObjectIdentifier.init))
      #expect(distinct.count == seen.count, "two scrolling areas matched one scroll view")
    }

    @Test
    func aViewInAScrollViewLandsOnItsElement() async throws {
      let probe = try await loaded()
      defer { probe.window.isHidden = true }
      try await eachStop(probe.webView) { _, measured, found in
        for (id, scrollView) in found {
          let element = try #require(measured.elements[id])
          let child = try #require(element.child)
          let marker = UIView(frame: CGRect(
            x: child[0] - element.box[0] + element.offset[0],
            y: child[1] - element.box[1] + element.offset[1],
            width: child[2],
            height: child[3]
          ))
          scrollView.addSubview(marker)
          let drawn = marker.convert(marker.bounds, to: probe.webView)
          marker.removeFromSuperview()
          #expect(Self.near(drawn, child), "\(id): a view at its first child's spot is drawn at \(drawn), the child is at \(child)")
        }
      }
    }

    @Test
    func aParkedScreenGetsItsOwnScrollViewOffToTheSide() async throws {
      let probe = try await loaded()
      defer { probe.window.isHidden = true }
      var last: [String: UIScrollView] = [:]
      try await eachStop(probe.webView) { _, _, found in last = found }
      let found = last
      let parked = try #require(found["parked"])
      let twin = try #require(found["parked-twin"])
      #expect(parked !== twin)
      #expect(parked.convert(parked.bounds, to: probe.webView).minX >= WebKitLayoutFixture.viewport.width - 1)
      #expect(abs(twin.convert(twin.bounds, to: probe.webView).minX) < 1)
    }

    @Test
    func boxesWebKitDrawsAboveAScrollerComeAfterItsScrollView() async throws {
      let probe = try await loaded()
      defer { probe.window.isHidden = true }
      try await eachStop(probe.webView) { index, measured, found in
        guard index == 0 else { return }
        let order = Self.drawingOrder(probe.webView)
        let list = try #require(found["list"])
        let cover = try #require(measured.elements["cover"])
        let coverView = try #require(Self.view(in: order, at: cover.rect, of: probe.webView), "WebKit built no view for a composited box")
        #expect(!coverView.isDescendant(of: list))
        let listIndex = try #require(order.firstIndex { $0 === list })
        let coverIndex = try #require(order.firstIndex { $0 === coverView })
        #expect(coverIndex > listIndex, "a box later in the page is drawn under an earlier scroller")

        let isolated = try #require(found["isolated"])
        let child = try #require(measured.elements["animated-child"])
        let childView = Self.view(in: order, at: child.rect, of: probe.webView)
        #expect(childView?.isDescendant(of: isolated) == true, "a composited box inside a scroller left its scroll view")
      }
    }

    @Test
    func writesTheViewTree() async throws {
      let probe = try await loaded()
      defer { probe.window.isHidden = true }
      guard let directory = ProcessInfo.processInfo.environment["WEBKIT_TREE_DIR"], !directory.isEmpty else { return }
      var probes: [ObjectIdentifier: String] = [:]
      var userAgent = ""
      try await eachStop(probe.webView) { index, measured, found in
        for (id, scrollView) in found { probes[ObjectIdentifier(scrollView)] = id }
        userAgent = measured.userAgent
        for id in Self.stops[index].layers {
          guard let element = measured.elements[id],
                let view = Self.view(in: Self.drawingOrder(probe.webView), at: element.rect, of: probe.webView) else { continue }
          probes[ObjectIdentifier(view)] = id
        }
      }
      try await scroll(probe.webView, to: 0)
      let tree = WebKitViewTree(
        system: UIDevice.current.systemVersion,
        build: WebKitViewTree.build(of: ProcessInfo.processInfo.operatingSystemVersionString),
        userAgent: userAgent,
        viewport: [Double(WebKitLayoutFixture.viewport.width), Double(WebKitLayoutFixture.viewport.height)],
        root: WebKitViewTree.Node(probe.webView, in: probe.webView, probes: probes)
      )
      let encoder = JSONEncoder()
      encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
      let url = URL(fileURLWithPath: directory).appendingPathComponent(tree.fileName)
      try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
      try encoder.encode(tree).write(to: url)
    }

    @Test
    func namesEachRuntimesTreeByVersionAndBuild() {
      #expect(WebKitViewTree.build(of: "Version 27.2 (Build 24B114)") == "24B114")
      #expect(WebKitViewTree.build(of: "Version 27.2") == nil)
      #expect(WebKitViewTree.build(of: "Version 27.2 (Build 24B114") == nil)
      let root = WebKitViewTree.Node(UIView(), in: UIView(), probes: [:])
      let tree = WebKitViewTree(system: "27.2", build: "24B114", userAgent: "", viewport: [], root: root)
      #expect(tree.fileName == "ios-27.2-24B114.json")
      let unknown = WebKitViewTree(system: "17.5", build: nil, userAgent: "", viewport: [], root: root)
      #expect(unknown.fileName == "ios-17.5.json")
    }

    static func drawingOrder(_ root: UIView) -> [UIView] {
      [root] + root.subviews.flatMap(drawingOrder)
    }

    /// The first view WebKit built for a composited box at `rect`.
    static func view(in order: [UIView], at rect: [Double], of webView: WKWebView) -> UIView? {
      order.first { !($0 is UIScrollView) && near($0.convert($0.bounds, to: webView), rect) }
    }

    static func near(_ rect: CGRect, _ expected: [Double]) -> Bool {
      zip([rect.minX, rect.minY, rect.width, rect.height], expected).allSatisfy { abs($0 - $1) <= 1 }
    }
  }
}

/// The views WebKit built for the fixture page, as `scripts/webkit-tree-diff.ts`
/// reads them. Frames are in the web view's coordinates.
struct WebKitViewTree: Encodable {
  struct Node: Encodable {
    let type: String
    let frame: [Double]
    let probe: String?
    let scroll: [Double]?
    let hidden: Bool
    let children: [Node]

    @MainActor
    init(_ view: UIView, in root: UIView, probes: [ObjectIdentifier: String]) {
      type = String(describing: Swift.type(of: view))
      let rect = view.convert(view.bounds, to: root)
      frame = Self.halfPoints([rect.minX, rect.minY, rect.width, rect.height])
      probe = probes[ObjectIdentifier(view)]
      if let scrollView = view as? UIScrollView {
        scroll = Self.halfPoints([
          scrollView.contentSize.width, scrollView.contentSize.height,
          scrollView.contentOffset.x, scrollView.contentOffset.y
        ])
      } else {
        scroll = nil
      }
      hidden = view.isHidden
      children = view.subviews.map { Node($0, in: root, probes: probes) }
    }

    static func halfPoints(_ values: [CGFloat]) -> [Double] {
      values.map { Double(($0 * 2).rounded() / 2) }
    }
  }

  let system: String
  let build: String?
  let userAgent: String
  let viewport: [Double]
  let root: Node

  /// One file per runtime: two runtimes can share a version, like an iOS 27.2
  /// seed and its release.
  var fileName: String {
    ["ios", system, build].compactMap { $0 }.joined(separator: "-") + ".json"
  }

  /// The build in `ProcessInfo.operatingSystemVersionString`, such as
  /// "Version 27.2 (Build 24B114)".
  static func build(of description: String) -> String? {
    guard let start = description.range(of: "Build ")?.upperBound,
          let end = description[start...].firstIndex(of: ")") else { return nil }
    return String(description[start..<end])
  }
}
