# Add an island to a page

You are turning one part of a page that already uses Native Islands into a
native view: a control, a sheet, a bar, a list, or a view of the app's own.

## Checklist

- [ ] Chosen: a ready-made island, or one of your own
- [ ] The web version kept as children, laid out at the native control's size
- [ ] Values the user owns wired as state, moments as events
- [ ] Every prop JSON; colours through top-level colour props
- [ ] For your own island: the Swift view registered under the same name and version
- [ ] Seen native in the app and web in a browser

## 1. Choose

Look the job up in
[Which island for the job](../references/components.md#which-island-for-the-job).

- **A ready-made island fits:** go to step 2. The app needs no change if it
  calls `NativeIslandsComponents.register()`; if it registers with
  `register(only:)`, add the new name there.
- **It is a map or a chart:** the app also needs `NativeIslandsMaps` or
  `NativeIslandsCharts` registered.
- **Nothing fits, or the app has the view already:** write your own, both
  halves, as in [Writing your own island](../references/custom-island.md),
  then go to step 3.
- **It must sit on top of another island** (a badge, a label): make it a prop
  of that island instead. Nothing on the page draws over an island.

## 2. Wire it on the page

Keep the page's own element as the children, or leave children out to use the
island's built-in web version. Children you pass handle their own clicks.

```tsx
import * as React from "react";
import { SegmentedControl } from "native-islands/components";

const RANGES = ["Day", "Week", "Month"];

export const RangePicker = () => {
  const [range, setRange] = React.useState(1);
  return (
    <SegmentedControl
      label="Range"
      segments={RANGES}
      selectedIndex={range}
      onChange={setRange}
    />
  );
};
```

Then check the page's layout around it:

- The island's box is its web version's box. Give that element the size and
  margins the native control should have; never style the island itself.
- A map, video, camera or material fills its parent, so give the parent a size.
- No ancestor of the island has a 3D transform, a `filter` or a `clip-path`.
- If it sits in a screen that slides in, that screen is parked, not hidden;
  see [Screens that are not showing yet](../references/page.md#screens-that-are-not-showing-yet).
- A sheet, popover or cover presents another page: create that page, of the
  same origin, with its own `NativeIslandsProvider`.

## 3. Verify

1. In a browser: the web version looks right and works on its own (clicks,
   typing, keyboard).
2. Optionally in a browser with the simulator
   (`installNativeSimulator({ components: { … } })`): an outline sits exactly
   over the web version.
3. In the app with `-NativeIslandsOutlines YES`: the island has its magenta
   outline and name. Scroll, rotate and switch light and dark: it stays put.
4. Use it with real touches: the page hears every event and state change, and
   a value the page sets (a reset button) shows in the native control.
5. Turn on VoiceOver once: the island reads its label.

If it stays web, follow [Debug an island](debug.md).

## Pitfalls

- Children with a fixed width when the native control is wider: the native
  view is squeezed into the web version's box.
- A control whose value prop never changes: on the web it keeps the old value.
- A colour such as `oklch()` or one nested in an item that is not hex or
  `rgb()`: the app draws its default colour.
- A command without a web path: in a browser it always fails.

More in [Pitfalls](../references/pitfalls.md).
