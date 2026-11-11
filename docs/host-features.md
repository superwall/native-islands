# Host features and the rules behind them

The README describes how Native Islands works. This page holds the exact names,
numbers and rules a host or a page author needs, with the file each value
lives in.

## Features a host offers

A host lists the features it supports in its capability, and the page only
sends what a feature describes when the host offers it
(`packages/web/src/protocol/schemas.ts`). A host that offers none of them still
draws islands; elements that need a missing feature show their web version.

| Feature        | What the page sends                                                                                                 | What the host does                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `layered`      | Islands of pages that are rendered but not on screen, such as the next step of a flow                               | Places them inside those pages' scrolling areas, so they slide in already native         |
| `sticky`       | A `position: sticky` element's box where it sits unstuck, its inset and how far it may travel                       | Runs the same sticky rule on every scroll, in the same frame as the content              |
| `clip`         | The part of an island a clipping box shows, such as an accordion while it opens                                     | Cuts the native view to that part, so it is revealed as the box opens                    |
| `transform`    | The 2D transform and opacity of a rotated, scaled or translucent box around the element                             | Draws the native view turned, scaled and faded the same way                              |
| `motion`       | The CSS slide of an island outside any scrolling area: translate-only keyframes, Bézier easing and how far in it is | Runs the same slide in Core Animation, and hides the view where the next page covers it  |
| `reuse`        | The id of an island that went away, named in a new island's mount                                                   | Shows the kept native view in the new island's place instead of creating one (see below) |
| `nativeHeight` | Islands sized `nativeHeight`: the element's width, with a height the host fills in                                  | Measures the view at that width and reports back only its height                         |

A 3D transform, a filter or a clip path can't be described this way, so an
island inside one shows its web version on every host.

## Reusing a native view

An island that comes back, such as a search result showing again, reuses the
native view it had:

- When the page unmounts an island the host has shown, a host that offers
  `reuse` may keep its view hidden instead of destroying it.
- The page remembers unmounted islands for 60 seconds and at most 128 at once
  (`NATIVE_REUSE_WINDOW_MS` and `NATIVE_REUSE_LIMIT` in
  `packages/web/src/islands/controller.ts`).
- A new island with the same component, version, sizing, props and scrolling
  area that mounts while its row first renders names the old id in its mount's
  `reuse` field.
- The host shows the kept view in its place with no fade and acknowledges it,
  even when WebKit hasn't yet given the scrolling area its new content size.
- The page hides the web version from the first frame and shows it again if
  the host hasn't answered within 150 ms (`REUSE_GRACE_MS` in
  `packages/web/src/react/hooks/useNativeIsland.ts`). A host that no longer has
  the view, or can't use it, mounts the island as usual.
- Hosts should keep views a little longer than the page asks and drop them
  when the page reloads. The Swift host keeps them 65 seconds
  (`retiredLifetime` in `NativeIslandManager+Reuse.swift`).

## Pages that wait off screen

The host tells scrolling areas apart by their size and position. A page that
keeps several screens rendered at once, as the scenario gallery and the
example app do, must give each waiting screen its own spot: two screens of the
same size must not wait in the same place, or the host can't tell which
scrolling area an island belongs to.

Mark a waiting screen with `data-island-phase` or `inert` and move it off
screen or underneath, rather than hiding it with `display: none`, so its
islands mount right away and move with it when it slides in.

## How VoiceOver reaches islands

WebKit gives VoiceOver the whole page as one element, and the native views it
holds in its scroll views are not part of it. So each island has one source
for VoiceOver, chosen by where the host placed it:

- **In the page or an inner scrolling area:** VoiceOver reads the web
  version. Behind the native view the page hides it from sight and from
  touches (`opacity: 0` and `pointer-events: none` in
  `packages/web/src/react/dom/styles.ts`), never with `visibility: hidden`,
  so it keeps its place in reading order. Its own handlers drive the island,
  so a double-tap or an adjustment reaches the native view through the page.
  The host hides these native views from accessibility
  (`applyAccessibility` in `NativeIsland.swift`), so nothing is read twice.
- **In the screen layer** (fixed elements such as a tab bar or a nav bar):
  VoiceOver reads the native view, with the `accessibility` the page sends.

A web version is therefore what VoiceOver says for most islands: give it real
roles, states and labels. The ready-made ones match their native controls.

## What the tests hold to

- **Alignment** (`tests/ios/TestHostUITests/AlignmentUITests.swift`) opens
  every scenario page and fails when a drawn island is more than 0.5 pt from
  its web element, when an island has no web element, or when a scenario that
  expects a native view still shows its web version. It also scrolls, and
  pushes and pops the flow.
- **Screenshots** (`tests/ios/TestHostUITests/ScreenshotUITests.swift`)
  compare each still page with the baseline for its iOS major and device in
  `tests/ios/Baselines/`. A pixel counts as different when a colour channel
  moves by more than 24 of 255, and a page fails when more than 0.2% of its
  pixels differ.
- **Accessibility** (`tests/ios/TestHostUITests/AccessibilityUITests.swift`)
  fails when an island in the page, in an inner scrolling area or in the
  screen layer is missing from the accessibility tree or appears more than
  once, or reads the wrong state.
- **Performance** is described in [`performance.md`](performance.md), and
  each iOS release's results in [`compatibility.md`](compatibility.md).
