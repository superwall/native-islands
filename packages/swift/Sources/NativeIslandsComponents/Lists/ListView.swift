import NativeIslands
import SwiftUI

/// A native list whose rows come from props: `sections` of `rows`, each with
/// a title, subtitle, symbol, value, badge and accessory, swipe actions on
/// either edge, and `children` that make it a disclosure group, nested to any
/// depth as an outline. Rows hold no web content.
///
/// - A tap sends `press` with the row's id; with `selectionMode` it also
///   toggles the row in `selected`, which flows back as state.
/// - A swipe action sends `action` with the row and the action's id.
/// - With `editing`, rows of a `reorderable` list drag to reorder and rows of
///   a `deletable` one delete; both send `reorder` or `delete` and hand back
///   the new `sections` as state, so the list keeps its order until the page
///   answers.
/// - Opening a disclosure group puts its id in `expanded`.
/// - The height its rows take flows back as `contentHeight`, so the page can
///   give the list exactly that room.
struct ListView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let props = component.props
    let sections = ListSection.list(props)
    let selected = Set(props.strings("selected") ?? [])
    let expanded = Set(props.strings("expanded") ?? [])
    let editing = props.bool("editing") == true
    styled(
      List {
        ForEach(sections) { section in
          Section {
            ForEach(section.rows) { row in
              RowTree(row: row, selected: selected, expanded: expanded, list: self)
            }
            .onMove(perform: props.bool("reorderable") == true ? { move(section.id, $0, $1) } : nil)
            .onDelete(perform: props.bool("deletable") == true ? { delete(section.id, $0) } : nil)
          } header: {
            if let header = section.header { Text(header) }
          } footer: {
            if let footer = section.footer { Text(footer) }
          }
        }
      },
      style: props.string("style")
    )
    .environment(\.editMode, .constant(editing ? .active : .inactive))
    .tint(props.color("tint"))
    .scrollDismissesKeyboardIfAvailable()
    .hiddenScrollBackground()
    .background(ContentHeightReader { height in
      guard abs((component.props.double("contentHeight") ?? 0) - height) >= 0.5 else { return }
      component.setState(["contentHeight": height])
    })
  }

  @ViewBuilder
  private func styled(_ list: some View, style: String?) -> some View {
    switch style {
    case "plain": list.listStyle(.plain)
    case "grouped": list.listStyle(.grouped)
    case "sidebar": list.listStyle(.sidebar)
    default: list.listStyle(.insetGrouped)
    }
  }

  func press(_ row: ListRow) {
    let props = component.props
    switch props.string("selectionMode") {
    case "single":
      component.setState(["selected": [row.id]])
    case "multiple":
      var selected = props.strings("selected") ?? []
      if let index = selected.firstIndex(of: row.id) { selected.remove(at: index) } else { selected.append(row.id) }
      component.setState(["selected": selected])
    default: break
    }
    component.emit("press", payload: ["id": row.id])
  }

  func swiped(_ row: ListRow, _ action: ListAction) {
    component.emit("action", payload: ["row": row.id, "id": action.id])
  }

  func setExpanded(_ id: String, _ open: Bool) {
    var expanded = component.props.strings("expanded") ?? []
    expanded.removeAll { $0 == id }
    if open { expanded.append(id) }
    component.setState(["expanded": expanded])
    component.emit("expand", payload: ["id": id, "expanded": open])
  }

  private func move(_ section: String, _ source: IndexSet, _ destination: Int) {
    edit(section) { rows in rows.move(fromOffsets: source, toOffset: destination) } report: { ids in
      component.emit("reorder", payload: ["section": section, "ids": ids])
    }
  }

  private func delete(_ section: String, _ offsets: IndexSet) {
    var removed: [String] = []
    edit(section) { rows in
      removed = offsets.compactMap { rows[safe: $0]?["id"] as? String }
      rows.remove(atOffsets: offsets)
    } report: { _ in
      component.emit("delete", payload: ["section": section, "ids": removed])
    }
  }

  /// Changes one section's rows as the page wrote them, and hands the new
  /// sections back as state.
  private func edit(_ section: String, change: (inout [[String: Any]]) -> Void, report: ([String]) -> Void) {
    var raw = ListSection.raw(component.props)
    guard let index = raw.firstIndex(where: { ($0["id"] as? String ?? "") == section }) else { return }
    var rows = (raw[index]["rows"] as? [Any] ?? []).compactMap { $0 as? [String: Any] }
    change(&rows)
    raw[index]["rows"] = rows
    component.setState(["sections": raw])
    report(rows.compactMap { $0["id"] as? String })
  }
}

/// A row, and its children as a disclosure group.
private struct RowTree: View {
  let row: ListRow
  let selected: Set<String>
  let expanded: Set<String>
  let list: ListView

  var body: some View {
    if row.children.isEmpty {
      cell
    } else {
      DisclosureGroup(
        isExpanded: Binding(get: { expanded.contains(row.id) }, set: { list.setExpanded(row.id, $0) })
      ) {
        ForEach(row.children) { child in
          RowTree(row: child, selected: selected, expanded: expanded, list: list)
        }
      } label: {
        cell
      }
    }
  }

  private var cell: some View {
    Button {
      list.press(row)
    } label: {
      RowLabel(row: row, checked: selected.contains(row.id))
    }
    .disabled(row.disabled)
    .swipeActions(edge: .trailing, allowsFullSwipe: row.trailing.first?.role == "destructive") {
      ForEach(row.trailing) { action in actionButton(action) }
    }
    .swipeActions(edge: .leading) {
      ForEach(row.leading) { action in actionButton(action) }
    }
  }

  private func actionButton(_ action: ListAction) -> some View {
    Button(role: action.role == "destructive" ? .destructive : nil) {
      list.swiped(row, action)
    } label: {
      if let symbol = action.systemImage {
        Label(action.title, systemImage: symbol)
      } else {
        Text(action.title)
      }
    }
    .tint(action.tint)
  }
}

private struct RowLabel: View {
  let row: ListRow
  let checked: Bool

  var body: some View {
    HStack(spacing: 12) {
      if let symbol = row.systemImage {
        Image(systemName: symbol)
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(row.iconTint == nil ? Color.accentColor : .white)
          .frame(width: 29, height: 29)
          .background {
            if let tint = row.iconTint {
              RoundedRectangle(cornerRadius: 7, style: .continuous).fill(tint)
            }
          }
      }
      VStack(alignment: .leading, spacing: 2) {
        Text(row.title)
          .foregroundStyle(row.role == "destructive" ? Color.red : Color(uiColor: .label))
        if let subtitle = row.subtitle {
          Text(subtitle)
            .font(.subheadline)
            .foregroundStyle(Color(uiColor: .secondaryLabel))
        }
      }
      Spacer(minLength: 8)
      if let value = row.value {
        Text(value).foregroundStyle(Color(uiColor: .secondaryLabel))
      }
      if let badge = row.badge {
        Text(badge)
          .font(.footnote.weight(.semibold).monospacedDigit())
          .foregroundStyle(.white)
          .padding(.horizontal, 7)
          .frame(minWidth: 22, minHeight: 22)
          .background(Capsule().fill(Color.red))
      }
      if checked {
        Image(systemName: "checkmark").font(.body.weight(.semibold)).foregroundStyle(Color.accentColor)
      }
      switch row.accessory {
      case "chevron":
        Image(systemName: "chevron.right").font(.footnote.weight(.semibold))
          .foregroundStyle(Color(uiColor: .tertiaryLabel))
      case "info":
        Image(systemName: "info.circle").foregroundStyle(Color.accentColor)
      default:
        EmptyView()
      }
    }
    .contentShape(Rectangle())
    .accessibilityElement(children: .combine)
    .accessibilityAddTraits(checked ? .isSelected : [])
  }
}

struct ListAction: Identifiable {
  let id: String
  let title: String
  let systemImage: String?
  let role: String?
  let tint: Color?

  init?(_ value: Any) {
    guard let value = value as? [String: Any], let title = value["title"] as? String else { return nil }
    id = value["id"] as? String ?? title
    self.title = title
    systemImage = value["systemImage"] as? String
    role = value["role"] as? String
    tint = (value["tint"] as? String).flatMap(NativeComponentProps.color(css:))
  }
}

struct ListRow: Identifiable {
  let id: String
  let title: String
  let subtitle: String?
  let systemImage: String?
  let iconTint: Color?
  let value: String?
  let badge: String?
  let accessory: String?
  let role: String?
  let disabled: Bool
  let leading: [ListAction]
  let trailing: [ListAction]
  let children: [ListRow]

  init?(_ value: Any) {
    guard let value = value as? [String: Any], let title = value["title"] as? String else { return nil }
    id = value["id"] as? String ?? title
    self.title = title
    subtitle = value["subtitle"] as? String
    systemImage = value["systemImage"] as? String
    iconTint = (value["iconTint"] as? String).flatMap(NativeComponentProps.color(css:))
    self.value = value["value"] as? String
    let badge = value["badge"].flatMap { $0 as? String ?? ($0 as? NSNumber)?.stringValue }
    self.badge = badge?.isEmpty == false ? badge : nil
    accessory = value["accessory"] as? String
    role = value["role"] as? String
    disabled = value["disabled"] as? Bool ?? false
    leading = (value["leadingActions"] as? [Any] ?? []).compactMap(ListAction.init)
    trailing = (value["trailingActions"] as? [Any] ?? []).compactMap(ListAction.init)
    children = (value["children"] as? [Any] ?? []).compactMap(ListRow.init)
  }
}

struct ListSection: Identifiable {
  let id: String
  let header: String?
  let footer: String?
  let rows: [ListRow]

  init(_ value: [String: Any], index: Int) {
    id = value["id"] as? String ?? String(index)
    header = value["header"] as? String
    footer = value["footer"] as? String
    rows = (value["rows"] as? [Any] ?? []).compactMap(ListRow.init)
  }

  /// The sections as the page wrote them; a list of `rows` alone is one section.
  static func raw(_ props: NativeComponentProps) -> [[String: Any]] {
    if let sections = props["sections"] as? [Any] {
      return sections.enumerated().compactMap { index, value in
        guard var section = value as? [String: Any] else { return nil }
        if section["id"] == nil { section["id"] = String(index) }
        return section
      }
    }
    return [["id": "0", "rows": props["rows"] as? [Any] ?? []]]
  }

  static func list(_ props: NativeComponentProps) -> [ListSection] {
    raw(props).enumerated().map { ListSection($1, index: $0) }
  }
}

/// Watches the content height of the list's own scroll view, which UIKit
/// knows and SwiftUI doesn't tell before iOS 18.
private struct ContentHeightReader: UIViewRepresentable {
  let changed: @MainActor (Double) -> Void

  func makeUIView(context: Context) -> Probe {
    let probe = Probe()
    probe.changed = changed
    return probe
  }

  func updateUIView(_ probe: Probe, context: Context) {
    probe.changed = changed
  }

  final class Probe: UIView {
    var changed: (@MainActor (Double) -> Void)?
    private var observation: NSKeyValueObservation?

    override func didMoveToWindow() {
      super.didMoveToWindow()
      guard window != nil, observation == nil else { return }
      DispatchQueue.main.async { [weak self] in self?.attach() }
    }

    private func attach() {
      var root: UIView? = superview
      while let view = root, Self.scrollView(in: view) == nil { root = view.superview }
      guard let root, let scroll = Self.scrollView(in: root) else { return }
      observation = scroll.observe(\.contentSize, options: [.initial, .new]) { [weak self] scroll, _ in
        MainActor.assumeIsolated {
          let height = scroll.contentSize.height + scroll.adjustedContentInset.top + scroll.adjustedContentInset.bottom
          if height > 0 { self?.changed?(Double(height.rounded(.up))) }
        }
      }
    }

    static func scrollView(in view: UIView) -> UIScrollView? {
      for subview in view.subviews {
        if let scroll = subview as? UIScrollView, !(scroll is UITextView) { return scroll }
        if let found = scrollView(in: subview) { return found }
      }
      return nil
    }
  }
}

private extension View {
  @ViewBuilder
  func hiddenScrollBackground() -> some View {
    if #available(iOS 16.0, *) {
      scrollContentBackground(.hidden)
    } else {
      self
    }
  }

  @ViewBuilder
  func scrollDismissesKeyboardIfAvailable() -> some View {
    if #available(iOS 16.0, *) {
      scrollDismissesKeyboard(.immediately)
    } else {
      self
    }
  }
}
