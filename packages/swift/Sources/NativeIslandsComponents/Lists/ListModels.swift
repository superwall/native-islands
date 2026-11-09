import NativeIslands
import SwiftUI

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
  private(set) var children: [ListRow]

  /// Whether it is the row `id` or holds it, at any depth.
  func contains(_ id: String) -> Bool {
    self.id == id || children.contains { $0.contains(id) }
  }

  /// The row without the rows `ids` among its children, or nil if it is one.
  func without(_ ids: Set<String>) -> ListRow? {
    guard !ids.contains(id) else { return nil }
    var copy = self
    copy.children = children.compactMap { $0.without(ids) }
    return copy
  }

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
  private(set) var rows: [ListRow]

  /// The ids of its rows, in order.
  var rowIds: [String] { rows.map(\.id) }

  /// Whether it holds the row `id`, at any depth.
  func contains(_ id: String) -> Bool {
    rows.contains { $0.contains(id) }
  }

  /// The section without the rows `ids`, at any depth.
  func without(_ ids: Set<String>) -> ListSection {
    guard !ids.isEmpty else { return self }
    var copy = self
    copy.rows = rows.compactMap { $0.without(ids) }
    return copy
  }

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
