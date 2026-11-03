import NativeIslands
import SwiftUI

/// A glass button that opens a system menu. The page lists the items, nested
/// to make submenus; choosing one sends `select` with its id.
@available(iOS 26.0, *)
struct MenuView: View {
  @ObservedObject var component: NativeComponentContext

  struct Item {
    let id: String
    let title: String
    let systemImage: String?
    let destructive: Bool
    /// Present for an item that can be checked: it shows as a toggle.
    let checked: Bool?
    let children: [Item]

    init?(_ value: Any) {
      guard let value = value as? [String: Any], let title = value["title"] as? String else { return nil }
      id = value["id"] as? String ?? title
      self.title = title
      systemImage = value["systemImage"] as? String
      destructive = value["destructive"] as? Bool ?? false
      checked = value["checked"] as? Bool
      children = (value["children"] as? [Any] ?? []).compactMap(Item.init)
    }
  }

  var body: some View {
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
    .menuOrder(.fixed)
  }

  @ViewBuilder
  private func title(of item: Item) -> some View {
    if let symbol = item.systemImage {
      Label(item.title, systemImage: symbol)
    } else {
      Text(item.title)
    }
  }

  private func entries(_ items: [Item]) -> AnyView {
    AnyView(
      ForEach(Array(items.enumerated()), id: \.offset) { _, item in
        if let checked = item.checked {
          Toggle(
            isOn: Binding(
              get: { checked },
              set: { _ in component.emit("select", payload: ["id": item.id]) }
            )
          ) {
            title(of: item)
          }
        } else if item.children.isEmpty {
          Button(role: item.destructive ? .destructive : nil) {
            component.emit("select", payload: ["id": item.id])
          } label: {
            title(of: item)
          }
        } else {
          Menu {
            entries(item.children)
          } label: {
            title(of: item)
          }
        }
      }
    )
  }
}

/// A text field whose text is state. `kind` picks the keyboard: `email`,
/// `number` or `secure`. Return sends `submit`; the page can send `focus`
/// and `blur`.
@available(iOS 26.0, *)
struct TextFieldView: View {
  @ObservedObject var component: NativeComponentContext
  @FocusState private var focused: Bool

  var body: some View {
    let props = component.props
    let kind = props.string("kind")
    let text = Binding(
      get: { component.props.string("text") ?? "" },
      set: { component.setState(["text": $0]) }
    )
    let placeholder = props.string("placeholder") ?? ""
    Group {
      if kind == "secure" {
        SecureField(placeholder, text: text)
      } else {
        TextField(placeholder, text: text)
          .keyboardType(kind == "email" ? .emailAddress : kind == "number" ? .decimalPad : .default)
          .textInputAutocapitalization(kind == "email" ? .never : .sentences)
          .autocorrectionDisabled(kind == "email")
      }
    }
    .focused($focused)
    .submitLabel(props.string("submitLabel") == "search" ? .search : .done)
    .onSubmit { component.emit("submit", payload: ["text": component.props.string("text") ?? ""]) }
    .font(.body)
    .tint(props.color("tint"))
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .onChange(of: focused) { _, next in
      component.emit("focusChange", payload: ["focused": next])
    }
    .onAppear {
      component.onCommand { name, _ in
        switch name {
        case "focus": focused = true
        case "blur": focused = false
        default: throw NativeComponentError.refused("Unknown command \(name).")
        }
        return nil
      }
    }
  }
}
