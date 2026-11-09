import SwiftUI
import Testing
import UIKit
@testable import NativeIslands
@testable import NativeIslandsCharts
@testable import NativeIslandsComponents
@testable import NativeIslandsMaps

/// One element VoiceOver can focus, as it reads it.
struct SpokenElement: CustomStringConvertible {
  let label: String
  let value: String
  let traits: UIAccessibilityTraits

  var description: String {
    "\(label)|\(value)|\(traits.rawValue)"
  }
}

/// What VoiceOver reaches in an island: the elements it can focus in reading
/// order, the island's own node, and the UIKit views it walks through on the
/// way. UIKit's controls describe their parts through accessibility bundles a
/// test process cannot load, so a test of one checks the island hands VoiceOver
/// the control rather than reading the control's parts.
struct SpokenIsland {
  var elements: [SpokenElement] = []
  var node: NSObject?
  var views: [UIView] = []

  func view<View: UIView>(_: View.Type) -> View? {
    views.lazy.compactMap { $0 as? View }.first
  }
}

/// Walks the `UIAccessibilityContainer` API the way VoiceOver does.
@MainActor
private func spokenIsland(in view: UIView) -> SpokenIsland {
  var island = SpokenIsland()
  island.node = (view.accessibilityElements as? [NSObject])?.first
  func visit(_ object: NSObject) {
    if let view = object as? UIView { island.views.append(view) }
    if object.accessibilityElementsHidden { return }
    if object.isAccessibilityElement {
      island.elements.append(
        SpokenElement(
          label: object.accessibilityLabel ?? "",
          value: object.accessibilityValue ?? "",
          traits: object.accessibilityTraits
        )
      )
      return
    }
    if let elements = object.accessibilityElements as? [NSObject] {
      elements.forEach(visit)
      return
    }
    let count = object.accessibilityElementCount()
    if count > 0, count != NSNotFound {
      for index in 0..<count {
        if let element = object.accessibilityElement(at: index) as? NSObject {
          visit(element)
        }
      }
      return
    }
    if let view = object as? UIView {
      view.subviews.forEach(visit)
    }
  }
  visit(view)
  return island
}

// SwiftUI builds its accessibility tree, and hands a label to the UIKit
// control it hosts, only once an assistive technology starts, so the tests
// start one the way XCUITest does and give it a moment to come up.
@MainActor
private var accessibilityStarted: Task<Void, Never>?

@MainActor
private func startAccessibility() async {
  if accessibilityStarted == nil {
    accessibilityStarted = Task { @MainActor in
      typealias SetEnabled = @convention(c) (Int32) -> Void
      let library = dlopen("/usr/lib/libAccessibility.dylib", RTLD_NOW)
      for name in ["_AXSSetAutomationEnabled", "_AXSApplicationAccessibilitySetEnabled"] {
        if let setter = dlsym(library, name) {
          unsafeBitCast(setter, to: SetEnabled.self)(1)
        }
      }
      let root = ProcessInfo.processInfo.environment["IPHONE_SIMULATOR_ROOT"] ?? ""
      _ = dlopen(root + "/System/Library/PrivateFrameworks/UIAccessibility.framework/UIAccessibility", RTLD_NOW)
      if let loader = NSClassFromString("UIAccessibilityLoader") as? NSObject.Type {
        _ = loader.perform(NSSelectorFromString("_accessibilityStartServer"))
      }
      try? await Task.sleep(nanoseconds: 1_000_000_000)
    }
  }
  await accessibilityStarted?.value
}

@MainActor
@Suite
struct ComponentAccessibilityTests {
  /// Draws `component` as the host would, from its registration, and walks
  /// what VoiceOver reaches once `ready` holds or the island settles.
  private func spoken(
    _ component: String,
    props: [String: NativeValue] = [:],
    accessibility: NativeAccessibility? = nil,
    size: CGSize = CGSize(width: 390, height: 120),
    ready: (SpokenIsland) -> Bool = { !$0.elements.isEmpty }
  ) async -> SpokenIsland {
    await startAccessibility()
    let registry = NativeComponentRegistry()
    NativeIslandsComponents.register(in: registry)
    NativeIslandsMaps.register(in: registry)
    NativeIslandsCharts.register(in: registry)
    guard let entry = registry.entries[component] else { return SpokenIsland() }
    let mount = NativeMount(
      id: component,
      component: component,
      version: 1,
      props: props,
      frame: NativeFrame(x: 0, y: 0, width: size.width, height: size.height),
      anchor: .page,
      visible: true,
      order: 0,
      sizing: .web,
      accessibility: accessibility,
      stateRevision: nil,
      reuse: nil
    )
    let context = NativeComponentContext(mount: mount, sequence: 1, waitsUntilReady: false, host: nil)
    let host = UIHostingController(
      rootView: NativeIslandRoot(
        context: context,
        make: entry.make,
        accessibilityChildren: entry.accessibilityChildren,
        outlines: NativeIslandOutlines()
      )
    )
    let window = UIWindow(frame: CGRect(origin: .zero, size: size))
    let root = UIViewController()
    window.rootViewController = root
    window.makeKeyAndVisible()
    root.addChild(host)
    host.view.frame = window.bounds
    root.view.addSubview(host.view)
    host.didMove(toParent: root)
    defer {
      host.view.removeFromSuperview()
      window.isHidden = true
    }
    var island = SpokenIsland()
    for _ in 0..<30 {
      host.view.layoutIfNeeded()
      try? await Task.sleep(nanoseconds: 20_000_000)
      island = spokenIsland(in: host.view)
      if ready(island) { break }
    }
    return island
  }

  private static func strings(_ values: [String]) -> NativeValue {
    .array(values.map(NativeValue.string))
  }

  private static func objects(_ values: [[String: NativeValue]]) -> NativeValue {
    .array(values.map(NativeValue.object))
  }

  /// The island's own node is a group the page's label names, not one element.
  private func expectGroup(_ island: SpokenIsland, named label: String, sourceLocation: SourceLocation = #_sourceLocation) {
    #expect(island.node?.isAccessibilityElement == false, sourceLocation: sourceLocation)
    #expect(island.node?.accessibilityLabel == label, sourceLocation: sourceLocation)
  }

  @Test("Groups multi-control islands as containers and single controls as one element")
  func registersTheGrouping() {
    let registry = NativeComponentRegistry()
    NativeIslandsComponents.register(in: registry)
    NativeIslandsMaps.register(in: registry)
    NativeIslandsCharts.register(in: registry)
    let containers: Set = [
      "segmentedControl", "picker", "datePicker", "tip", "tabBar", "tabAccessory", "searchField",
      "navigationBar", "toolbar", "list", "presentation", "alert", "haptics", "notifications", "map", "chart"
    ]
    for (name, entry) in registry.entries {
      #expect(entry.accessibilityChildren == (containers.contains(name) ? .contain : .combine), "\(name)")
    }
  }

  @Test("Hands VoiceOver the segmented control, so each segment is reached on its own")
  func segments() async {
    let island = await spoken(
      "segmentedControl",
      props: ["segments": Self.strings(["Day", "Week", "Month"]), "selectedIndex": .number(1)],
      accessibility: NativeAccessibility(label: "Range", value: "Week")
    ) { $0.view(UISegmentedControl.self) != nil }
    expectGroup(island, named: "Range")
    let control = island.view(UISegmentedControl.self)
    #expect(control?.numberOfSegments == 3)
    #expect(control?.selectedSegmentIndex == 1)
  }

  @Test("Hands VoiceOver the tab bar, so each tab is reached on its own")
  func tabs() async {
    let tabs: [[String: NativeValue]] = ["Inbox", "Files", "Profile"].map {
      ["id": .string($0), "title": .string($0), "systemImage": .string("tray")]
    }
    let island = await spoken(
      "tabBar",
      props: ["tabs": Self.objects(tabs), "selectedId": .string("Files")],
      accessibility: NativeAccessibility(label: "Tabs"),
      size: CGSize(width: 390, height: 83)
    ) { $0.view(UITabBar.self) != nil }
    expectGroup(island, named: "Tabs")
    let bar = island.view(UITabBar.self)
    #expect(bar?.items?.map(\.title) == ["Inbox", "Files", "Profile"])
    #expect(bar?.selectedItem?.title == "Files")
  }

  @Test("Reads each toolbar button on its own")
  func toolbar() async {
    let items: [[String: NativeValue]] = [
      ["id": .string("share"), "title": .string("Share"), "systemImage": .string("square.and.arrow.up")],
      ["kind": .string("flexibleSpace")],
      ["id": .string("edit"), "title": .string("Edit")]
    ]
    let island = await spoken("toolbar", props: ["items": Self.objects(items)], accessibility: NativeAccessibility(label: "Edit"))
    #expect(island.elements.map(\.label) == ["Share", "Edit"], "\(island.elements)")
    #expect(island.elements.allSatisfy { $0.traits.contains(.button) })
  }

  @Test("Reads the back button, the title and the trailing button of a navigation bar")
  func navigationBar() async {
    let island = await spoken(
      "navigationBar",
      props: [
        "title": .string("Photos"),
        "showsBack": .bool(true),
        "trailing": Self.objects([["id": .string("select"), "title": .string("Select")]])
      ],
      accessibility: NativeAccessibility(label: "Photos")
    )
    let elements = island.elements
    #expect(elements.map(\.label) == ["Back", "Photos", "Select"], "\(elements)")
    guard elements.count == 3 else { return }
    #expect(elements[0].traits.contains(.button))
    #expect(elements[1].traits.contains(.header))
    #expect(elements[2].traits.contains(.button))
  }

  @Test("Reads each list row on its own")
  func list() async {
    let rows: [[String: NativeValue]] = ["Lena", "Build bot", "Sam"].map { ["id": .string($0), "title": .string($0)] }
    let island = await spoken(
      "list",
      props: ["rows": Self.objects(rows)],
      accessibility: NativeAccessibility(label: "LenaBuild botSam"),
      size: CGSize(width: 390, height: 400)
    ) { $0.elements.count >= 3 }
    #expect(island.elements.map(\.label) == ["Lena", "Build bot", "Sam"], "\(island.elements)")
  }

  @Test(
    "Names a picker's own control by the page's label, so its value and adjusting stay native",
    arguments: [("menu", UIButton.self), ("wheel", UIPickerView.self)] as [(String, UIView.Type)]
  )
  func picker(style: String, control: UIView.Type) async {
    let island = await spoken(
      "picker",
      props: ["options": Self.strings(["Vanilla", "Pistachio"]), "selectedIndex": .number(1), "style": .string(style)],
      accessibility: NativeAccessibility(label: "Flavour", hint: "Pick one"),
      size: CGSize(width: 390, height: 216)
    ) { island in island.views.contains { type(of: $0) == control || $0.isKind(of: control) } }
    expectGroup(island, named: "Flavour")
    let view = island.views.first { $0.isKind(of: control) }
    #expect(view?.accessibilityLabel == "Flavour")
    #expect(view?.accessibilityHint == "Pick one")
  }

  @Test("Names a date picker's own control by the page's label, in every style", arguments: ["compact", "wheel", "graphical"])
  func datePicker(style: String) async {
    let island = await spoken(
      "datePicker",
      props: ["date": .string("2026-11-09T07:30"), "style": .string(style)],
      accessibility: NativeAccessibility(label: "Date"),
      size: CGSize(width: 390, height: style == "compact" ? 44 : 360)
    ) { $0.view(UIDatePicker.self) != nil }
    expectGroup(island, named: "Date")
    #expect(island.view(UIDatePicker.self)?.accessibilityLabel == "Date")
  }

  @Test("Leaves a picker's control unnamed when the page sends no label")
  func unlabelledPicker() async {
    let island = await spoken(
      "datePicker",
      props: ["date": .string("2026-11-09T07:30")],
      accessibility: NativeAccessibility(label: ""),
      size: CGSize(width: 390, height: 44)
    ) { $0.view(UIDatePicker.self) != nil }
    #expect(island.view(UIDatePicker.self)?.accessibilityLabel?.isEmpty ?? true)
  }

  @Test("Reads a toggle as one element with its label and its on or off")
  func toggle() async {
    let island = await spoken(
      "toggle",
      props: ["isOn": .bool(true)],
      accessibility: NativeAccessibility(label: "Airplane Mode", traits: ["switch"])
    )
    #expect(island.elements.count == 1, "\(island.elements)")
    #expect(island.elements.first?.label == "Airplane Mode")
    #expect(island.elements.first?.value == "1")
  }

  @Test("Reads a slider as one adjustable element with its value")
  func slider() async {
    let island = await spoken(
      "slider",
      props: ["value": .number(0.6)],
      accessibility: NativeAccessibility(label: "Brightness")
    )
    #expect(island.elements.count == 1, "\(island.elements)")
    #expect(island.elements.first?.label == "Brightness")
    #expect(island.elements.first?.value.isEmpty == false)
    #expect(island.elements.first?.traits.contains(.adjustable) == true)
  }

  // The notifications island asks the notification centre for its status,
  // which a test process without an app bundle cannot reach; it draws the
  // same nothing the haptics one does.
  @Test("Leaves nothing to focus for an island that draws nothing")
  func drawsNothing() async {
    let island = await spoken("haptics", accessibility: NativeAccessibility())
    #expect(island.elements.isEmpty, "\(island.elements)")
  }
}
