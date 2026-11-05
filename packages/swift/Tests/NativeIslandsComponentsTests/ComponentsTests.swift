import SwiftUI
import Testing
import UIKit
@testable import NativeIslands
@testable import NativeIslandsCharts
@testable import NativeIslandsComponents
@testable import NativeIslandsMaps

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
      "gauge": 1,
      "video": 1,
      "camera": 1,
      "photoPicker": 1,
      "shareButton": 1,
      "hapticButton": 1,
      "permission": 1,
      "tip": 1
    ])
  }

  @Test("Registers the map and the chart from their own libraries")
  func registersTheOptInLibraries() {
    let registry = NativeComponentRegistry()
    NativeIslandsMaps.register(in: registry)
    NativeIslandsCharts.register(in: registry)
    #expect(registry.registeredComponents == ["map": 1, "chart": 1])
    #expect([NativeIslandsMaps.name, NativeIslandsCharts.name] == ["map", "chart"])
    #expect(NativeIslandsCharts.isAvailable)
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
    for name in ["photoPicker", "shareButton", "hapticButton"] {
      #expect(registry.entries[name]?.glass?(props) == NativeGlass(shape: .capsule))
    }
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
    let optIn = NativeComponentRegistry()
    NativeIslandsMaps.register(in: optIn)
    NativeIslandsCharts.register(in: optIn)
    for name in ["map", "chart"] {
      #expect(optIn.entries[name]?.make(context) != nil)
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

@MainActor
@Suite
struct ChartDataTests {
  private func props(_ values: [String: NativeValue]) -> NativeComponentProps {
    NativeComponentProps(values)
  }

  private func series(_ id: String, _ points: [(NativeValue, Double)], extra: [String: NativeValue] = [:]) -> NativeValue {
    var object = extra
    object["id"] = .string(id)
    object["points"] = .array(points.map { .object(["x": $0.0, "y": .number($0.1)]) })
    return .object(object)
  }

  @Test("Reads series, axes and options, with their defaults")
  func readsEverything() {
    let data = ChartData(props: props([
      "kind": .string("line"),
      "series": .array([
        series("run", [(.string("Mon"), 4), (.string("Tue"), 6)], extra: ["name": .string("Running")]),
        series("ride", [(.string("Mon"), 10)], extra: ["kind": .string("bar"), "color": .string("#ff9500")])
      ]),
      "xAxis": .object(["title": .string("Day")]),
      "yAxis": .object([
        "title": .string("km"), "min": .number(0), "max": .number(20),
        "format": .string("currency"), "currency": .string("EUR")
      ]),
      "stacked": .bool(true),
      "smooth": .bool(false)
    ]))
    #expect(data.series.map(\.name) == ["Running", "ride"])
    #expect(data.series.map(\.kind) == [.line, .bar])
    #expect(data.series[1].color == Color(.sRGB, red: 1, green: 149 / 255, blue: 0, opacity: 1))
    #expect(data.xType == .category)
    #expect(data.xTitle == "Day")
    #expect((data.yTitle, data.yMin, data.yMax) == ("km", 0, 20))
    #expect(data.format == .currency && data.currency == "EUR")
    #expect(data.stacked && !data.smooth && data.legend)
    let empty = ChartData(props: props([:]))
    #expect(empty.series.isEmpty && empty.smooth && !empty.legend && empty.format == .number)
  }

  @Test("Reads numbers and ISO dates on their axes, and skips points that are not")
  func readsAxisTypes() throws {
    let numbers = ChartData(props: props([
      "xAxis": .object(["type": .string("number")]),
      "series": .array([series("a", [(.number(2), 1), (.string("x"), 2)]), .string("nope")])
    ]))
    #expect(numbers.points.map(\.x) == [.number(2)])
    let dates = ChartData(props: props([
      "xAxis": .object(["type": .string("date")]),
      "series": .array([
        series("a", [
          (.string("2026-11-04"), 1), (.string("2026-11-05T10:00:00Z"), 2),
          (.string("2026-11-06T10:00:00.250Z"), 3), (.string("soon"), 4)
        ])
      ])
    ]))
    #expect(dates.points.count == 3)
    let day = try #require(dates.points.first?.x)
    #expect(day.page as? String == "2026-11-04")
    let categories = ChartData(props: props(["series": .array([series("a", [(.number(3), 1)])])]))
    #expect(categories.points.first?.x == .category("3"))
  }

  @Test("Tells the page the x under the finger and each series' value there")
  func selection() {
    let data = ChartData(props: props([
      "series": .array([
        series("run", [(.string("Mon"), 4)]),
        series("ride", [(.string("Mon"), 10), (.string("Tue"), 1)])
      ])
    ]))
    let mon = data.selection(at: .category("Mon"))
    #expect(mon["x"] as? String == "Mon")
    #expect((mon["values"] as? [[String: Any]])?.compactMap { $0["series"] as? String } == ["run", "ride"])
    #expect(data.selection(at: nil)["x"] is NSNull)
    #expect(data.nearest(.category("Tue")) == .category("Tue"))
    #expect(data.nearest(.category("Sun")) == nil)
    let numbers = ChartData(props: props([
      "xAxis": .object(["type": .string("number")]),
      "series": .array([series("a", [(.number(1), 1), (.number(5), 1)])])
    ]))
    #expect(numbers.nearest(.number(4)) == .number(5))
    #expect(numbers.nearest(.category("1")) == nil)
    let first = Date(timeIntervalSince1970: 0)
    let dates = ChartData.XValue.date(first)
    #expect(ChartData(props: props([:])).nearest(dates) == nil)
  }

  @Test("Formats the y axis as numbers, percentages or money")
  func formats() {
    var data = ChartData(props: props([:]))
    #expect(data.formatted(1200) == 1200.formatted(.number))
    data.format = .percent
    #expect(data.formatted(0.25) == 0.25.formatted(.percent))
    data.format = .currency
    #expect(data.formatted(3) == 3.0.formatted(.currency(code: "USD")))
  }

  @Test("Reads hex and rgb() colours, and nothing else")
  func colors() {
    #expect(ChartData.color("#f00") == Color(.sRGB, red: 1, green: 0, blue: 0, opacity: 1))
    #expect(ChartData.color("#ff000080") == Color(.sRGB, red: 1, green: 0, blue: 0, opacity: 128 / 255))
    #expect(ChartData.color("rgb(0 0 255 / 0.5)") == Color(.sRGB, red: 0, green: 0, blue: 1, opacity: 0.5))
    #expect(ChartData.color("rgb(0, 255, 0)") == Color(.sRGB, red: 0, green: 1, blue: 0, opacity: 1))
    #expect(ChartData.color("#12") == nil)
    #expect(ChartData.color("rgb(1 2)") == nil)
    #expect(ChartData.color("red") == nil)
  }
}

@MainActor
@Suite
struct TipTests {
  @available(iOS 17.0, *)
  @Test("Builds TipKit's tip from the page's props")
  func readsTheTip() throws {
    let tip = PageTip(props: NativeComponentProps([
      "id": .string("favorites"),
      "title": .string("Save it"),
      "message": .string("Tap the star."),
      "systemImage": .string("star"),
      "actions": .array([
        .object(["id": .string("learn"), "title": .string("Learn More")]),
        .object(["id": .string("broken")])
      ])
    ]))
    #expect(tip.id == "favorites")
    #expect(tip.message != nil && tip.image != nil)
    #expect(tip.actions.map(\.id) == ["learn"])
    let bare = PageTip(props: NativeComponentProps([:]))
    #expect(bare.id == "tip" && bare.message == nil && bare.image == nil && bare.actions.isEmpty)
    #expect(["top", "bottom", "leading", "trailing", "none"].map(TipIslandView.edge) == [
      .top, .bottom, .leading, .trailing, nil
    ])
  }
}
