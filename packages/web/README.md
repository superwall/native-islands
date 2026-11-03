# @superwall/native-islands

The page side of NativeIslands. Wrap a web element, and on an app that hosts
islands it is replaced by a real native view placed exactly where the element
is. Everywhere else the web element stays.

| Entry                                 | For                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `@superwall/native-islands`           | Any page, no framework: the island controller, the WebKit transport, layout helpers, the protocol schemas          |
| `@superwall/native-islands/react`     | React bindings                                                                                                     |
| `@superwall/native-islands/simulator` | A host written in JS that draws outlines where native views would sit, for browsers and tests. No framework needed |

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
like system glass. The example pages define a set of glass buttons and controls
in `tests/pages/src/components/defaults.ts`.

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

## Without React

```ts
import { connectNativeIslands } from "@superwall/native-islands";

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
