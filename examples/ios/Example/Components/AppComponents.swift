import NativeIslands
import SwiftUI

/// The app's own components, which the gallery defines with
/// `defineNativeComponent` in `examples/pages/src/components/custom.tsx`
/// and `examples/pages/src/components/stateful.tsx`. The default components (`glassButton`,
/// `toggle` and the rest) come with the package.
enum AppComponents {
  @MainActor
  static func register() {
    let registry = NativeComponentRegistry.shared
    registry.register("rating") { RatingView(component: $0) }
    registry.register(
      "planCard",
      glass: { _ in NativeGlass(shape: .rounded(24)) },
      content: { PlanCardView(component: $0) }
    )
    // Never calls `ready()`, so the page's ack timeout is exercised.
    registry.register("silentBadge", waitsUntilReady: true) { _ in
      Text("Never shown")
    }
    registry.register("signupForm") { SignupFormView(component: $0) }
    registry.register("planPicker") { PlanPickerView(component: $0) }
    registry.register("datePicker") { DatePickerView(component: $0) }
    registry.register("slider") { SliderView(component: $0) }
    registry.register("tabs") { TabsView(component: $0) }
  }
}

/// Stars the user taps; `change` reports the new value.
struct RatingView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let props = component.props
    let value = props.int("value") ?? 0
    let maximum = max(1, props.int("max") ?? 5)
    HStack(spacing: 4) {
      ForEach(1...maximum, id: \.self) { star in
        Button {
          component.emit("change", payload: star)
        } label: {
          Image(systemName: star <= value ? "star.fill" : "star")
            .font(.title3)
            .foregroundStyle(props.color("tint") ?? .yellow)
        }
        .buttonStyle(.plain)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

/// A whole plan card drawn natively on glass, to show a large content area
/// standing in for web content.
struct PlanCardView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let props = component.props
    let selected = props.bool("selected") == true
    Button {
      component.emit("select")
    } label: {
      VStack(alignment: .leading, spacing: 12) {
        HStack(alignment: .firstTextBaseline) {
          Text(props.string("title") ?? "")
            .font(.title3.weight(.semibold))
          Spacer()
          Image(systemName: selected ? "checkmark.circle.fill" : "circle")
            .foregroundStyle(props.color("tint") ?? .accentColor)
            .font(.title2)
        }
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text(props.string("price") ?? "").font(.largeTitle.weight(.bold))
          Text(props.string("period") ?? "").foregroundStyle(.secondary)
        }
        ForEach(props.strings("features") ?? [], id: \.self) { feature in
          Label(feature, systemImage: "checkmark")
            .font(.subheadline)
        }
      }
      .padding(20)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
  }
}
