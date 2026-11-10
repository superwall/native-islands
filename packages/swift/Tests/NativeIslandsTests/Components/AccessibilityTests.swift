import SwiftUI
import Testing
import UIKit
@testable import NativeIslands

/// One element VoiceOver can focus, as it reads it.
struct SpokenElement: Equatable, CustomStringConvertible {
  let label: String
  let value: String
  let traits: UIAccessibilityTraits

  var description: String {
    "\(label)|\(value)|\(traits.rawValue)"
  }
}

/// Walks the `UIAccessibilityContainer` API the way VoiceOver does, and lists
/// the elements it can focus in reading order.
@MainActor
func spokenElements(in view: UIView) -> [SpokenElement] {
  var found: [SpokenElement] = []
  func visit(_ object: NSObject) {
    if object.accessibilityElementsHidden { return }
    if object.isAccessibilityElement {
      found.append(
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
  return found
}

// SwiftUI builds its accessibility tree only while an assistive technology
// asks for it, so the tests turn on the switch XCUITest uses.
@MainActor
private let automationAccessibility: Void = {
  guard
    let library = dlopen("/usr/lib/libAccessibility.dylib", RTLD_NOW),
    let setter = dlsym(library, "_AXSSetAutomationEnabled")
  else { return }
  typealias SetEnabled = @convention(c) (Int32) -> Void
  unsafeBitCast(setter, to: SetEnabled.self)(1)
}()

/// Puts `view` on screen and lets SwiftUI build its accessibility tree.
@MainActor
func spokenElements(onScreen view: UIView, size: CGSize = CGSize(width: 390, height: 120)) async -> [SpokenElement] {
  automationAccessibility
  let window = UIWindow(frame: CGRect(origin: .zero, size: size))
  let root = UIViewController()
  window.rootViewController = root
  window.makeKeyAndVisible()
  view.frame = window.bounds
  root.view.addSubview(view)
  defer {
    view.removeFromSuperview()
    window.isHidden = true
  }
  var elements: [SpokenElement] = []
  for _ in 0..<20 {
    view.layoutIfNeeded()
    try? await Task.sleep(nanoseconds: 20_000_000)
    elements = spokenElements(in: view)
    if !elements.isEmpty { break }
  }
  return elements
}

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct AccessibilityTests {
    private func spoken(
      _ component: String,
      children: NativeAccessibilityChildren,
      accessibility: NativeAccessibility?,
      @ViewBuilder content: @escaping @MainActor (NativeComponentContext) -> some View
    ) async -> [SpokenElement] {
      let harness = NativeTestHarness()
      harness.registry.register(component, accessibilityChildren: children, content: content)
      // VoiceOver reads the native view only on the screen layer.
      harness.manager.apply(
        batch(1, mountOp("a", component: component, anchor: .screen, accessibility: accessibility))
      )
      guard let island = harness.island("a") else { return [] }
      return await spokenElements(onScreen: island.host.view)
    }

    private static func segments(_: NativeComponentContext) -> some View {
      HStack {
        Button("Day") {}
        Button("Week") {}.accessibilityAddTraits(.isSelected)
        Button("Month") {}
      }
    }

    private static func toggle(_: NativeComponentContext) -> some View {
      Toggle("", isOn: .constant(true)).labelsHidden()
    }

    @Test("Registers as one element unless asked otherwise")
    func defaultsToCombine() {
      let registry = NativeComponentRegistry()
      registry.register("plain") { _ in Color.clear }
      registry.register("bar", accessibilityChildren: .contain) { _ in Color.clear }
      #expect(registry.entries["plain"]?.accessibilityChildren == .combine)
      #expect(registry.entries["bar"]?.accessibilityChildren == .contain)
    }

    @Test("Keeps each control of a containing island its own element")
    func containKeepsEachControl() async {
      let elements = await spoken(
        "segments",
        children: .contain,
        accessibility: NativeAccessibility(label: "Range", value: "Week", traits: ["button"]),
        content: Self.segments
      )
      #expect(elements.map(\.label) == ["Day", "Week", "Month"], "\(elements)")
      guard elements.count == 3 else { return }
      #expect(elements.allSatisfy { $0.traits.contains(.button) })
      #expect(elements.allSatisfy { $0.value.isEmpty })
      #expect(elements[1].traits.contains(.selected))
      #expect(!elements[0].traits.contains(.selected))
    }

    @Test("Merges a combining island into one element named by the page")
    func combineMakesOneElement() async {
      let elements = await spoken(
        "segments",
        children: .combine,
        accessibility: NativeAccessibility(label: "Range"),
        content: Self.segments
      )
      #expect(elements.count == 1, "\(elements)")
      #expect(elements.first?.label == "Range")
    }

    @Test("Keeps a control's own value when the page sends none")
    func keepsTheNativeValue() async {
      let elements = await spoken(
        "toggle",
        children: .combine,
        accessibility: NativeAccessibility(label: "Airplane Mode", hint: "", value: ""),
        content: Self.toggle
      )
      #expect(elements.count == 1, "\(elements)")
      #expect(elements.first?.label == "Airplane Mode")
      #expect(elements.first?.value == "1")
    }

    @Test("Uses the page's value when it sends one")
    func overridesWithThePageValue() async {
      let elements = await spoken(
        "toggle",
        children: .combine,
        accessibility: NativeAccessibility(label: "Wi-Fi", value: "Home"),
        content: Self.toggle
      )
      #expect(elements.first?.value == "Home")
    }

    @Test("Hides an island the page hides, whatever its grouping")
    func hidesWhatThePageHides() async {
      for children in [NativeAccessibilityChildren.combine, .contain] {
        let elements = await spoken(
          "segments",
          children: children,
          accessibility: NativeAccessibility(hidden: true),
          content: Self.segments
        )
        #expect(elements.isEmpty)
      }
    }

    @Test("Reads every trait the page sends")
    func mapsEveryTrait() {
      let traits = NativeAccessibilityModifier.traits(for: ["button", "link", "image", "header", "selected", "switch", "x"])
      #expect(traits.contains(.isButton))
      #expect(traits.contains(.isLink))
      #expect(traits.contains(.isImage))
      #expect(traits.contains(.isHeader))
      #expect(traits.contains(.isSelected))
      if #available(iOS 17, *) {
        #expect(traits.contains(.isToggle))
      }
      #expect(!NativeAccessibilityModifier.traits(for: ["switch"]).isEmpty)
    }
  }
}
