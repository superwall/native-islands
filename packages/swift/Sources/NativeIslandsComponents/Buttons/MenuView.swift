import NativeIslands
import SwiftUI

/// A glass button that opens a system menu. The page lists the items, nested
/// to make submenus; choosing one sends `select` with its id.
public struct MenuView: View {
  @ObservedObject var component: NativeComponentContext

  public struct Item {
    public let id: String
    public let title: String
    public let systemImage: String?
    public let destructive: Bool
    /// Present for an item that can be checked: it shows as a toggle.
    public let checked: Bool?
    public let children: [Item]

    public init?(_ value: Any) {
      guard let value = value as? [String: Any], let title = value["title"] as? String else { return nil }
      id = value["id"] as? String ?? title
      self.title = title
      systemImage = value["systemImage"] as? String
      destructive = value["destructive"] as? Bool ?? false
      checked = value["checked"] as? Bool
      children = (value["children"] as? [Any] ?? []).compactMap(Item.init)
    }
  }

  public init(component: NativeComponentContext) {
    self.component = component
  }

  public var body: some View {
    let props = component.props
    let items = (props["items"] as? [Any] ?? []).compactMap(Item.init)
    Menu {
      entries(items)
    } label: {
      HStack(spacing: 6) {
        if let symbol = props.string("systemImage") {
          Image(systemName: symbol)
        }
        if let title = props.string("title"), !title.isEmpty {
          Text(title).lineLimit(1)
        }
      }
      .font(.body.weight(.semibold))
      .foregroundStyle(props.string("prominence") == "prominent" ? Color.white : Color.primary)
      .padding(.horizontal, 12)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .contentShape(Capsule())
    }
    .buttonStyle(.plain)
    .fixedMenuOrder()
  }

  @ViewBuilder
  private static func title(of item: Item) -> some View {
    if let symbol = item.systemImage {
      Label(item.title, systemImage: symbol)
    } else {
      Text(item.title)
    }
  }

  private func entries(_ items: [Item]) -> AnyView {
    Self.entries(items) { component.emit("select", payload: ["id": $0]) }
  }

  /// The menu's items as SwiftUI menu content, sending each choice to `select`.
  public static func entries(_ items: [Item], select: @escaping @MainActor (String) -> Void) -> AnyView {
    AnyView(
      ForEach(Array(items.enumerated()), id: \.offset) { _, item in
        if let checked = item.checked {
          Toggle(isOn: Binding(get: { checked }, set: { _ in select(item.id) })) {
            title(of: item)
          }
        } else if item.children.isEmpty {
          Button(role: item.destructive ? .destructive : nil) {
            select(item.id)
          } label: {
            title(of: item)
          }
        } else {
          Menu {
            entries(item.children, select: select)
          } label: {
            title(of: item)
          }
        }
      }
    )
  }
}

private extension View {
  /// Items in the page's order however the menu opens; iOS 15 has no choice.
  @ViewBuilder
  func fixedMenuOrder() -> some View {
    if #available(iOS 16.0, *) {
      menuOrder(.fixed)
    } else {
      self
    }
  }
}
