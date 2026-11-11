# The page side

Everything a page does with `native-islands`: connecting, wrapping elements,
talking to the native view, and the layout rules that decide whether an island
is native or web.

## Contents

- [Install and entries](#install-and-entries)
- [The provider](#the-provider)
- [Defining a component](#defining-a-component)
- [Props are JSON](#props-are-json)
- [Events, state, requests and commands](#events-state-requests-and-commands)
- [Props every island takes](#props-every-island-takes)
- [Who sets the size](#who-sets-the-size)
- [Hooks](#hooks)
- [When an island stays web](#when-an-island-stays-web)
- [Screens that are not showing yet](#screens-that-are-not-showing-yet)
- [Without React](#without-react)
- [In a browser: the simulator](#in-a-browser-the-simulator)

## Install and entries

```bash
npm install native-islands
```

React 19 or later is an optional peer, needed for `/react` and `/components`.

| Import                          | For                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `native-islands/react`          | The React bindings: provider, `defineNativeComponent`, `Native`, hooks                  |
| `native-islands/components`     | The ready-made islands with their web versions                                          |
| `native-islands/components.css` | The styles of those web versions; import once, at the root                              |
| `native-islands`                | No framework: `connectNativeIslands`, capability helpers, `ISLAND_PHASE_ATTRIBUTE`      |
| `native-islands/simulator`      | A host written in JS that outlines where native views would sit, for browsers and tests |
| `native-islands/protocol`       | The zod schemas and wire types, only for writing another host or transport              |

## The provider

Render one `NativeIslandsProvider` at the root of the page, above every
island. It connects to the app, and once the first frame's islands are drawn
it tells the app to reveal the page.

```tsx
import { NativeIslandsProvider } from "native-islands/react";
import "native-islands/components.css";

export const Root = () => (
  <NativeIslandsProvider>
    <App />
  </NativeIslandsProvider>
);
```

| Prop            | Default                              | Use                                                                                       |
| --------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `announceReady` | `true`                               | Leave on. `false` only when you call `useNativeIslands().announceReady()` yourself        |
| `connect`       | `{}`                                 | `ConnectNativeIslandsOptions`: `report` for logging, `ackTimeoutMs`, a custom `transport` |
| `islands`       | one made by `connectNativeIslands()` | Share one controller you made yourself; never swap it after mounting                      |

It renders on the server too (Next.js App Router, any SSR): there it has no
app, so every island renders its web version, and islands go native once the
page hydrates inside the app. Never put a second provider inside the first.

## Defining a component

`defineNativeComponent` types a component the app registered under the same
name. Every part of the spec is optional.

```tsx
import * as React from "react";
import { defineNativeComponent, type NativeHandle } from "native-islands/react";

type SignupSpec = {
  props: { title: string; tint?: string; email: string };
  events: { submit: { email: string } };
  state: { email: string };
  requests: { validateEmail: { payload: { email: string }; result: { error?: string } } };
  commands: { focus: { args: undefined; result: undefined } };
};

export const SignupForm = defineNativeComponent<SignupSpec>("signupForm", {
  version: 1,
  colorProps: ["tint"],
});

export const Signup = ({ send }: { send: (email: string) => void }) => {
  const form = React.useRef<NativeHandle<SignupSpec["commands"], SignupSpec["state"]>>(null);
  const [email, setEmail] = React.useState("");
  return (
    <SignupForm
      ref={form}
      title="Join"
      tint="var(--accent)"
      email={email}
      onEmailChange={setEmail}
      onSubmit={({ email }) => send(email)}
      onValidateEmail={({ email }) => ({ error: email.includes("@") ? undefined : "Check it" })}
    >
      <WebSignupForm email={email} onEmail={setEmail} onSubmit={() => send(email)} />
    </SignupForm>
  );
};
```

| Option       | Default | Meaning                                                                                         |
| ------------ | ------- | ----------------------------------------------------------------------------------------------- |
| `version`    | `1`     | The lowest registered version this page works with; an older app shows the web version          |
| `sizing`     | `"web"` | Who sets the size; see [Who sets the size](#who-sets-the-size)                                  |
| `colorProps` | none    | Props holding a CSS colour or `var(--token)`, resolved to `rgb()`/`rgba()` before they are sent |

Define components at module level, never inside a render: the result is a
component, and a new one each render remounts the island.

Name rules: 1 to 64 characters, the same string the app registers, and
camelCase by convention (`glassButton`, `signupForm`). Raise `version` only
when the app's view gained something this page needs; the page then shows its
web version on apps that still register the old one.

## Props are JSON

Everything that is not an `on…` handler is a prop sent to the app, and it
must be JSON: strings, finite numbers, booleans, `null`, arrays and plain
objects. A `Date`, a `Map`, a class instance, `NaN` or a function in a non-`on`
prop makes the island show its web version and logs
`<name> is showing its web version: <prop> is not JSON.` Send dates as ISO
strings and colours through `colorProps`. `undefined` drops the key.

Every item an island draws (a tab, a row, a menu action, a badge) is a prop,
so the page adds one without an app update. Keep lists in props stable in
identity with an `id` per item, so the app can tell an edit from a new item.

## Events, state, requests and commands

| Kind    | Direction            | Page side                                              | Use for                                    |
| ------- | -------------------- | ------------------------------------------------------ | ------------------------------------------ |
| event   | app → page           | `on<Event>(payload)`                                   | A moment: a press, a submit, a selection   |
| state   | both                 | the prop `key` going in, `on<Key>Change(next)` out     | A value the user owns: on/off, text, value |
| request | app → page, answered | `on<Request>(payload)` returns the reply, or a promise | The app needs an answer: validate, look up |
| command | page → app, answered | `ref.current.command(name, args)`, a promise           | Tell the native view to act: focus, play   |

State carries a revision: the app ignores an echo of an older value, so the
page can pass the prop straight back without the native control flickering.
When the page also sets the value, as `email={email}` does above, list the key
in `props` as well as in `state`, the way the ready-made `Toggle` lists
`isOn`. Leave it out of `props` when only the user changes it.

`onStateChange(state, changed)` hears every state change at once.
`ref.current.state()` reads the latest state the app sent.

Events, state keys and requests share one set of `on…` props, so keep their
names apart: an event `valueChange` and a state key `value` would both be
`onValueChange`. A request with no handler fails at once, so the app never
waits on it.

A command rejects with a `NativeCommandError` whose `reason` says why:

| `reason`       | Meaning                                                            |
| -------------- | ------------------------------------------------------------------ |
| `unsupported`  | No app (a browser), or an app that takes no commands               |
| `not_ready`    | The island is not native right now: still mounting, or showing web |
| `invalid_args` | The arguments are not JSON                                         |
| `timeout`      | No answer in 5 seconds (change with `{ timeoutMs }`)               |
| `rejected`     | The app refused it: no such command, or its handler threw          |
| `unmounted`    | The island went away before the answer                             |

```tsx
import { NativeCommandError } from "native-islands/react";

const focus = async () => {
  try {
    await form.current?.command("focus");
  } catch (error) {
    if (error instanceof NativeCommandError && error.reason !== "rejected") {
      webInput.current?.focus();
    } else {
      throw error;
    }
  }
};
```

A command always needs a web path too: in a browser every command rejects
with `unsupported`, and in an app without the component with `not_ready`.

## Props every island takes

| Prop            | Default            | Meaning                                                                                                                                                                               |
| --------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `children`      | none               | The web version. For a ready-made island, replaces its built-in web version                                                                                                           |
| `native`        | `true`             | `false` keeps the web version, such as for a setting that turns native off                                                                                                            |
| `islandId`      | a generated id     | Only when something outside needs the id; it must be unique on the page                                                                                                               |
| `accessibility` | read from children | `{ label?, hint?, value?, traits?, hidden? }`. It describes a single control, and only names the group of an island with several; see [Accessibility](custom-island.md#accessibility) |
| `ref`           | none               | A `NativeHandle`: `command(name, args, { timeoutMs })` and `state()`                                                                                                                  |

A duplicate `islandId`, or more than 256 islands at once, shows the web
version for the extra ones.

## Who sets the size

| `sizing`         | Width from      | Height from     | For                                                          |
| ---------------- | --------------- | --------------- | ------------------------------------------------------------ |
| `"web"`          | the web version | the web version | Most islands: the native view fills the web element's box    |
| `"native"`       | the native view | the native view | A control whose size only native knows, such as a menu label |
| `"nativeHeight"` | the web version | the native view | Text or a list that wraps to the page's width                |

With `"web"`, the children are the island's box: give them the size the native
control should have. The wrapper itself is `display: contents`, so style the
children, never the island. With `"native"` and `"nativeHeight"`, the web
version sets the size until the app reports one; an app without the
`nativeHeight` feature sizes `"nativeHeight"` like `"web"`.

## Hooks

| Hook                                    | Returns                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| `useNativeSupport(component, version?)` | `"supported"`, `"unavailable"`, `"unknown_component"` or `"unsupported_version"`        |
| `useNativeIslandsReady()`               | `true` once no island is still on its way to native                                     |
| `useNativeIslands()`                    | The controller: `announceReady()`, `capability`, `supports()`, `command()` and the rest |

Use `useNativeSupport` to choose a different layout when native is there, such
as hiding a web-only hint, never to decide whether to render the island: the
island already falls back by itself. On the server and during hydration it
returns `"unavailable"`.

## When an island stays web

The library checks every island on every layout pass. An island shows its web
version, by design, when:

- its element, or an ancestor, is `display: none`, `visibility: hidden` or has
  no size;
- an ancestor has a 3D transform, a CSS `filter` or a `clip-path` (2D
  transforms and opacity are followed);
- it sits inside an `inert` element that is not marked with
  `data-island-phase` (it waits there, mounted and hidden);
- the page covers all of it. A page element over part of it, such as a
  dropdown passing over, is cut out of the native view so the overlay shows;
- the app did not register its name, or registered an older `version`;
- its children have no laid-out element (bare text, `null`, hidden).

Positioning works everywhere: the page's own scrolling, inner `overflow`
scrollers, `position: sticky` and `position: fixed`. A new inner scroller
takes WebKit a few frames to back with a scroll view; the app waits up to a
second, and the island stays web if it never shows.

A refusal (an unknown name, an older version, props that are not JSON,
children with no element) is logged to the console with the component's name.
A layout hand-off is not logged: read it from the island's wrapper, whose
`data-island-mode` is `web`, `pending` or `native` and whose
`data-island-handoff` names the cause (`hidden`, `inactive`, `transformed`,
`covered` and others). Use Safari's Web Inspector (Develop menu, the
simulator or the iPhone); [Debug an island](../workflows/debug.md) walks
through it.

Animating layout (width, height, top) on a page with many islands costs about
0.3 ms per island per frame; animate `transform` and `opacity` instead.

## Screens that are not showing yet

A screen that is rendered but not on stage, such as the next step of a flow, a
pushed route or a tab that is not selected, keeps its islands only while it is
laid out. Park it instead of hiding it:

- Mark it `inert` while it waits, and move it off screen with a `transform`,
  each waiting screen at its own position, so no two overlap.
- While it slides on or off stage, mark it with `data-island-phase`
  (`ISLAND_PHASE_ATTRIBUTE`); the app then runs the same slide on its islands.
- Never `display: none`: that unmounts the native views, and they flash in
  web when the screen appears.

```tsx
import { ISLAND_PHASE_ATTRIBUTE } from "native-islands";

const Step = ({ index, current, sliding, children }: StepProps) => (
  <section
    className="step"
    inert={index !== current}
    {...{ [ISLAND_PHASE_ATTRIBUTE]: sliding ? "" : undefined }}
    style={{ transform: `translateX(${(index - current) * 100}%)` }}
  >
    {children}
  </section>
);
```

A parked screen that holds a device (camera, video, a timer) should let go
while it is not showing.

## Without React

`connectNativeIslands()` gives the controller the React bindings sit on.
Without them the page does their work itself: it measures each element,
mounts it, moves it with `islands.update(id, { frame })` when the layout
changes, hides the web version while the native one shows, and passes state
both ways. Nothing follows scrolling areas, transforms or transitions for it,
so use the React bindings for anything beyond a few fixed islands.

A ready-made island takes the props of its spec (the `Native…` names in
[the specs underneath](components.md#the-specs-underneath)), not the React
component's: the native `toggle` takes `isOn`, `tint?` and `disabled?`, sends
`isOn` as state and is sized by the native switch (`sizing: "native"`). Its
`label` is the island's `accessibility.label`. Every ready-made island is
version 1. `islands.supports()` is right as soon as `connectNativeIslands()`
returns: the app puts what it offers on the page before any script runs.

| Listener                            | When                                                    | What the page does                                      |
| ----------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| `onReady()`                         | The native view is drawn                                | Hide the web version with `opacity: 0`, never `display` |
| `onPending()`, `onStall()`          | It is being drawn again, or the app is slow to answer   | Show the web version                                    |
| `onFallback(reason, message?)`      | The island is web for good                              | Show the web version; the island is gone                |
| `onState(state, changed, revision)` | The user changed state natively                         | Store it, like a web control's change                   |
| `onEvent(name, payload)`            | An event, such as `press`                               | Act on it                                               |
| `onSize({ width, height })`         | `sizing: "native"` or `"nativeHeight"`: the native size | Size the web element to it, so the page lays out        |
| `onRequest(name, payload)`          | A request; return the answer or a promise of it         | Answer it                                               |

```ts
import { connectNativeIslands } from "native-islands";

const { islands } = connectNativeIslands();
let wifiOn = true;

const wifi = document.querySelector<HTMLInputElement>("#wifi");
const frameOf = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height };
};

if (wifi) {
  wifi.checked = wifiOn;
  const setWifi = (next: boolean) => {
    wifiOn = next;
    wifi.checked = next;
    islands.update("wifi", { props: { isOn: next } });
  };
  wifi.addEventListener("change", () => setWifi(wifi.checked));

  if (islands.supports("toggle", 1) === "supported") {
    islands.mount(
      "wifi",
      {
        component: "toggle",
        version: 1,
        props: { isOn: wifiOn },
        frame: frameOf(wifi),
        anchor: { type: "page" },
        visible: true,
        order: 0,
        sizing: "native",
        accessibility: { label: "Wi-Fi" },
      },
      {
        onReady: () => (wifi.style.opacity = "0"),
        onPending: () => (wifi.style.opacity = ""),
        onStall: () => (wifi.style.opacity = ""),
        onFallback: () => (wifi.style.opacity = ""),
        onState: (state) => {
          if (typeof state.isOn === "boolean") setWifi(state.isOn);
        },
        onSize: ({ width, height }) => {
          wifi.style.width = `${width}px`;
          wifi.style.height = `${height}px`;
          islands.update("wifi", { frame: frameOf(wifi) });
        },
      },
    );
  }
  addEventListener("resize", () => islands.update("wifi", { frame: frameOf(wifi) }));
}

islands.announceReady();
```

`islands.update` for an id that is not mounted does nothing, so the web path
needs no checks. The frame is in page coordinates with `anchor: { type:
"page" }`, so the page's own scrolling needs no updates; a scrolling area
inside the page does. Always call `islands.announceReady()` once the first
islands are mounted, native or not, or the app reveals the page only after
its timeout.

## In a browser: the simulator

`installNativeSimulator` stands in for the app in a browser: it outlines where
each native view would sit and lets tests press, set state and answer
requests. Install it before the provider renders, and only in a browser.

```tsx
import { installNativeSimulator } from "native-islands/simulator";

if (new URLSearchParams(location.search).get("native") === "simulate") {
  installNativeSimulator({ components: { glassButton: 1, toggle: 1 } });
}
```

The simulator proves the page's side only. Prove the island itself in the app,
on a simulator or an iPhone.
