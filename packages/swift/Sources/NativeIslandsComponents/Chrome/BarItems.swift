import NativeIslands
import SwiftUI

/// One item of a navigation bar or a toolbar, as the page lists it: a button,
/// a menu of `items`, or room between groups (`spacer` a fixed gap,
/// `flexibleSpace` all that is left).
struct BarItem: Identifiable {
  enum Kind: String {
    case button
    case menu
    case spacer
    case flexibleSpace
  }

  let id: String
  let kind: Kind
  let title: String?
  let systemImage: String?
  let accessibilityLabel: String?
  let prominent: Bool
  let tint: Color?
  let disabled: Bool
  let items: [MenuView.Item]

  init?(_ value: Any) {
    guard let value = value as? [String: Any] else { return nil }
    let kind = (value["kind"] as? String).flatMap(Kind.init(rawValue:))
    let items = (value["items"] as? [Any] ?? []).compactMap(MenuView.Item.init)
    self.kind = kind ?? (items.isEmpty ? .button : .menu)
    title = value["title"] as? String
    systemImage = value["systemImage"] as? String
    accessibilityLabel = [value["accessibilityLabel"] as? String, title].lazy.compactMap { $0 }.first { !$0.isEmpty }
    guard self.kind == .spacer || self.kind == .flexibleSpace || title != nil || systemImage != nil else { return nil }
    id = value["id"] as? String ?? title ?? systemImage ?? self.kind.rawValue
    prominent = value["prominent"] as? Bool ?? false
    tint = (value["tint"] as? String).flatMap(NativeComponentProps.color(css:))
    disabled = value["disabled"] as? Bool ?? false
    self.items = items
  }

  static func list(_ value: Any?) -> [BarItem] {
    (value as? [Any] ?? []).compactMap(BarItem.init)
  }

  var isSpace: Bool { kind == .spacer || kind == .flexibleSpace }
}

/// Bar items laid out as iOS 26 groups them: each run of buttons between two
/// spaces shares one glass capsule, and a prominent one stands on its own.
struct BarItemsView: View {
  let items: [BarItem]
  let select: @MainActor (String) -> Void
  var height: CGFloat = 44

  var body: some View {
    HStack(spacing: 8) {
      ForEach(Array(groups.enumerated()), id: \.offset) { _, group in
        switch group {
        case .space(let flexible):
          if flexible { Spacer(minLength: 0) } else { Color.clear.frame(width: 8, height: 1) }
        case .items(let items):
          itemGroup(items)
        }
      }
    }
  }

  private enum Group {
    case space(flexible: Bool)
    case items([BarItem])
  }

  private var groups: [Group] {
    var groups: [Group] = []
    var run: [BarItem] = []
    func flush() {
      if !run.isEmpty { groups.append(.items(run)) }
      run = []
    }
    for item in items {
      if item.isSpace {
        flush()
        groups.append(.space(flexible: item.kind == .flexibleSpace))
      } else if item.prominent {
        flush()
        groups.append(.items([item]))
      } else {
        run.append(item)
      }
    }
    flush()
    return groups
  }

  @ViewBuilder
  private func itemGroup(_ items: [BarItem]) -> some View {
    let prominent = items.count == 1 && items[0].prominent
    let tint = prominent ? items[0].tint ?? .accentColor : nil
    let round = items.count == 1 && (items[0].title ?? "").isEmpty
    HStack(spacing: 0) {
      ForEach(items) { item in
        BarItemButton(item: item, height: height, onTint: prominent, select: select)
      }
    }
    .padding(.horizontal, round ? 0 : 4)
    .frame(minWidth: height, minHeight: height, maxHeight: height)
    .modifier(GroupShape(round: round, tint: tint))
  }

  private struct GroupShape: ViewModifier {
    let round: Bool
    let tint: Color?

    func body(content: Content) -> some View {
      if round {
        content.glassOrMaterial(in: Circle(), tint: tint)
      } else {
        content.glassOrMaterial(in: Capsule(), tint: tint)
      }
    }
  }
}

/// One button or menu of a bar, sending its id to `select`.
struct BarItemButton: View {
  let item: BarItem
  let height: CGFloat
  let onTint: Bool
  let select: @MainActor (String) -> Void

  var body: some View {
    Group {
      if item.kind == .menu {
        Menu {
          MenuView.entries(item.items, select: select)
        } label: {
          label
        }
        .fixedMenuOrder()
      } else {
        Button {
          select(item.id)
        } label: {
          label
        }
      }
    }
    .buttonStyle(.plain)
    .disabled(item.disabled)
    .opacity(item.disabled ? 0.4 : 1)
    .modifier(SpokenLabel(label: item.accessibilityLabel))
  }

  // Without a label of its own, an icon reads as SwiftUI names its symbol,
  // such as Share for `square.and.arrow.up`, never as the symbol's name.
  private struct SpokenLabel: ViewModifier {
    let label: String?

    func body(content: Content) -> some View {
      if let label {
        content.accessibilityLabel(Text(label))
      } else {
        content
      }
    }
  }

  private var label: some View {
    HStack(spacing: 6) {
      if let symbol = item.systemImage {
        Image(systemName: symbol)
          .font(.system(size: 17, weight: .semibold))
      }
      if let title = item.title, !title.isEmpty {
        Text(title)
          .font(.body.weight(.semibold))
          .lineLimit(1)
      }
    }
    .foregroundStyle(onTint ? Color.white : item.tint ?? Color.primary)
    .padding(.horizontal, (item.title ?? "").isEmpty ? 0 : 10)
    .frame(minWidth: height, minHeight: height)
    .contentShape(Rectangle())
  }
}
