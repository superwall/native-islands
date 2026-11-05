# native-islands

The page side of [Native Islands](../../README.md). When you wrap a web element
in a native component, an iOS app that hosts islands draws a UIKit or SwiftUI
view at the element's position. In a browser, or in an app without Native
Islands, the web element stays. The page has no platform checks.

> [!WARNING]
> **Experimental.** The API and the contract with the app will change between
> versions. See [Where it stands](../../README.md#where-it-stands).

## Install

```bash
npm install native-islands
```

React 19 or later is an optional peer, needed only for `/react`.

| Entry                           | For                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `native-islands`                | Any page, no framework: the island controller, the WebKit transport, layout helpers, the protocol schemas                     |
| `native-islands/react`          | React bindings                                                                                                                |
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

### `defineNativeComponent`

Types a component the app registered. Everything in the spec is optional.
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
  onStateChange={(state, changed) => setEcho(state.email)}
  requests={{ validateEmail: ({ email }) => ({ error: valid(email) ? undefined : "Check it" }) }}
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

| Prop            | Type                            | Default                                            |
| --------------- | ------------------------------- | -------------------------------------------------- |
| `children`      | `ReactNode`                     | the web version                                    |
| `native`        | `boolean`                       | `true`; `false` keeps the web version              |
| `islandId`      | `string`                        | a generated id                                     |
| `accessibility` | `{ label?, traits? }`           | read from the children                             |
| `onStateChange` | `(state, changed) => void`      | none                                               |
| `requests`      | handlers by name, sync or async | none: requests fail                                |
| `ref`           | `NativeHandle`                  | `command(name, args, { timeoutMs })` and `state()` |

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

`native-islands/components` has a typed component for each control in the
Swift `NativeIslandsComponents` library, under the same name and props:

| Component          | Native name        | Main props                                              |
| ------------------ | ------------------ | ------------------------------------------------------- |
| `GlassButton`      | `glassButton`      | `title`, `systemImage`, `icon`, `prominence`, `onPress` |
| `CloseButton`      | `closeButton`      | `onPress`                                               |
| `Menu`             | `menu`             | `title`, `items`, `onSelect`                            |
| `Toggle`           | `toggle`           | `isOn`, `onChange`, `label`                             |
| `SegmentedControl` | `segmentedControl` | `segments`, `selectedIndex`, `onChange`, `label`        |
| `Slider`           | `slider`           | `value`, `minimum`, `maximum`, `step`, `onChange`       |
| `Stepper`          | `stepper`          | `value`, `minimum`, `maximum`, `step`, `onChange`       |
| `Picker`           | `picker`           | `options`, `selectedIndex`, `style`, `onChange`         |
| `DatePicker`       | `datePicker`       | `date` (`yyyy-MM-ddTHH:mm`), `components`, `onChange`   |
| `ColorPicker`      | `colorPicker`      | `color`, `onChange`                                     |
| `TextField`        | `textField`        | `text`, `placeholder`, `onChange`, `onSubmit`, `handle` |
| `SystemSymbol`     | `symbol`           | `name`; children are the web drawing                    |
| `SymbolEffect`     | `symbolEffect`     | `name`, `effect`; children are the web drawing          |
| `Gauge`            | `gauge`            | `value`, `style`, `valueLabel`                          |

```tsx
import { Slider } from "native-islands/components";
import "native-islands/components.css";

<Slider value={volume} onChange={setVolume} label="Volume" />;
```

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
