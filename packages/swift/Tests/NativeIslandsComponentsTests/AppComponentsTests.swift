import SwiftUI
import Testing
import UIKit
import UserNotifications
import WebKit
@testable import NativeIslands
@testable import NativeIslandsComponents

@MainActor
@Suite
struct AppComponentsTests {
  @Test("Keeps the tap that launched the app for the first notifications island")
  func keepsLaunchTap() {
    let relay = NotificationRelay { nil }
    relay.send("open", payload: ["id": "welcome", "data": NSNull()])
    relay.send("deliver", payload: ["id": "other", "data": NSNull()])
    #expect(relay.pendingOpen?["id"] as? String == "welcome")
    let mount = NativeMount(
      id: "notifications",
      component: "notifications",
      version: 1,
      props: [:],
      frame: NativeFrame(x: 0, y: 0, width: 1, height: 1),
      anchor: .page,
      visible: true,
      order: 0,
      sizing: .web,
      accessibility: nil,
      stateRevision: nil,
      reuse: nil
    )
    relay.add(NativeComponentContext(mount: mount, sequence: 1, waitsUntilReady: false, host: nil))
    #expect(relay.pendingOpen == nil)
  }

  @Test("Presents only pages from the presenting page's origin")
  func presentsSameOriginOnly() throws {
    let page = try #require(URL(string: "https://app.example.com/screens/sheets"))
    #expect(PresentationURL.resolve("detail?id=1", from: page)?.absoluteString == "https://app.example.com/screens/detail?id=1")
    #expect(PresentationURL.resolve("/sheet", from: page)?.absoluteString == "https://app.example.com/sheet")
    #expect(PresentationURL.resolve("https://evil.example.org/", from: page) == nil)
    #expect(PresentationURL.resolve("http://app.example.com/sheet", from: page) == nil)
    #expect(PresentationURL.resolve("https://app.example.com:8443/sheet", from: page) == nil)
    #expect(PresentationURL.resolve("sheet", from: nil) == nil)
    #expect(PresentationURL.resolve(nil, from: page) == nil)
    let bundled = try #require(URL(string: "file:///app/pages/index.html"))
    #expect(PresentationURL.resolve("sheet.html", from: bundled)?.absoluteString == "file:///app/pages/sheet.html")
  }

  @Test("Reads bar items, grouping runs of buttons between spaces")
  func readsBarItems() throws {
    let items = BarItem.list([
      ["id": "share", "systemImage": "square.and.arrow.up"],
      ["kind": "flexibleSpace"],
      ["id": "more", "systemImage": "ellipsis", "items": [["id": "a", "title": "A"]]],
      ["id": "edit", "title": "Edit", "prominent": true, "tint": "#ff0000", "disabled": true],
      ["id": "nothing"],
      "junk"
    ])
    #expect(items.map(\.id) == ["share", "flexibleSpace", "more", "edit"])
    #expect(items.map(\.kind) == [.button, .flexibleSpace, .menu, .button])
    let edit = try #require(items.last)
    #expect(edit.prominent && edit.disabled && edit.tint != nil)
    #expect(items[1].isSpace && !items[0].isSpace)
  }

  @Test("Reads tabs, or the titles and symbols of the first version")
  func readsTabs() {
    let tabs = TabBarView.Tab.list(NativeComponentProps([
      "tabs": .array([
        .object(["id": .string("inbox"), "title": .string("Inbox"), "systemImage": .string("tray"), "badge": .number(2)]),
        .object(["title": .string("Files"), "badge": .string("")]),
        .string("junk")
      ])
    ]))
    #expect(tabs == [
      .init(id: "inbox", title: "Inbox", symbol: "tray", badge: "2"),
      .init(id: "Files", title: "Files", symbol: "circle", badge: nil)
    ])
    let legacy = TabBarView.Tab.list(NativeComponentProps([
      "titles": .array([.string("A"), .string("B")]),
      "symbols": .array([.string("a")])
    ]))
    #expect(legacy.map(\.symbol) == ["a", "circle"])
  }

  @Test("Reads sections of rows, nested children and swipe actions")
  func readsLists() throws {
    let props = NativeComponentProps([
      "sections": .array([
        .object([
          "header": .string("Main"),
          "rows": .array([
            .object([
              "id": .string("wifi"),
              "title": .string("Wi-Fi"),
              "iconTint": .string("#0a84ff"),
              "badge": .number(3),
              "trailingActions": .array([.object(["id": .string("delete"), "title": .string("Delete"), "role": .string("destructive")])]),
              "children": .array([.object(["title": .string("Child")])])
            ]),
            .string("junk")
          ])
        ])
      ])
    ])
    let sections = ListSection.list(props)
    #expect(sections.map(\.id) == ["0"])
    let row = try #require(sections.first?.rows.first)
    #expect(row.badge == "3" && row.iconTint != nil)
    #expect(row.trailing.map(\.role) == ["destructive"])
    #expect(row.children.map(\.id) == ["Child"])
    let flat = ListSection.list(NativeComponentProps(["rows": .array([.object(["title": .string("A")])])]))
    #expect(flat.first?.rows.map(\.title) == ["A"])
  }

  @Test("Takes rows out at any depth, as a destructive swipe action does")
  func takesRowsOut() throws {
    let props = NativeComponentProps([
      "rows": .array([
        .object(["id": .string("a"), "title": .string("A")]),
        .object([
          "id": .string("b"),
          "title": .string("B"),
          "children": .array([.object(["id": .string("c"), "title": .string("C")])])
        ])
      ])
    ])
    let section = try #require(ListSection.list(props).first)
    #expect(section.contains("c") && section.contains("a") && !section.contains("z"))
    #expect(section.without([]).rowIds == ["a", "b"])
    #expect(section.without(["a"]).rowIds == ["b"])
    let nested = section.without(["c"])
    #expect(nested.rowIds == ["a", "b"] && nested.rows.last?.children.isEmpty == true)
    #expect(!nested.contains("c"))
  }

  @Test("Turns a page's haptic events into a Core Haptics pattern")
  func buildsHapticPatterns() {
    #expect(HapticPlayer.pattern(["events": []]) == nil)
    let pattern = HapticPlayer.pattern([
      "events": [
        ["time": 0, "intensity": 2, "sharpness": -1],
        ["time": 0.2, "kind": "continuous", "duration": 0.5, "attack": 0.1, "decay": 0.2],
        "junk"
      ]
    ])
    #expect(pattern != nil)
    #expect(pattern?.duration ?? 0 >= 0.7)
  }

  @Test("Builds local notification requests from the page's fields")
  func buildsNotifications() throws {
    #expect(NotificationsView.request(["title": "No id"]) == nil)
    let soon = try #require(NotificationsView.request([
      "id": "a", "title": "Hi", "body": "There", "after": 5, "badge": 2, "threadId": "t", "data": ["x": 1]
    ]))
    #expect(soon.content.body == "There" && soon.content.badge == 2)
    #expect((soon.trigger as? UNTimeIntervalNotificationTrigger)?.timeInterval == 5)
    let repeating = try #require(NotificationsView.request(["id": "b", "title": "B", "repeats": true, "sound": false]))
    #expect((repeating.trigger as? UNTimeIntervalNotificationTrigger)?.timeInterval == 60)
    #expect(repeating.content.sound == nil)
    let dated = try #require(NotificationsView.request(["id": "c", "title": "C", "date": "2030-01-02T09:30"]))
    #expect((dated.trigger as? UNCalendarNotificationTrigger)?.dateComponents.hour == 9)
  }

  @Test("Reads sheet detents as medium, large or a height")
  func readsDetents() {
    #expect(SheetDetents.detent("medium") != nil)
    #expect(SheetDetents.detent("large") != nil)
    #expect(SheetDetents.detent("240") != nil)
    #expect(SheetDetents.detent("tall") == nil)
    #expect(SheetDetents.identifier("240").rawValue == "240")
    #expect(SheetDetents.name(of: .medium) == "medium")
    #expect(SheetDetents.name(of: .large) == "large")
    #expect(SheetDetents.name(of: .init("240")) == "240")
    #expect(SheetDetents.name(of: nil) == nil)
  }

  @Test("Tells the height UIKit gives large and a height in points")
  @available(iOS 16.0, *)
  func resolvesDetentHeights() throws {
    var heights: [CGFloat] = []
    let context = DetentContext(maximumDetentValue: 778)
    let large = try #require(SheetDetents.detent("large") { heights.append($0) })
    #expect(large.identifier == .large)
    #expect(large.resolvedValue(in: context) == 778)
    let points = try #require(SheetDetents.detent("240") { heights.append($0) })
    #expect(points.resolvedValue(in: context) == 240)
    #expect(heights == [778, 240])
  }

  @Test("Routes a presented page's messages, and gives it the system header")
  func presentedPage() throws {
    let page = PresentedPageController(
      url: try #require(URL(string: "about:blank")),
      configuration: WKWebViewConfiguration(),
      style: "sheet",
      background: .red
    )
    var heard: [String] = []
    page.onDismissRequest = { heard.append("dismiss \($0 as? String ?? "?")") }
    page.onMessage = { heard.append("message \($0 as? Int ?? 0)") }
    page.onDetentRequest = { heard.append("detent \($0)") }
    page.receive(["type": "dismiss", "result": "done"])
    page.receive(["type": "message", "data": 1])
    page.receive(["type": "detent", "detent": "medium"])
    page.receive(["type": "detent"])
    page.receive(["type": "other"])
    page.receive("not a message")
    #expect(heard == ["dismiss done", "message 1", "detent medium"])

    let navigation = PresentationNavigationController(rootViewController: page)
    page.loadViewIfNeeded()
    #expect(page.view.backgroundColor == .red)
    // The page runs under the bar and its own scroll view is the sheet's
    // content, so a drag scrolls the page before it moves the sheet.
    #expect(page.edgesForExtendedLayout == .all)
    #expect(page.contentScrollView(for: .top) === page.webView.scrollView)
    #expect(page.webView.scrollView.contentInsetAdjustmentBehavior == .automatic)
    var done = false
    page.onDone = { done = true }
    let item = try #require(page.navigationItem.rightBarButtonItem)
    item.primaryAction?.performWithSender(nil, target: nil)
    #expect(done)
    page.showsDone = false
    #expect(page.navigationItem.rightBarButtonItem == nil)
    page.detent = "large"
    page.detent = "large"
    #expect(navigation.viewControllers == [page])
    page.close()
  }

  @Test("Loads a page ahead of time behind the app, out of reach")
  func preloadsBehindTheApp() throws {
    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
    window.rootViewController = UIViewController()
    window.makeKeyAndVisible()
    let page = PresentedPageController(
      url: try #require(URL(string: "about:blank")),
      configuration: WKWebViewConfiguration(),
      style: "fullScreenCover",
      background: nil
    )
    page.preload(in: window, size: window.bounds.size)
    #expect(page.view.superview === window)
    #expect(window.subviews.first === page.view)
    #expect(page.view.frame.size == window.bounds.size)
    #expect(!page.view.isUserInteractionEnabled)
    #expect(page.view.accessibilityElementsHidden)
    page.close()
    #expect(page.view.superview == nil)
  }

  @Test("Runs what follows a dismissal at once when nothing is shown")
  func dismissesNothing() {
    var done = 0
    PresentationView.Coordinator.dismiss(nil, animated: false) { done += 1 }
    PresentationView.Coordinator.dismiss(UIViewController(), animated: false) { done += 1 }
    #expect(done == 2)
  }

  @Test("Draws glass for glass materials only")
  func materialGlass() {
    #expect(MaterialView.glass(NativeComponentProps(["material": .string("thin")])) == nil)
    let glass = MaterialView.glass(NativeComponentProps(["material": .string("clearGlass"), "cornerRadius": .number(12)]))
    #expect(glass?.style == .clear)
    #expect(glass?.shape == .rounded(12))
  }

  @Test("Reads colours the page nested in an item as hex or rgb()")
  func readsNestedColours() {
    #expect(NativeComponentProps.color(css: "#ff000080") == Color(.sRGB, red: 1, green: 0, blue: 0, opacity: 128 / 255))
    #expect(NativeComponentProps.color(css: "#0f0") == Color(.sRGB, red: 0, green: 1, blue: 0, opacity: 1))
    #expect(NativeComponentProps.color(css: "#12345") == nil)
    #expect(NativeComponentProps.color(css: "rgb(0, 0, 255)") == Color(.sRGB, red: 0, green: 0, blue: 1, opacity: 1))
  }
}

/// A detent resolution context with a given maximum, as UIKit passes one.
private final class DetentContext: NSObject, UISheetPresentationControllerDetentResolutionContext {
  let containerTraitCollection = UITraitCollection()
  let maximumDetentValue: CGFloat

  init(maximumDetentValue: CGFloat) {
    self.maximumDetentValue = maximumDetentValue
  }
}
