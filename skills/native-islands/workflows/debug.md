# Debug an island

You are finding out why an island shows its web version, sits in the wrong
place, flashes, misses touches or does not update. Work from what the app and
the page report; never guess, and never hide the web version to "force"
native.

## Checklist

- [ ] Reproduced in the app, not a browser (a browser only ever shows web)
- [ ] Outlines on: `-NativeIslandsOutlines YES`
- [ ] The page's console open in Safari's Web Inspector (`isInspectable` on in Debug)
- [ ] The island's `data-island-mode` and `data-island-handoff` read
- [ ] The cause found in the tables below, fixed, and seen native again

## 1. Look at the island

In the Web Inspector console, list every island and what it is doing:

```js
[...document.querySelectorAll("[data-island]")].map((island) => [
  island.getAttribute("data-island"),
  island.getAttribute("data-island-mode"),
  island.getAttribute("data-island-handoff"),
]);
```

`data-island` is the component's name. `data-island-mode` is `web` (it will
not go native), `pending` (sent to the app, not drawn yet) or `native`.
`data-island-handoff`, on a native or pending island, says why the web
version shows for now.

## 2. Every island is web

| Check                                                          | Cause and fix                                                                                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `window.webkit?.messageHandlers?.nativeIslands` is `undefined` | The web view has no host: use `IslandWebView` or attach a `NativeIslandsHost`, and keep a strong reference to it      |
| `webView.islands?.isOffering` is `false` in the app            | Nothing was registered when the web view was created: register at launch, before creating it                          |
| `useNativeSupport("toggle")` is `"unavailable"`                | As above, or the page renders before hydration only (SSR): it goes native once it hydrates                            |
| Only the pages of a sheet or popover are web                   | The app registered on a registry of its own; presentations read `NativeComponentRegistry.shared`                      |
| The page waits two seconds, then shows                         | No `NativeIslandsProvider`, `announceReady={false}` without announcing, or no `islands.announceReady()` without React |

## 3. One island is web

When `data-island-mode` is `web`, the console has a warning in the form
`<name> is showing its web version: <reason>`, or an error that a prop is not
JSON:

| Reason                | Fix                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `unknown_component`   | The app did not register that name: add it, or to `register(only:)`, and check the spelling on both sides                       |
| `unsupported_version` | The app registers an older version than the page's `version`: update the app or lower `version`                                 |
| `no_elements`         | The children are bare text, `null` or hidden: wrap one laid-out element                                                         |
| `… is not JSON`       | A `Date`, `Map`, class instance, `NaN` or function in a prop: send plain JSON                                                   |
| `invalid_spec`        | The island fails the wire schema: an empty `islandId` or one over 128 characters, or a frame or accessibility that is not valid |
| `invalid_props`       | The app could not read the island's message; a page and an app on far-apart versions                                            |
| `duplicate_id`        | Two islands share an `islandId`: drop it, or make it unique                                                                     |
| `limit_exceeded`      | More than 256 islands at once: park fewer screens, or keep long lists in one `List` island                                      |
| `anchor_not_found`    | The app found no scroll view for an inner scroller; it is new or never got one; see below                                       |
| `timeout`             | The app has not answered yet; it switches when it does. Persisting means the view never calls `ready()`                         |

## 4. Native, but the web version shows for now

`data-island-handoff` says why; the island goes native again on its own once
the cause is gone.

| Value         | Meaning and fix                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `hidden`      | It, or an ancestor, is `display: none`, `visibility: hidden`, zero size or scrolled out of a clipping parent     |
| `inactive`    | It is inside an `inert` element without `data-island-phase`: a parked screen, as intended, or an `inert` left on |
| `moving`      | An ancestor is running a CSS transition or animation; mark sliding screens with `data-island-phase` instead      |
| `transformed` | An ancestor has a 3D transform, a `filter` or a `clip-path`: remove it, or move the island out of it             |
| `faded`       | An ancestor is partly transparent where the app cannot follow it                                                 |
| `clipped`     | A clipping parent cuts it where the app cannot cut the native view the same way                                  |
| `covered`     | A page element covers all of it: move the overlay, or make it a prop of the island                               |

## 5. Other symptoms

| Symptom                                         | Cause and fix                                                                                                                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native view is offset or trails while scrolling | Run with `-NativeIslandsAlignmentLog YES`. Animating `width`, `height` or `top` trails a frame; animate `transform` and `opacity`                                           |
| Native view is the wrong size                   | The web version's box is the island's: fix its CSS. For your own view, match `sizing` and the SwiftUI frame; see [Size](../references/custom-island.md#size)                |
| A flash of web versions when a screen slides in | The screen was mounted or shown late: park it laid out, `inert`, off screen; see [Screens that are not showing yet](../references/page.md#screens-that-are-not-showing-yet) |
| A flash of colour when the page loads           | The cover takes the web view's background: set it to the page's, in light and dark                                                                                          |
| Taps do nothing on a simulator                  | Synthetic simulator taps never reach WebKit: use real touches (`axe tap --tap-style physical`, XCUITest)                                                                    |
| Islands in an inner scroller miss taps          | A web view of your own does not forward `hitTest` to the host; see [Your own web view](../references/host.md#your-own-web-view)                                             |
| Sheets, menus or pickers do not open            | The web view is not in a view controller's view, or does not forward `didMoveToWindow`                                                                                      |
| A sheet does not open its page                  | Its `url` is not of the presenting page's origin; the app's log says so                                                                                                     |
| A switch or field jumps back to an old value    | The value is wired as an event instead of state, or the page never passes the new value back as the prop                                                                    |
| An event never reaches the page                 | The handler name does not match (`submit` is `onSubmit`), the island was parked or hidden when it fired, or the payload is not JSON                                         |
| A nested number is always `nil` or 0 in Swift   | Read it through `NSNumber`, never `as? Int`                                                                                                                                 |
| A colour is ignored                             | It is nested in an item and is not hex or `rgb()`, or it is `oklch()` / `color-mix()`                                                                                       |
| A command always fails                          | `unsupported` in a browser and `not_ready` before the island is native: give it a web path                                                                                  |

## Verify the fix

Reload the page in the app with outlines on: the island has its outline, its
`data-island-mode` is `native` and it has no `data-island-handoff`. Then check
the same page in a browser still works on its web versions.

More in [Pitfalls](../references/pitfalls.md).
