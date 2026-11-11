# Writing your own island

An island of your own is two halves that agree on one name: a
`defineNativeComponent` on the page and a SwiftUI view the app registers under
the same name. Write one only when no [ready-made island](components.md) fits,
or to draw the app's own SwiftUI view inside a page.

## Contents

- [The contract](#the-contract)
- [A worked example: a star rating](#a-worked-example-a-star-rating)
- [Reading props in Swift](#reading-props-in-swift)
- [Talking to the page from Swift](#talking-to-the-page-from-swift)
- [Size](#size)
- [Glass](#glass)
- [Views that load before they show](#views-that-load-before-they-show)
- [Accessibility](#accessibility)
- [The view's lifetime](#the-views-lifetime)
- [Versions](#versions)
- [Replacing a ready-made island](#replacing-a-ready-made-island)
- [Checklist](#checklist)

## The contract

Decide these once and write them on both sides:

| Part     | Page                                    | App                                                                |
| -------- | --------------------------------------- | ------------------------------------------------------------------ |
| Name     | `defineNativeComponent<Spec>("rating")` | `register("rating") { … }`                                         |
| Version  | `{ version: 1 }`, the lowest it needs   | `register("rating", version: 1)`, what it draws                    |
| Props    | `props` in the spec, sent as JSON       | `component.props`, a `NativeComponentProps`                        |
| State    | `state` in the spec, `on<Key>Change`    | `component.setState([key: value])`                                 |
| Events   | `events` in the spec, `on<Event>`       | `component.emit("event", payload:)`                                |
| Requests | `requests` in the spec, `on<Request>`   | `try await component.request("name", payload:)`                    |
| Commands | `ref.current.command("name", args)`     | `component.onCommand { name, args in … }`                          |
| Size     | `sizing`: `"web"`, `"native"`, …        | A view that fills its box, or has an ideal size; see [Size](#size) |

Names are case-sensitive and must match exactly: an event `submit` arrives as
`onSubmit`, a state key `value` as `onValueChange`, a request `lookUp` as
`onLookUp`.

## A worked example: a star rating

The page owns the value (state), hears the moment the user sends it (event)
and keeps a web version of the same size for browsers and older apps.

```tsx
import * as React from "react";
import { defineNativeComponent } from "native-islands/react";

type RatingSpec = {
  props: { value: number; max: number; tint?: string };
  state: { value: number };
  events: { submit: { value: number } };
};

export const Rating = defineNativeComponent<RatingSpec>("rating", {
  version: 1,
  colorProps: ["tint"],
});

export const RateThisApp = ({ send }: { send: (stars: number) => void }) => {
  const [stars, setStars] = React.useState(0);
  return (
    <Rating
      value={stars}
      max={5}
      tint="var(--accent)"
      accessibility={{ label: "Rating" }}
      onValueChange={setStars}
      onSubmit={({ value }) => send(value)}
    >
      <div className="rating" style={{ height: 44 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" aria-label={`${star} stars`} onClick={() => setStars(star)}>
            {star <= stars ? "★" : "☆"}
          </button>
        ))}
        <button type="button" onClick={() => send(stars)}>
          Send
        </button>
      </div>
    </Rating>
  );
};
```

```swift
import NativeIslands
import SwiftUI

struct RatingView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let props = component.props
    let count = max(1, props.int("max") ?? 5)
    let value = props.int("value") ?? 0
    HStack(spacing: 4) {
      ForEach(1...count, id: \.self) { star in
        Button {
          component.setState(["value": star])
        } label: {
          Image(systemName: star <= value ? "star.fill" : "star")
        }
        .accessibilityLabel("\(star) of \(count) stars")
        .accessibilityAddTraits(star == value ? .isSelected : [])
      }
      Button("Send") {
        component.emit("submit", payload: ["value": value])
      }
    }
    .tint(props.color("tint"))
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}
```

Register it with the rest, before the first web view is created. It holds
several controls (five stars and Send), so it registers with
`accessibilityChildren: .contain`: VoiceOver reaches each one on its own, and
the page's label names the group. See [Accessibility](#accessibility).

```swift
NativeComponentRegistry.shared.register("rating", version: 1, accessibilityChildren: .contain) { component in
  RatingView(component: component)
}
```

Hold the context with `@ObservedObject` in any view that reads it, so the view
redraws when the page sends new props.

## Reading props in Swift

Numbers from the page arrive as `Double`. Use the typed readers, which return
`nil` for a missing key or the wrong type:

| Reader                                   | Gives                                                                |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `props.string(key)`                      | `String?`                                                            |
| `props.bool(key)`                        | `Bool?`                                                              |
| `props.double(key)`                      | `Double?`                                                            |
| `props.int(key)`                         | `Int?`, the number rounded                                           |
| `props.strings(key)`                     | `[String]?`, `nil` unless every item is a string                     |
| `props.color(key)`, `props.uiColor(key)` | A colour the page sent as hex or `rgb()`, as `colorProps` resolve it |
| `props[key]`, `props.all`, `props.keys`  | The raw values, for nested objects and arrays                        |

Nested values are Foundation types. Read nested numbers through `NSNumber`,
never `as? Int`, which fails for every number the page sends, and nested
colours with `NativeComponentProps.color(css:)`, since `colorProps` only
resolves top-level props:

```swift
let items = component.props.all["items"] as? [[String: Any]] ?? []
let rows = items.map { item in
  (
    id: item["id"] as? String ?? "",
    count: (item["count"] as? NSNumber)?.intValue ?? 0,
    tint: (item["tint"] as? String).flatMap(NativeComponentProps.color(css:))
  )
}
```

## Talking to the page from Swift

| Call                                            | Does                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `component.emit("press", payload: …)`           | Fires `onPress` on the page                                                            |
| `component.setState(["value": 3])`              | Sends state; `component.props` shows it at once. `replace: true` drops keys not passed |
| `try await component.request("name", payload:)` | Asks the page and waits for the answer, up to 10 seconds                               |
| `component.onCommand { name, args in … }`       | Answers `command(name, args)` from the page; return a JSON value or `nil`              |
| `component.state`                               | The state this view has sent                                                           |
| `component.isVisible`                           | `false` while the page has the island hidden or parked                                 |

Everything sent must be JSON: strings, numbers, booleans, arrays, dictionaries
with string keys and `NSNull`. Anything else is dropped and logged, so send a
`Date` as an ISO 8601 string.

An event is dropped while the island is not visible (its screen is parked)
or before the page has it on screen, so never use one to report something the
page must not miss; use state for that.

Read the value back from `component.props`, never from a copy in `@State`:
the props already hold the state the view just set, and they are what the page
sends when it changes the value itself.

`request` throws a `NativeComponentError`: `.refused(message)` when the page has
no handler or its handler threw, `.timedOut`, `.notShowing` before the island
is on screen, `.unmounted` and `.invalidValue`. Always handle the failure:

```swift
Task {
  do {
    let answer = try await component.request("validateEmail", payload: ["email": text])
    error = (answer as? [String: Any])?["error"] as? String
  } catch {
    self.error = nil
  }
}
```

Set the command handler once, in `onAppear`, and throw for a name you do not
know; the page's promise then rejects with `reason: "rejected"`. The handler
runs on the main actor, so it can set the view's `@State` (here `focused`
and `flashing`) directly. The page
waits for its answer (5 seconds by default), so for an effect that lasts,
such as a flash, start it and return at once rather than awaiting it:

```swift
.onAppear {
  component.onCommand { name, _ in
    switch name {
    case "focus":
      focused = true
      return nil
    case "flash":
      flashing = true
      Task {
        try? await Task.sleep(nanoseconds: 600_000_000)
        flashing = false
      }
      return nil
    default:
      throw NativeComponentError.refused("Unknown command \(name).")
    }
  }
}
```

## Size

The page's `sizing` and the SwiftUI view's own size must agree:

| `sizing` on the page | The SwiftUI view must                                                                   |
| -------------------- | --------------------------------------------------------------------------------------- |
| `"web"` (default)    | Fill the box it is given: `.frame(maxWidth: .infinity, maxHeight: .infinity)`           |
| `"native"`           | Have an ideal size: `.fixedSize()`, no infinite frames                                  |
| `"nativeHeight"`     | Wrap to the width it is given and report its height: no fixed width, no infinite height |

The app measures a `"native"` or `"nativeHeight"` view whenever its props
change and, on iOS 16 and later, whenever its ideal size changes on its own,
such as after loading. On iOS 15 only new props measure it again.

## Glass

To draw the view on Liquid Glass (a material before iOS 26), pass `glass` when
registering. It returns the glass for the current props, or `nil` for none:

```swift
NativeComponentRegistry.shared.register(
  "chip",
  glass: { props in NativeGlass(shape: .capsule, tint: props.uiColor("tint")) }
) { component in
  ChipView(component: component)
}
```

`NativeGlass` takes `style` (`.regular` or `.clear`), `shape` (`.capsule`,
`.circle` or `.rounded(radius)`), `tint` and `isInteractive`. Whether an island
has glass is decided when it mounts: returning `nil` then means no glass for
that island's life, and later props only restyle glass it already has.
`NativeIslandsComponents.buttonGlass` is the glass the ready-made buttons use.

Glass islands with the same `glassGroup` prop merge into one shape on iOS 26,
as the system's own toolbar buttons do. Add `glassGroup?: string` to the
spec's `props` to offer it.

## Views that load before they show

A view that shows nothing until it has loaded (a remote image, a player)
registers with `waitsUntilReady: true` and calls `component.ready()` once it
can be seen. The page keeps the web version until then. If `ready()` has not
come within half a second the page logs a `timeout`, keeps the web version,
and switches to native as soon as it does come.

## Accessibility

VoiceOver reads each island from one side only, chosen by where the app
placed it:

- **In the page or a scrolling area** (most islands): VoiceOver reads the
  children, your web version. It stays in the accessibility tree behind the
  native view, and the app hides the native view from VoiceOver. A
  double-tap runs the web version's own handlers, which drive the island.
- **In the screen layer** (`position: fixed` chrome such as a tab bar or a
  toolbar): VoiceOver reads the native view, and the web version is hidden
  from it. The page's `accessibility` and the registration's
  `accessibilityChildren` decide what it finds there.

An island can sit in either place, so do both.

### The web version

- Make it accessible on its own: real `<button>`s and inputs, `role` and
  `aria-checked`, `aria-pressed` or `aria-selected` for state, and
  `aria-label` on icon-only controls. Each control in it is reached on its own.
- A control your web version steps with − and + buttons reads as two buttons;
  for one adjustable element give it `role="slider"` (or `spinbutton`) with
  `aria-valuenow` and arrow-key handlers, as the ready-made `Stepper` does.
- Never put `aria-hidden` or `visibility: hidden` on it; the island hides it
  from sight and touches itself.

### The native view

In the screen layer the registration says how VoiceOver reaches what the view
draws, with `accessibilityChildren` (a `NativeAccessibilityChildren`):

| Value                | VoiceOver finds                                         | The page's `accessibility`                                             | Use for                                                    |
| -------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| `.combine` (default) | One element for the whole island                        | Its `label`, `hint`, `value` and `traits` describe that element        | A single control: a button, a switch, a slider, a field    |
| `.contain`           | Each control the view draws, on its own, inside a group | Its `label` names the group; `hint`, `value` and `traits` are not used | Several controls: a row of buttons, tabs, segments, a list |

`hidden: true` hides the native view from VoiceOver in both. Register by what
the view draws, not by where today's page puts it: the grouping is fixed at
registration, and another page may pin the island.

### One control in the screen layer: `.combine`

The page names it. It sends `accessibility`, and when that is left out reads
one from the children: their `aria-label`, `alt` or text, and the first
child's role. Labels set inside the SwiftUI view are merged away under the
page's label, so:

- Give the island a label on the page: `accessibility={{ label }}`, or a web
  version that has one, such as `aria-label` on an icon-only button.
- Leave `value` out when the control says it itself. A SwiftUI `Toggle`,
  `Slider`, `Stepper`, `TextField` or `DatePicker` keeps its own value and
  traits (on or off, 60%, adjustable), and a `value` from the page replaces
  it. Send one only for a view that has none of its own.
- `traits` takes `button`, `link`, `image`, `header`, `selected` and `switch`
  (a button before iOS 17); others are ignored.

### Several controls in the screen layer: `.contain`

Without it, VoiceOver gets one element for the whole island and cannot reach
or activate a single button in it. Register with `.contain` and label each
control in Swift, since the page's label is now only the group's name:

```swift
import NativeIslands
import SwiftUI

struct PlayerControlsView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    let playing = component.props.bool("playing") == true
    HStack(spacing: 24) {
      Button {
        component.emit("previous")
      } label: {
        Image(systemName: "backward.fill")
      }
      .accessibilityLabel("Previous")
      Button {
        component.setState(["playing": !playing])
      } label: {
        Image(systemName: playing ? "pause.fill" : "play.fill")
      }
      .accessibilityLabel(playing ? "Pause" : "Play")
      Button {
        component.emit("next")
      } label: {
        Image(systemName: "forward.fill")
      }
      .accessibilityLabel("Next")
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

NativeComponentRegistry.shared.register("playerControls", accessibilityChildren: .contain) { component in
  PlayerControlsView(component: component)
}
```

- Every control needs its own label in Swift: text it shows, or
  `.accessibilityLabel` on an icon. Mark the chosen one with
  `.accessibilityAddTraits(.isSelected)`, as the rating above does.
- Name the group on the page with `accessibility={{ label: "Player" }}`. A web
  version whose root has a composite role (`toolbar`, `tablist`, `list`,
  `listbox`, `menu`, `menubar`, `grid`, `treegrid`, `radiogroup`, `tree`,
  `table`) is never named
  from its text, which would run every button together: give it an
  `aria-label`, or the group has no name.
- A SwiftUI `Slider` in the view stays adjustable, but needs its own
  `.accessibilityLabel`. A `Stepper`, or − and + buttons of your own, reads
  as two buttons VoiceOver reaches one by one; a stepper that should be one
  adjustable element belongs in an island of its own, registered `.combine`.
- A view that only sometimes shows a second control (a clear button in a
  field) is still several controls: register `.contain`.

### Limits

- In the page or a scrolling area nothing set in Swift is read: not
  `accessibilityChildren`, not `.accessibilityLabel`. Only the web version is.
- Before iOS 18 the island's view is rebuilt when the page starts or stops
  sending a `label`, `hint` or `value`, which can reset `@State` and focus.
  Send them from the first render.
- The grouping is fixed when the component is registered; a prop cannot
  change it.

## The view's lifetime

- The app may hand a view to a new island of the same component and props,
  such as when a page goes back to a screen it had. `@State` survives that, so
  derive everything the page controls from `component.props`.
- Never keep `component.id`; it changes when the view is handed over.
- Release a device (camera, timer, player) in `onDisappear` and when
  `component.isVisible` turns `false`.

## Versions

Adding an optional prop needs no new version: an older app ignores it. When the
page needs something only a newer view draws, raise the version on both sides;
an app that registers the older one shows the web version. Never change what an
existing prop, event or state key means: add a new one.

## Replacing a ready-made island

Register your own view under a ready-made name after
`NativeIslandsComponents.register()`; the later registration wins. Keep its
props, events and state exactly as `native-islands/components` sends them, or
use a name of your own. Keep its grouping too: a view registered under
`segmentedControl`, `tabBar`, `toolbar`, `navigationBar`, `list` or another
ready-made name with several controls needs `accessibilityChildren: .contain`
again, as the default is `.combine`.

## Checklist

- [ ] The same name and version on both sides.
- [ ] The children are a real, laid-out web version of the same size.
- [ ] Values the user owns are state, listed in `props` too when the page sets
      them; moments are events; their `on…` names do not collide.
- [ ] Every prop is JSON; nested numbers are read through `NSNumber`.
- [ ] The Swift view fills its box, or has an ideal size for `"native"`.
- [ ] Every command has a web path on the page.
- [ ] The web version reads correctly with VoiceOver on its own (roles, state,
      labels).
- [ ] For the screen layer: one control is named by the page (`accessibility`,
      or children that give a label); several are registered with
      `accessibilityChildren: .contain`, each labelled in Swift.
- [ ] Registered before the first `IslandWebView` is created.
- [ ] Seen native in the app with `-NativeIslandsOutlines YES`, and seen as
      web in a browser.
