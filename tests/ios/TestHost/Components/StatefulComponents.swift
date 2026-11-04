import NativeIslands
import SwiftUI

/// A native form whose values live in the view and flow to the page as
/// state, with an email check the page answers and `focus`/`reset`
/// commands the page sends.
struct SignupFormView: View {
  enum Field: String {
    case name
    case email
  }

  @ObservedObject var component: NativeComponentContext
  @FocusState private var focused: Field?
  @State private var emailError: String?

  var body: some View {
    let props = component.props
    VStack(alignment: .leading, spacing: 10) {
      TextField("Name", text: binding("name"))
        .textContentType(.name)
        .focused($focused, equals: .name)
        .submitLabel(.next)
        .onSubmit { focused = .email }
      TextField("Email", text: binding("email"))
        .textContentType(.emailAddress)
        .keyboardType(.emailAddress)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .focused($focused, equals: .email)
        .submitLabel(.send)
        .onSubmit(submit)
      if let emailError {
        Text(emailError).font(.footnote).foregroundStyle(.red)
      }
      Toggle(
        "Send me product updates",
        isOn: Binding(
          get: { component.props.bool("agreed") ?? false },
          set: { component.setState(["agreed": $0]) }
        )
      )
      Button(props.string("submitLabel") ?? "Sign up", action: submit)
        .glassProminentButtonStyle()
        .frame(maxWidth: .infinity)
    }
    .textFieldStyle(.roundedBorder)
    .padding(16)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    .onAppear {
      component.onCommand { name, args in
        switch name {
        case "focus":
          let field = (args as? [String: Any])?["field"] as? String
          focused = field.flatMap(Field.init(rawValue:))
          return nil
        case "reset":
          focused = nil
          emailError = nil
          component.setState(["name": "", "email": "", "agreed": false], replace: true)
          return nil
        default:
          throw NativeComponentError.refused("Unknown command \(name).")
        }
      }
    }
  }

  private func binding(_ key: String) -> Binding<String> {
    Binding(
      get: { component.props.string(key) ?? "" },
      set: { component.setState([key: $0]) }
    )
  }

  private func submit() {
    let props = component.props
    let values: [String: Any] = [
      "name": props.string("name") ?? "",
      "email": props.string("email") ?? "",
      "agreed": props.bool("agreed") ?? false
    ]
    Task {
      do {
        let answer = try await component.request("validateEmail", payload: ["email": values["email"] ?? ""])
        let error = (answer as? [String: Any])?["error"] as? String
        emailError = error
        if error == nil {
          focused = nil
          component.emit("submit", payload: values)
        }
      } catch {
        emailError = error.localizedDescription
      }
    }
  }
}

/// Plans to choose from; the choice is state.
struct PlanPickerView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let plans = (component.props["plans"] as? [[String: Any]]) ?? []
    let selected = component.props.string("selected")
    VStack(spacing: 8) {
      ForEach(Array(plans.enumerated()), id: \.offset) { _, plan in
        let id = plan["id"] as? String ?? ""
        Button {
          component.setState(["selected": id])
        } label: {
          HStack {
            Text(plan["title"] as? String ?? "").font(.body.weight(.semibold))
            Spacer()
            Text(plan["price"] as? String ?? "").foregroundStyle(.secondary)
            Image(systemName: id == selected ? "checkmark.circle.fill" : "circle")
          }
          .padding(.horizontal, 16)
          .frame(maxWidth: .infinity, minHeight: 48)
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .glassOrMaterial(in: RoundedRectangle(cornerRadius: 16))
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
  }
}

/// A date, as `YYYY-MM-DD` state.
struct DatePickerView: View {
  @ObservedObject var component: NativeComponentContext

  private static let format: DateFormatter = {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter
  }()

  var body: some View {
    let props = component.props
    let minimum = props.string("minimum").flatMap(Self.format.date(from:)) ?? .distantPast
    DatePicker(
      "Start",
      selection: Binding(
        get: { props.string("date").flatMap(Self.format.date(from:)) ?? Date() },
        set: { component.setState(["date": Self.format.string(from: $0)]) }
      ),
      in: minimum...,
      displayedComponents: .date
    )
    .padding(.horizontal, 12)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

/// A value scrubbed natively; every step is state.
struct SliderView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let props = component.props
    let minimum = props.double("minimum") ?? 0
    let maximum = max(minimum + 1, props.double("maximum") ?? 100)
    let step = max(0.0001, props.double("step") ?? 1)
    Slider(
      value: Binding(
        get: { min(max(props.double("value") ?? minimum, minimum), maximum) },
        set: { component.setState(["value": $0]) }
      ),
      in: minimum...maximum,
      step: step
    )
    .padding(.horizontal, 8)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

/// Tabs; the selected index is state the web panel follows.
struct TabsView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let tabs = component.props.strings("tabs") ?? []
    Picker(
      "",
      selection: Binding(
        get: { component.props.int("selected") ?? 0 },
        set: { component.setState(["selected": $0]) }
      )
    ) {
      ForEach(Array(tabs.enumerated()), id: \.offset) { index, tab in
        Text(tab).tag(index)
      }
    }
    .pickerStyle(.segmented)
    .labelsHidden()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}
