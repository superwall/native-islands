# native-islands

The page side of [Native Islands](../../README.md). When you wrap a web element
in a native component, an iOS app that hosts islands draws a UIKit or SwiftUI
view at the element's position. In a browser, or in an app without Native
Islands, the web element stays. The page has no platform checks.

> [!WARNING]
> **Experimental.** The API and the contract with the app will change between
> versions. See [Known limits](../../README.md#known-limits).

## Install

```bash
npm install native-islands
```

React 19 or later is an optional peer, needed only for `/react`.

| Entry                           | For                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `native-islands`                | Any page, no framework: `connectNativeIslands`, the capability helpers, `NativeCommandError` and `ISLAND_PHASE_ATTRIBUTE`     |
| `native-islands/react`          | React bindings                                                                                                                |
| `native-islands/protocol`       | The zod schemas, message types and wire constants, for anyone writing another host or transport                               |
| `native-islands/simulator`      | A host written in JS that draws outlines where native views would sit, for browsers and tests. No framework needed            |
| `native-islands/components`     | Ready-made controls, each with its web version; the app registers them with `NativeIslandsComponents.register()`. Needs React |
| `native-islands/components.css` | The styles for those web versions                                                                                             |

## React

### `NativeIslandsProvider`

```tsx
<NativeIslandsProvider>
  <App />
</NativeIslandsProvider>
```

| Prop            | Type                          | Default                                                                                                      |
| --------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `islands`       | `NativeIslands`               | one made by `connectNativeIslands()`                                                                         |
| `connect`       | `ConnectNativeIslandsOptions` | `{}`                                                                                                         |
| `announceReady` | `boolean`                     | `true`: tells the host once the first frame's islands are drawn, so it can reveal the page with no web flash |

The provider renders on the server, as in a Next.js App Router page. There it
has no host, so every island renders its web version and `useNativeSupport`
returns `"unavailable"`. Islands go native once the page hydrates in an app.

### `defineNativeComponent`

Types a component the app registered. Everything in the spec is optional.
Every message from native arrives as an `on…` prop: an event `submit` as
`onSubmit(payload)`, a state key `email` as `onEmailChange(next)`, called only
when that key changes, and a request `validateEmail` as
`onValidateEmail(payload)`, whose return value, or a promise of it, is the
reply. A request with no handler fails, so native never waits on it.

Use state for a value the user owns (a switch, a slider, typed text) and an
event for a moment (a press, a submit). State carries a revision, so the app
ignores a stale echo of an older value. Keep the names of events, state keys
and requests apart: they share one set of `on…` props, so an event
`valueChange` and a state key `value` would both be `onValueChange`, and a
request `submit` would run the `onSubmit` handler of an event `submit` and
send back what it returns.

Colours in `colorProps` can be any CSS colour or `var(--token)`; they are
resolved before they reach native. Islands that share a `glassGroup` prop blend
like system glass. For the common controls, `native-islands/components` already
defines them (see [Components](#components)).

```tsx
const SignupForm = defineNativeComponent<{
  props: { title: string };
  events: { submit: { email: string } };
  state: { email: string; agreed: boolean };
  requests: { validateEmail: { payload: { email: string }; result: { error?: string } } };
  commands: { focus: { args: { field: "email" }; result: void }; reset: { args: void; result: void } };
}>("signupForm", { version: 1 });

const form = useRef<NativeHandle<...>>(null);

<SignupForm
  ref={form}
  title="Join"
  onSubmit={({ email }) => send(email)}
  onEmailChange={(email) => setEcho(email)}
  onValidateEmail={({ email }) => ({ error: valid(email) ? undefined : "Check it" })}
>
  <WebSignupForm />
</SignupForm>

await form.current?.command("focus", { field: "email" });
```

| Option       | Type                | Default                                            |
| ------------ | ------------------- | -------------------------------------------------- |
| `version`    | `number`            | `1`: the lowest registered version this works with |
| `sizing`     | `"web" \| "native"` | `"web"`: who sets the size                         |
| `colorProps` | prop names          | none: props resolved to `rgb()`/`rgba()`           |

Every defined component also takes:

| Prop            | Type                       | Default                                            |
| --------------- | -------------------------- | -------------------------------------------------- |
| `children`      | `ReactNode`                | the web version                                    |
| `native`        | `boolean`                  | `true`; `false` keeps the web version              |
| `islandId`      | `string`                   | a generated id                                     |
| `accessibility` | `{ label?, traits? }`      | read from the children                             |
| `onStateChange` | `(state, changed) => void` | none: the whole state with the keys that changed   |
| `ref`           | `NativeHandle`             | `command(name, args, { timeoutMs })` and `state()` |

### `Native`

The untyped form `defineNativeComponent` is built on.

```tsx
<Native component="rating" props={{ value: 4, max: 5 }} onEvent={(name, payload) => {}}>
  <WebStars />
</Native>
```

### Hooks

| Hook                                       | Returns                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `useNativeSupport(component, version = 1)` | `"supported" \| "unavailable" \| "unknown_component" \| "unsupported_version"` |
| `useNativeIslandsReady()`                  | `true` once no island is still on its way to native                            |
| `useNativeIslands()`                       | the island controller                                                          |

## Components

`native-islands/components` has a typed component for each island in the
Swift component libraries, under the same name and props. The app registers
`NativeIslandsComponents` for most of them, and `NativeIslandsMaps` or
`NativeIslandsCharts` for the map and the chart:

| Component            | Native name        | Main props                                                    |
| -------------------- | ------------------ | ------------------------------------------------------------- |
| `GlassButton`        | `glassButton`      | `title`, `systemImage`, `icon`, `prominence`, `onPress`       |
| `CloseButton`        | `closeButton`      | `onPress`                                                     |
| `Menu`               | `menu`             | `title`, `items`, `onSelect`                                  |
| `Toggle`             | `toggle`           | `isOn`, `onChange`, `label`                                   |
| `SegmentedControl`   | `segmentedControl` | `segments`, `selectedIndex`, `onChange`, `label`              |
| `Slider`             | `slider`           | `value`, `minimum`, `maximum`, `step`, `onChange`             |
| `Stepper`            | `stepper`          | `value`, `minimum`, `maximum`, `step`, `onChange`             |
| `Picker`             | `picker`           | `options`, `selectedIndex`, `style`, `onChange`               |
| `DatePicker`         | `datePicker`       | `date` (`yyyy-MM-ddTHH:mm`), `components`, `onChange`         |
| `ColorPicker`        | `colorPicker`      | `color`, `onChange`                                           |
| `TextField`          | `textField`        | `text`, `placeholder`, `onChange`, `onSubmit`, `handle`       |
| `SystemSymbol`       | `symbol`           | `name`; children are the web drawing                          |
| `SymbolEffect`       | `symbolEffect`     | `name`, `effect`; children are the web drawing                |
| `Gauge`              | `gauge`            | `value`, `style`, `valueLabel`                                |
| `Chart`              | `chart`            | `series`, `kind`, `xAxis`, `yAxis`, `stacked`, `onSelect`     |
| `Tip`                | `tip`              | `id`, `title`, `message`, `actions`, `onAction`, `handle`     |
| `Video`              | `video`            | `url`, `webUrl`, `onStatus`, `handle`                         |
| `PhotoPicker`        | `photoPicker`      | `title`, `limit`, `onPick`                                    |
| `HapticButton`       | `hapticButton`     | `title`, `feedback`, `onPress`                                |
| `ShareButton`        | `shareButton`      | `title`, `text`, `url`, `onComplete`                          |
| `MapView`            | `map`              | `places`, `style`, `selectedId`, `onSelect`, `pinIcon`        |
| `Camera`             | `camera`           | `position`, `running`, `onStatus`, `handle`                   |
| `Permission`         | `permission`       | `kind`, `label`, `onStatus`                                   |
| `Sheet`              | `presentation`     | `open`, `url`, `detents`, `onOpenChange`, `onDismiss`         |
| `FullScreenCover`    | `presentation`     | `open`, `url`, `onOpenChange`, `onDismiss`                    |
| `Popover`            | `presentation`     | `open`, `url`, `width`, `height`; children are the anchor     |
| `Inspector`          | `presentation`     | `open`, `url`, `onOpenChange`                                 |
| `Alert`              | `alert`            | `open`, `title`, `message`, `buttons`, `textFields`           |
| `ConfirmationDialog` | `alert`            | `open`, `title`, `buttons`; children are the anchor           |
| `TabView`            | `tabBar` and more  | `tabs` with `content`, `selectedId`, `search`, `accessory`    |
| `TabBar`             | `tabBar`           | `tabs`, `selectedId`, `onSelect`                              |
| `TabAccessory`       | `tabAccessory`     | `title`, `subtitle`, `systemImage`, `actions`, `onPress`      |
| `SearchTab`          | `searchTab`        | `selected`, `onPress`                                         |
| `SearchField`        | `searchField`      | `text`, `onChange`, `onSubmit`, `handle`                      |
| `NavigationStack`    | `navigationBar`    | `path`, `onPathChange`, `screens`                             |
| `NavigationBar`      | `navigationBar`    | `title`, `showsBack`, `leading`, `trailing`, `onBack`         |
| `Toolbar`            | `toolbar`          | `items`, `onSelect`                                           |
| `List`               | `list`             | `sections`, `selectionMode`, `editing`, `onPress`, `onAction` |
| `Haptics`            | `haptics`          | `handle` with `play(pattern)`, `impact`; or `useHaptics()`    |
| `Notifications`      | `notifications`    | `handle` with `schedule`, `cancel`; or `useNotifications()`   |
| `ContextMenu`        | `interaction`      | `items`, `onSelect`; children stay web                        |
| `LongPressGesture`   | `interaction`      | `minimumDuration`, `onLongPress`; children stay web           |
| `MaterialBackground` | `material`         | `material`, `cornerRadius`, `title`, `subtitle`               |

```tsx
import { Slider } from "native-islands/components";
import "native-islands/components.css";

<Slider value={volume} onChange={setVolume} label="Volume" />;
```

A chart's `series` are `{ id, name?, kind?, color?, points: [{ x, y }] }`. On a
`category` axis (the default) `x` is a label, on a `number` axis a number, and
on a `date` axis an ISO 8601 date such as `2026-11-04`. `yAxis` takes a
`title`, a `min` and `max`, and a `format` of `number`, `percent` or
`currency`. Scrubbing reports `{ x, values: [{ series, y }] }`, with `x: null`
on release. Series colours are hex or `rgb()`; without one, a series takes the
tint, then the `--ni-chart-1` to `--ni-chart-5` palette.

`MapView`, `Video`, `Camera` and `MaterialBackground` fill the box their
parent gives them, so set the parent's size, such as `aspect-ratio: 16 / 9`.

A presentation's `url` is read relative to the page. The page it shows uses
`usePresentedPage()` to know how it is presented, close itself with
`dismiss(result)`, and `send(data)` up to the presenting page's `onMessage`;
a `handle` on the presentation posts data down. In a browser, presentations and
alerts are a `<dialog>`, with the page in an `<iframe>`.

Bar items are buttons, menus (`kind: "menu"` with `items`) or `spacer` and
`flexibleSpace` between groups. A `List` takes `sections` of rows; it reports
the height its native rows take and its web version takes that height, so the
page lays out around it on every iOS. After a drag or a delete in edit mode,
`onSectionsChange` hands over the new sections to keep. Colours nested in
items, such as a row's `iconTint`, are hex or `rgb()`.

`ContextMenu` and `LongPressGesture` lay a clear native view over their
children, which stay the page's own elements; taps on them arrive as
`onPress`. Islands sit above the page, so nothing on the page can draw on a
`MaterialBackground`: give it a `title`, `subtitle` and `systemImage` instead.
`Haptics` and `Notifications` draw nothing; render them once and keep their
handle.

Each draws a default web version sized like the native control. Pass children
to draw your own instead; they then set the island's size. The web versions
read `--ni-*` custom properties, such as `--ni-accent`, `--ni-glass` and
`--ni-glass-edge`, which a page sets on `:root` to match its theme. Light and
dark follow `color-scheme`. The `Native*` specs underneath, such as
`NativeToggle`, are exported too, for a page that wants the native island with
its own wrapper.

## Without React

```ts
import { connectNativeIslands } from "native-islands";

const { islands, disconnect } = connectNativeIslands();
islands.mount(
  "cta",
  { component: "glassButton", version: 1, props: { title: "Go" }, frame, anchor: { type: "page" },
    visible: true, order: 0, sizing: "web" },
  { onEvent: (name) => name === "press" && buy() },
);
islands.announceReady();
```

React is an optional peer; the core and the simulator never import it.

## License

[FSL-1.1-MIT](../../LICENSE), Copyright 2026 Superwall, Inc. Each release
becomes MIT two years after it is published.
