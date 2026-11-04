import NativeIslands
import SwiftUI

/// A text field whose text is state. `kind` picks the keyboard: `email`,
/// `number` or `secure`. Return sends `submit`; the page can send `focus`
/// and `blur`.
public struct TextFieldView: View {
  @ObservedObject var component: NativeComponentContext
  @FocusState private var focused: Bool

  public init(component: NativeComponentContext) {
    self.component = component
  }

  public var body: some View {
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
    .onChangeOf(focused) { next in
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
