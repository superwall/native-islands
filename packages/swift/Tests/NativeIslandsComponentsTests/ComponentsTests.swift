import SwiftUI
import Testing
import UIKit
@testable import NativeIslands
@testable import NativeIslandsComponents

@MainActor
@Suite
struct RegistrationTests {
  @Test("Registers every ready-made component under the name its web twin uses")
  func registersEverything() {
    let registry = NativeComponentRegistry()
    NativeIslandsComponents.register(in: registry)
    #expect(registry.registeredComponents == [
      "glassButton": 1,
      "closeButton": 1,
      "menu": 1,
      "toggle": 1,
      "segmentedControl": 1,
      "slider": 1,
      "stepper": 1,
      "picker": 1,
      "datePicker": 1,
      "colorPicker": 1,
      "textField": 1,
      "symbol": 1,
      "symbolEffect": 1,
      "gauge": 1
    ])
  }

  @Test("Registers only the components asked for")
  func registersASubset() {
    let registry = NativeComponentRegistry()
    NativeIslandsComponents.register(in: registry, only: [.toggle, .glassButton])
    #expect(registry.registeredComponents == ["toggle": 1, "glassButton": 1])
  }

  @Test("Gives the buttons and the menu their glass, and the rest none")
  func setsGlass() {
    let registry = NativeComponentRegistry()
    NativeIslandsComponents.register(in: registry)
    let props = NativeComponentProps(["title": .string("Go")])
    #expect(registry.entries["glassButton"]?.glass?(props) == NativeGlass(shape: .capsule))
    #expect(registry.entries["menu"]?.glass?(props) == NativeGlass(shape: .capsule))
    #expect(registry.entries["closeButton"]?.glass?(props) == NativeGlass(shape: .circle))
    #expect(registry.entries["toggle"]?.glass == nil)
  }

  @Test("Lets the app replace a ready-made component it registers afterwards")
  func appRegistrationWins() {
    let registry = NativeComponentRegistry()
    NativeIslandsComponents.register(in: registry)
    registry.register("toggle", version: 2) { _ in Color.clear }
    #expect(registry.registeredComponents["toggle"] == 2)
    #expect(registry.registeredComponents.count == NativeIslandsComponents.Component.allCases.count)
  }

  @Test("Draws each component it registered")
  func drawsEachComponent() {
    let registry = NativeComponentRegistry()
    NativeIslandsComponents.register(in: registry, only: [.symbol, .stepper])
    let mount = NativeMount(
      id: "a",
      component: "symbol",
      version: 1,
      props: [:],
      frame: NativeFrame(x: 0, y: 0, width: 44, height: 44),
      anchor: .page,
      visible: true,
      order: 0,
      sizing: .web,
      accessibility: nil,
      stateRevision: nil,
      reuse: nil
    )
    let context = NativeComponentContext(mount: mount, sequence: 1, waitsUntilReady: false, host: nil)
    #expect(registry.entries["symbol"]?.make(context) != nil)
    #expect(registry.entries["stepper"]?.make(context) != nil)
    for component in NativeIslandsComponents.Component.allCases {
      _ = NativeIslandsComponents.ComponentView(component: component, context: context).body
    }
  }

  @Test("Offers every component on this iOS")
  func everyComponentIsAvailable() {
    #expect(NativeIslandsComponents.Component.allCases.filter { !$0.isAvailable }.isEmpty)
  }
}

@MainActor
@Suite
struct GlassPresetTests {
  @Test("A button with only an icon is round")
  func iconOnlyIsRound() {
    let props = NativeComponentProps(["systemImage": .string("plus")])
    #expect(NativeIslandsComponents.buttonGlass(props).shape == .circle)
  }

  @Test("A prominent button takes its tint in full, a tinted one lightly")
  func tints() {
    let prominent = NativeComponentProps(["prominence": .string("prominent"), "tint": .string("rgb(255, 0, 0)")])
    let tinted = NativeComponentProps(["tint": .string("rgb(255, 0, 0)")])
    #expect(alpha(NativeIslandsComponents.buttonGlass(prominent).tint) == 1)
    #expect(alpha(NativeIslandsComponents.buttonGlass(tinted).tint) == 0.3)
    #expect(alpha(NativeIslandsComponents.closeButtonGlass(tinted).tint) == 0.3)
  }

  private func alpha(_ color: UIColor?) -> Double? {
    var alpha: CGFloat = 0
    guard let color, color.getRed(nil, green: nil, blue: nil, alpha: &alpha) else { return nil }
    return (Double(alpha) * 100).rounded() / 100
  }

  @Test("A disabled button's glass does not react to touches")
  func disabledIsNotInteractive() {
    let props = NativeComponentProps(["title": .string("Go"), "disabled": .bool(true)])
    #expect(NativeIslandsComponents.buttonGlass(props).isInteractive == false)
  }

  @Test("Prominent titles are dark on a light tint and white on a dark one")
  func ink() {
    #expect(GlassButtonView.ink(on: .white) == Color(white: 0.08))
    #expect(GlassButtonView.ink(on: .black) == .white)
    #expect(GlassButtonView.ink(on: nil) == .white)
  }
}

@MainActor
@Suite
struct PropDecodingTests {
  @Test("Reads menu items, their submenus and checkmarks")
  func menuItems() throws {
    let item = try #require(MenuView.Item([
      "title": "Sort",
      "systemImage": "arrow.up.arrow.down",
      "children": [
        ["id": "name", "title": "Name", "checked": true],
        ["title": "Delete", "destructive": true],
        ["id": "broken"]
      ]
    ]))
    #expect(item.id == "Sort")
    #expect(item.systemImage == "arrow.up.arrow.down")
    #expect(item.children.map(\.id) == ["name", "Delete"])
    #expect(item.children[0].checked == true)
    #expect(item.children[1].destructive)
    #expect(MenuView.Item(["id": "untitled"]) == nil)
  }

  @Test("Keeps dates as local minutes, the format the page sends")
  func dateFormat() throws {
    let date = try #require(DatePickerView.format.date(from: "2026-11-04T18:30"))
    #expect(DatePickerView.format.string(from: date) == "2026-11-04T18:30")
    #expect(DatePickerView.format.date(from: "2026-11-04") == nil)
  }

  @Test("Writes colours as lowercase hex")
  func colorHex() {
    #expect(ColorPickerView.hex(Color(red: 1, green: 0.5, blue: 0)) == "#ff8000")
  }

  @Test("Knows every symbol weight the page can ask for")
  func symbolWeights() {
    #expect(NativeIslandsComponents.weights.count == 9)
    #expect(NativeIslandsComponents.weights["semibold"] == .semibold)
  }
}
