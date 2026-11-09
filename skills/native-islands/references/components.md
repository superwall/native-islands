# Ready-made islands

Every island `native-islands/components` exports, with its native name, what
it takes and what to watch for. Each one is a React component whose default
children are a web version built to the native control's size and shape, so
it works in a browser and in an app that did not register it. Import
`native-islands/components.css` once at the root for those web versions.

## Contents

- [Which island for the job](#which-island-for-the-job)
- [Rules every ready-made island follows](#rules-every-ready-made-island-follows)
- [Buttons](#buttons)
- [Controls](#controls)
- [Symbols and gauges](#symbols-and-gauges)
- [Media and system buttons](#media-and-system-buttons)
- [Presentations](#presentations)
- [App chrome](#app-chrome)
- [Lists](#lists)
- [Gestures, materials and system services](#gestures-materials-and-system-services)
- [Map and chart](#map-and-chart)
- [The specs underneath](#the-specs-underneath)

## Which island for the job

| Job                                       | Island                                              | Native name                           |
| ----------------------------------------- | --------------------------------------------------- | ------------------------------------- |
| A call to action, an icon button          | `GlassButton`                                       | `glassButton`                         |
| Close a sheet                             | `CloseButton`                                       | `closeButton`                         |
| A button that opens a menu                | `Menu`                                              | `menu`                                |
| On or off                                 | `Toggle`                                            | `toggle`                              |
| One of a few options, side by side        | `SegmentedControl`                                  | `segmentedControl`                    |
| One of many options                       | `Picker` (`menu` or `wheel`)                        | `picker`                              |
| A number in a range                       | `Slider`, `Stepper`                                 | `slider`, `stepper`                   |
| A date or a time                          | `DatePicker`                                        | `datePicker`                          |
| A colour                                  | `ColorPicker`                                       | `colorPicker`                         |
| Typed text with the system keyboard       | `TextField`                                         | `textField`                           |
| An SF Symbol, still or animated           | `SystemSymbol`, `SymbolEffect`                      | `symbol`, `symbolEffect`              |
| Progress or a level                       | `Gauge`                                             | `gauge`                               |
| Play a video                              | `Video`                                             | `video`                               |
| The live camera                           | `Camera`                                            | `camera`                              |
| Let a person choose photos                | `PhotoPicker`                                       | `photoPicker`                         |
| Share a link or text                      | `ShareButton`                                       | `shareButton`                         |
| A button that buzzes                      | `HapticButton`                                      | `hapticButton`                        |
| Ask for camera, location, photos and more | `Permission`                                        | `permission`                          |
| A hint about a feature                    | `Tip`                                               | `tip`                                 |
| Another page over this one                | `Sheet`, `FullScreenCover`, `Popover`, `Inspector`  | `presentation`                        |
| A question with buttons                   | `Alert`, `ConfirmationDialog`                       | `alert`                               |
| Tabs at the bottom                        | `TabView`, or `TabBar`, `SearchTab`, `TabAccessory` | `tabBar`, `searchTab`, `tabAccessory` |
| A search field on glass                   | `SearchField`                                       | `searchField`                         |
| Screens that push and pop                 | `NavigationStack`, or `NavigationBar`               | `navigationBar`                       |
| A bar of buttons                          | `Toolbar`                                           | `toolbar`                             |
| Settings rows, a table, an outline        | `List`                                              | `list`                                |
| A context menu or a long press            | `ContextMenu`, `LongPressGesture`                   | `interaction`                         |
| A blurred or glass backdrop               | `MaterialBackground`                                | `material`                            |
| Haptic patterns from code                 | `Haptics`, `useHaptics`                             | `haptics`                             |
| Local notifications                       | `Notifications`, `useNotifications`                 | `notifications`                       |
| A map with places                         | `MapView`                                           | `map` (`NativeIslandsMaps`)           |
| A chart                                   | `Chart`                                             | `chart` (`NativeIslandsCharts`)       |

Everything above but the map and the chart is registered by
`NativeIslandsComponents.register()`. The map needs
`NativeIslandsMaps.register()` and the chart `NativeIslandsCharts.register()`;
see [registering](host.md#register-components).

## Rules every ready-made island follows

- **Controlled.** A control takes its value as a prop and reports changes
  through `onChange`. Keep the value in React state and set it there; a
  control whose prop never changes keeps showing the old value on the web.
- **`label` is required on controls.** `Toggle`, `SegmentedControl`,
  `Slider`, `Stepper`, `Picker`, `DatePicker`, `ColorPicker`, `TextField`,
  `Gauge` and `Permission` need `label`: it is the VoiceOver label of both
  versions. An icon-only `GlassButton` or `Menu` takes `label` for the same
  reason.
- **`systemImage` is native, `icon` is web.** `systemImage` names an SF
  Symbol the native view draws; `icon` (or `icon={renderer}` on bars and
  lists, a `SymbolRenderer`) is the web version's drawing of it. Without
  `icon` the web version shows no symbol, except for the few glyphs it draws
  itself (plus, minus, checkmark, cross, chevrons).
- **Colours.** The app reads only hex and `rgb()`/`rgba()`. A top-level
  colour prop (`tint`, `background`, `color`, `glassTint`) may be any colour
  the page computes to `rgb()`, a `var(--token)` included: the library
  computes it on the page when it sends the props. A colour nested in an item
  (a bar item's or swipe action's `tint`, a row's `iconTint`, a series'
  `color`) only has its `var()` replaced, so it must end up as hex or `rgb()`.
  `oklch()`, `color()` and `color-mix()` reach the app unread.
- **`glassGroup`.** Glass islands with the same `glassGroup` share one glass
  container, so their glass blends and morphs together, as SwiftUI's
  `GlassEffectContainer` does. Give buttons that sit side by side one group.
- **Every item is a prop.** Tabs, bar items, rows, menu items and alert
  buttons are arrays of plain objects with an `id`; the page adds one without
  an app update, and events report the `id`.
- **Passing `children` replaces the built-in web version.** Do it when the
  page has its own design; keep the size of the native control (rule 1 of
  [the skill](../SKILL.md#hard-rules)).
- **Common props.** Every island also takes `native`, `islandId` and
  `accessibility`; see [props every island takes](page.md#props-every-island-takes).

## Buttons

| Island        | Native name   | Props                                                                                           | Calls          |
| ------------- | ------------- | ----------------------------------------------------------------------------------------------- | -------------- |
| `GlassButton` | `glassButton` | `title?`, `systemImage?`, `icon?`, `prominence?`, `tint?`, `disabled?`, `glassGroup?`, `label?` | `onPress`      |
| `CloseButton` | `closeButton` | `tint?`, `glassGroup?`, `label?` (default `Close`)                                              | `onPress`      |
| `Menu`        | `menu`        | `items`, `title?`, `systemImage?`, `icon?`, `prominence?`, `tint?`, `glassGroup?`, `label?`     | `onSelect(id)` |

A `GlassButton` with a `title` is a capsule; with only `systemImage` it is a
circle. `prominence="prominent"` fills it with `tint`. A `MenuItem` is
`{ id, title, systemImage?, destructive?, checked?, children? }`; an item with
`children` opens a submenu, and `checked` draws a checkmark.

```tsx
<div className="actions">
  <GlassButton
    systemImage="heart"
    icon={<HeartIcon />}
    label="Favourite"
    glassGroup="actions"
    onPress={favourite}
  />
  <Menu
    systemImage="ellipsis"
    icon={<MoreIcon />}
    label="More"
    glassGroup="actions"
    items={[
      { id: "rename", title: "Rename", systemImage: "pencil" },
      { id: "delete", title: "Delete", systemImage: "trash", destructive: true },
    ]}
    onSelect={act}
  />
</div>
```

## Controls

| Island             | Native name        | Value props                                                                                                | Calls                                                          | Size                                          |
| ------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------- |
| `Toggle`           | `toggle`           | `isOn`, `tint?`, `disabled?`                                                                               | `onChange(isOn)`                                               | the native switch                             |
| `SegmentedControl` | `segmentedControl` | `segments`, `selectedIndex`, `disabled?`, `glassGroup?`                                                    | `onChange(index)`                                              | the width it is given                         |
| `Slider`           | `slider`           | `value`, `minimum?` (0), `maximum?` (1), `step?`, `minimumSymbol?`, `maximumSymbol?`, `tint?`, `disabled?` | `onChange(value)`                                              | the width it is given                         |
| `Stepper`          | `stepper`          | `value`, `minimum`, `maximum`, `step?` (1), `disabled?`                                                    | `onChange(value)`                                              | the web version                               |
| `Picker`           | `picker`           | `options`, `selectedIndex`, `style?` (`menu`), `tint?`                                                     | `onChange(index)`                                              | `menu`: native; `wheel`: its box, 216 pt tall |
| `DatePicker`       | `datePicker`       | `date`, `components?` (`date`), `style?` (`compact`), `tint?`                                              | `onChange(date)`                                               | the web version                               |
| `ColorPicker`      | `colorPicker`      | `color` (`#rrggbb`)                                                                                        | `onChange(color)`                                              | the web version                               |
| `TextField`        | `textField`        | `text`, `placeholder?`, `kind?` (`plain`), `submitLabel?`, `tint?`, `handle?`                              | `onChange(text)`, `onSubmit?(text)`, `onFocusChange?(focused)` | the web version                               |

- `DatePicker` reads and writes local time as `yyyy-MM-ddTHH:mm`, with no
  zone, for every `components` (`date`, `time`, `dateAndTime`). Its `style` is
  `compact` (a pill that opens a calendar), `graphical` or `wheel`.
- `TextField`'s `kind` is `plain`, `email`, `number` or `secure`, and sets
  the keyboard. `handle` is a `TextFieldHandle` with `focus()` and `blur()`;
  the keyboard is the system's, so focus it through the handle, never by
  focusing the web input.
- What a person types reaches the page as state with a revision, so the
  page setting `text` back to what it heard never jumps the native field.

```tsx
const [plan, setPlan] = useState(0);
const [email, setEmail] = useState("");
const field = useRef<TextFieldHandle>(null);

<>
  <SegmentedControl
    label="Plan"
    segments={["Monthly", "Yearly"]}
    selectedIndex={plan}
    onChange={setPlan}
  />
  <TextField
    label="Email"
    kind="email"
    placeholder="you@example.com"
    text={email}
    submitLabel="done"
    handle={field}
    onChange={setEmail}
    onSubmit={subscribe}
  />
</>;
```

## Symbols and gauges

| Island         | Native name    | Props                                                                                        | Notes                          |
| -------------- | -------------- | -------------------------------------------------------------------------------------------- | ------------------------------ |
| `SystemSymbol` | `symbol`       | `name`, `tint?`, `weight?`, `pointSize?`, `children` (required)                              | `children` is the web drawing  |
| `SymbolEffect` | `symbolEffect` | `name`, `effect`, `trigger`, `active`, `tint?`, `pointSize?`, `children`                     | Effects from iOS 17            |
| `Gauge`        | `gauge`        | `value` (0 to 1), `style`, `label`, `valueLabel?`, `minimumLabel?`, `maximumLabel?`, `tint?` | iOS 16+; web version on iOS 15 |

`SymbolEffect` plays `bounce` and `wiggle` once each time `trigger` changes
(increment a counter); `pulse`, `variableColor`, `breathe` and `rotate` run
while `active` is true; `replace` animates a change of `name`. `breathe`,
`rotate` and `wiggle` need iOS 18, and iOS 17 plays the nearest effect it has;
iOS 15 and 16 show the still symbol. `Gauge`'s `style` is `circular`,
`capacity`, `linear`, `bar` or `spinner`.

## Media and system buttons

| Island         | Native name    | Props                                                                                                           | Calls                           | Notes                                        |
| -------------- | -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------- |
| `Video`        | `video`        | `url`, `webUrl?`, `webType?`, `poster?`, `handle?`                                                              | `onStatus(status)`              | Fills its parent                             |
| `Camera`       | `camera`       | `position?` (`back`), `running?` (true), `handle?`                                                              | `onStatus(state)`               | Fills its parent; `NSCameraUsageDescription` |
| `PhotoPicker`  | `photoPicker`  | `limit?` (1), `title?`, `systemImage?`, `icon?`, `prominence?`, `tint?`, `glassGroup?`                          | `onPick(images)`                | No permission needed                         |
| `ShareButton`  | `shareButton`  | `text?`, `url?`, `title?`, `systemImage?` (`square.and.arrow.up`), the button look                              | `onComplete?(activity)`         | `null` when cancelled                        |
| `HapticButton` | `hapticButton` | `feedback`, the button look                                                                                     | `onPress?`                      | Buzzes on touch, before the page hears       |
| `Permission`   | `permission`   | `kind`, `label`, `tint?`                                                                                        | `onStatus?(status)`             | Sized by the native button                   |
| `Tip`          | `tip`          | `id`, `title`, `message?`, `systemImage?`, `icon?`, `actions?`, `arrowEdge?`, `tint?`, `background?`, `handle?` | `onAction?(id)`, `onDismiss?()` | iOS 17+, height from TipKit                  |

- `Video` plays `url` with AVFoundation (an HLS stream works); give browsers
  that cannot play it `webUrl`. Its `VideoHandle` has `play()`, `pause()` and
  `pictureInPicture()`; `VideoStatus` is
  `{ playing, time, duration, pictureInPicture }`.
- `Camera` holds the camera only while `running`. Pass `running={false}`
  while its screen is parked or hidden, so it lets go of the camera. `CameraHandle.capture()` resolves to a JPEG data URL,
  or `null`. Its `CameraState` is `starting`, `running`, `unavailable` or
  `denied`.
- `Video`, `Camera`, `MapView`, `Chart` and `MaterialBackground` take the size
  of their parent: give the parent one.
- `PhotoPicker` hands back JPEG data URLs, in order.
- `HapticFeedback` is `light`, `medium`, `heavy`, `soft`, `rigid`, `success`,
  `warning`, `error` or `selection`.
- `Permission`'s `kind` is `camera`, `microphone`, `location`, `photos` or
  `notifications`. It shows Allow until iOS asked, the answer after, and
  Settings once denied, and reports `notDetermined`, `granted`, `limited`,
  `denied` or `restricted`. The app needs the usage description of each kind
  a page asks for.
- `Tip` fills the width of its place and TipKit sets the height; once TipKit
  stops showing it, it takes no room. TipKit remembers by `id` that it was
  closed, across launches. `TipHandle.invalidate()` closes it for good, such
  as once the feature it points at is used.

```tsx
// `showing` is whether this screen is on stage, from the page's own navigation.
<div className="viewfinder">
  <Camera running={showing} handle={camera} onStatus={setCameraState} />
</div>
```

```css
.viewfinder {
  aspect-ratio: 3 / 4;
  width: 100%;
}
```

## Presentations

`Sheet`, `FullScreenCover`, `Popover` and `Inspector` present **another page**
(`url`, read relative to this one and of the same origin) in a native sheet,
cover, popover or inspector with its own web view and its own islands. They
are one island, `presentation`, in different styles. In a browser, or without
the island, the web version shows the page in a frame.

| Prop                                             | Applies to                       | Meaning                                                                |
| ------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------- |
| `open`, `onOpenChange`                           | all                              | Required. A swipe down sets it false through `onOpenChange`            |
| `url`                                            | all                              | Required. The page to present                                          |
| `onDismiss({ reason, result })`                  | all                              | Once closed: `user` or `page`, and what the page passed to `dismiss()` |
| `onMessage(data)`                                | all                              | What the presented page sent with `send()`                             |
| `handle`                                         | all                              | `PresentationHandle.post(data)` sends data down to the page            |
| `title`, `header?`                               | all                              | The system bar with the title and Done; `header={false}` leaves it out |
| `dismissible?`                                   | all                              | `false` keeps a swipe or a tap outside from closing it                 |
| `background?`                                    | all                              | Shows while the page loads, such as `var(--page-background)`           |
| `preload?`                                       | all                              | On by default: the page loads ahead, so it opens already drawn         |
| `detents?`, `selectedDetent?`, `onDetentChange?` | `Sheet`, `Inspector` (`detents`) | `medium`, `large` or a height in points such as `"240"`                |
| `grabber?`, `undimmed?`, `cornerRadius?`         | `Sheet`                          | `undimmed` leaves the page behind a medium sheet usable                |
| `width?`, `height?`, `compact?`                  | `Popover`                        | Popover size; `compact="sheet"` makes it a sheet on iPhone             |

`usePresentation()` (also exported as `useSheet()`) gives `open`, `present()`,
`dismiss()` and `props` to spread. A `Popover` and a `ConfirmationDialog`
point at their `children`, which stay this page's own element.

```tsx
const sheet = useSheet();

<>
  <GlassButton title="Edit profile" onPress={sheet.present} />
  <Sheet
    {...sheet.props}
    url="./profile.html"
    title="Profile"
    detents={["medium", "large"]}
    background="var(--page-background)"
    onDismiss={({ result }) => {
      if (result !== null) saveProfile(result);
    }}
  />
</>;
```

The presented page is a page of its own: it renders its own
`NativeIslandsProvider`, and talks back with `usePresentedPage()`:

```tsx
const { presented, dismiss, send, detent, setDetent } = usePresentedPage((data) =>
  applyFromParent(data),
);

<GlassButton title="Done" prominence="prominent" onPress={() => dismiss({ name: draftName })} />;
```

`presented` is false when the page is opened on its own, so show a page
layout then. Values that cross (`result`, `send`, `post`) are `NativeJSON`.

**Alerts.** `Alert` and `ConfirmationDialog` are the `alert` island:
`open`, `onOpenChange`, `title?`, `message?`, `buttons?` (default one OK),
`tint?` and `onAction(id, values)`. An `AlertButton` is
`{ id, title, role?, preferred? }` with `role` `default`, `cancel` or
`destructive`. `Alert` also takes `textFields`
(`{ id, placeholder?, text?, secure? }`), whose values come back in `values`
by id. A `ConfirmationDialog` is an action sheet on iPhone and a popover at
its children on iPad.

```tsx
<Alert
  open={confirming}
  onOpenChange={setConfirming}
  title="Delete this note?"
  message="You can't undo this."
  buttons={[
    { id: "cancel", title: "Cancel", role: "cancel" },
    { id: "delete", title: "Delete", role: "destructive" },
  ]}
  onAction={(id) => {
    if (id === "delete") remove();
  }}
/>
```

## App chrome

Prefer the two containers, which handle parking for you:

- **`TabView`**: `tabs` (each a `Tab` plus `content`), `selectedId`,
  `onSelect(id)`, `search?: { content }` for the iOS 26 Search tab (selected
  as `"search"`), `accessory?` (such as a `TabAccessory`), `tint?`, `icon?`.
  Every tab stays mounted and parked below, so switching back is instant and
  already native.
- **`NavigationStack`**: `path`, `onPathChange`, `screens` (a record of
  `NavigationScreen`: `{ title, largeTitle?, leading?, trailing?, render }`),
  `onSelect?(id, screen)`, `tint?`, `icon?`. Pair it with
  `useNavigationPath(root)`, which gives `path`, `setPath`, `push`, `pop`,
  `popToRoot`, `popTo(id)`, `forward()` and `canGoForward`. A pushed screen
  waits off to the side until its islands are placed (at most
  `NAVIGATION_MOUNT_WAIT_MS`), then slides in over `NAVIGATION_SLIDE_MS`
  with its islands sliding natively.

```tsx
const nav = useNavigationPath("home");

<NavigationStack
  path={nav.path}
  onPathChange={nav.setPath}
  screens={{
    home: { title: "Settings", largeTitle: true, render: () => <Home onOpen={nav.push} /> },
    account: {
      title: "Account",
      trailing: [{ id: "save", title: "Save", prominent: true }],
      render: () => <Account />,
    },
  }}
  onSelect={(id) => {
    if (id === "save") save();
  }}
/>;
```

The pieces, for a shell of your own:

| Island          | Native name     | Props                                                                                         | Calls                               |
| --------------- | --------------- | --------------------------------------------------------------------------------------------- | ----------------------------------- |
| `TabBar`        | `tabBar`        | `tabs`, `selectedId`, `tint?`, `glassGroup?`, `icon?`                                         | `onSelect(id)`                      |
| `SearchTab`     | `searchTab`     | `selected`, `tint?`, `icon?`                                                                  | `onPress()`                         |
| `TabAccessory`  | `tabAccessory`  | `title`, `subtitle?`, `systemImage?`, `actions?`, `tint?`, `icon?`                            | `onPress?()`, `onAction?(id)`       |
| `SearchField`   | `searchField`   | `text`, `placeholder?` (`Search`), `tint?`, `glassGroup?`, `handle?`                          | `onChange(text)`, `onSubmit?(text)` |
| `NavigationBar` | `navigationBar` | `title`, `titleShown?`, `showsBack?`, `backTitle?`, `leading?`, `trailing?`, `tint?`, `icon?` | `onBack?()`, `onSelect?(id)`        |
| `Toolbar`       | `toolbar`       | `items`, `tint?`, `icon?`                                                                     | `onSelect?(id)`                     |

A `Tab` is `{ id, title, systemImage, badge? }`; a `TabBar` selects nothing
for an id it does not have, such as `"search"`. A `BarItem` is a button or a
menu, `{ id, kind?, title?, systemImage?, prominent?, tint?, disabled?, items? }`,
or a gap, `{ kind: "spacer" | "flexibleSpace" }` between glass groups.
`SearchFieldHandle` has `focus()` and `blur()`. Building a shell of your own
means parking hidden tabs and screens yourself: see
[screens that are not showing yet](page.md#screens-that-are-not-showing-yet).

## Lists

`List` is the `list` island: a SwiftUI `List` of `sections`, with swipe
actions, selection, disclosure groups, reordering and deleting.

| Prop                                                          | Meaning                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `sections`                                                    | Required. `ListSection[]`: `{ id, header?, footer?, rows }`      |
| `style?`                                                      | `insetGrouped` (default), `grouped`, `plain` or `sidebar`        |
| `selectionMode?`, `selected?`, `onSelectedChange?`            | `none` (default), `single` or `multiple`, by row id              |
| `expanded?`, `onExpandedChange?`                              | Open disclosure groups; the list keeps them itself when left out |
| `editing?`, `reorderable?`, `deletable?`, `onSectionsChange?` | Edit mode; keep the sections it hands back as the new prop       |
| `onPress?(id)`, `onAction?(row, action)`                      | A row tapped, a swipe action chosen                              |
| `tint?`, `icon?`                                              | The tint, and the web drawing of each `systemImage`              |

A `ListRow` is `{ id, title, subtitle?, systemImage?, iconTint?, value?,
badge?, accessory?, role?, disabled?, leadingActions?, trailingActions?,
children? }`; `iconTint` fills a rounded square behind the symbol, as
Settings does, and `children` make the row a disclosure group. A
`ListAction` is `{ id, title, systemImage?, role?, tint? }`.

The list does not scroll inside itself: it takes the height of its rows, and
the page scrolls. `moveRow(sections, sectionId, from, to)` and
`deleteRows(sections, sectionId, ids)` apply the same edits the native list
makes, for a web version of your own.

```tsx
const [sections, setSections] = useState<readonly ListSection[]>(initial);

<List
  sections={sections}
  editing={editing}
  deletable
  reorderable
  onSectionsChange={setSections}
  onPress={open}
  icon={(name) => <Icon name={name} />}
/>;
```

## Gestures, materials and system services

| Island               | Native name     | Props                                                                                                                | Calls                                                          |
| -------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `ContextMenu`        | `interaction`   | `items`, `title?`, `cornerRadius?`, `children`                                                                       | `onSelect(id)`, `onPress?()`                                   |
| `LongPressGesture`   | `interaction`   | `minimumDuration?` (0.5 s), `haptic?` (`medium`), `children`                                                         | `onLongPress()`, `onPress?()`                                  |
| `MaterialBackground` | `material`      | `material?` (`regular`), `cornerRadius?`, `title?`, `subtitle?`, `systemImage?`, `tint?`, `glassTint?`, `className?` | none                                                           |
| `Haptics`            | `haptics`       | `handle`                                                                                                             | none                                                           |
| `Notifications`      | `notifications` | `handle`                                                                                                             | `onStatusChange?`, `onOpen?(id, data)`, `onDeliver?(id, data)` |

- `ContextMenu` and `LongPressGesture` lay a clear native view over their
  `children`, which stay this page's own elements; the native view takes the
  taps, so pass `onPress` for a plain tap.
- `MaterialBackground` fills its parent with a system material, or Liquid
  Glass (`glass`, `clearGlass`) on iOS 26. Web text cannot draw on top of it
  ([rule 4](../SKILL.md#hard-rules)), so put text on it with `title`,
  `subtitle` and `systemImage`.
- `Haptics` and `Notifications` draw nothing. Render each once and call its
  handle, or use the hooks, which return the handle's methods and an
  `element` to render:

```tsx
const haptics = useHaptics();
const notifications = useNotifications({ onOpen: (id) => openReminder(id) });

<>
  {haptics.element}
  {notifications.element}
  <GlassButton
    title="Remind me"
    onPress={async () => {
      await haptics.impact("success");
      const status = await notifications.requestAuthorization();
      if (status === "granted") {
        await notifications.schedule({ id: "streak", title: "Keep your streak", after: 3600 });
      }
    }}
  />
</>;
```

`HapticsHandle` has `play(pattern)` (a Core Haptics `HapticPattern` of
`HapticEvent`s), `impact(style, intensity?)` and `stop()`; both play calls
resolve `false` where nothing can play. `NotificationsHandle` has
`requestAuthorization({ provisional? })`, `schedule(notification)`,
`cancel(ids)`, `cancelAll()`, `pending()` and `setBadge(count)`. A
`LocalNotification` fires `after` seconds from now (at least 60 when it
`repeats`) or at a local `date` (`yyyy-MM-ddTHH:mm`), and its `data` comes back
with `onOpen` and `onDeliver`. A hook's methods reject until its `element` is
rendered. `NativeIslandsComponents.register()` makes the library the
notification delegate unless the app set one; call it before launch finishes
to hear about the tap that opened the app.

## Map and chart

These live in their own Swift libraries so an app links MapKit and Swift
Charts only when it uses them. Both fill their parent.

**`MapView`** is `map`, registered by `NativeIslandsMaps.register()`:
`places` (each `{ id, title, latitude, longitude, symbol? }`), `style?`
(`standard`, `hybrid`, `imagery`), `realistic?`, `showsUser?`,
`selectedId?`, `tint?`, `pinIcon?(place)` for the web pins, `onSelect?(id)`
(`null` when deselected) and `onRegionChange?(region)`. Setting `selectedId`
from the page flies the map there. `showsUser` needs
`NSLocationWhenInUseUsageDescription`.

**`Chart`** is `chart`, registered by `NativeIslandsCharts.register()`, iOS 16+:
`series` (each `ChartSeries`: `{ id, name?, kind?, color?, points: { x, y }[] }`),
`kind?` (`bar`, `line`, `area`, `point`), `xAxis?` (`{ type?, title? }`, type
`category`, `number` or `date` with ISO dates), `yAxis?`
(`{ title?, min?, max?, format?, currency? }`), `stacked?`, `smooth?`,
`legend?`, `tint?`, `label?` and `onSelect?(selection)`. Dragging scrubs and
reports `{ x, values }`, with `x` null on release. The web version is an SVG
of the same data.

```tsx
<div className="chart">
  <Chart
    label="Weekly steps"
    kind="bar"
    xAxis={{ type: "category" }}
    yAxis={{ format: "number" }}
    series={[{ id: "steps", name: "Steps", points: week.map((d) => ({ x: d.day, y: d.steps })) }]}
    onSelect={({ x }) => setHighlighted(x)}
  />
</div>
```

## The specs underneath

Each island above wraps a spec made with `defineNativeComponent`. Use a spec
directly only to give an island an entirely different web version and props
API; it takes the raw props, `on<Event>` and `on<Key>Change` callbacks, and
your children as the web version.

| Spec                                                                                          | Native name                                                     |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `NativeGlassButton`, `NativeCloseButton`, `NativeMenu`                                        | `glassButton`, `closeButton`, `menu`                            |
| `NativeToggle`, `NativeSegmentedControl`, `NativeSlider`, `NativeStepper`                     | `toggle`, `segmentedControl`, `slider`, `stepper`               |
| `NativeMenuPicker` (sized natively), `NativeWheelPicker` (fills its box)                      | `picker`                                                        |
| `NativeDatePicker`, `NativeColorPicker`, `NativeTextField`                                    | `datePicker`, `colorPicker`, `textField`                        |
| `NativeSymbol`, `NativeSymbolEffect`, `NativeGauge`                                           | `symbol`, `symbolEffect`, `gauge`                               |
| `NativeVideo`, `NativeCamera`, `NativePhotoPicker`, `NativeShareButton`, `NativeHapticButton` | `video`, `camera`, `photoPicker`, `shareButton`, `hapticButton` |
| `NativePermission`, `NativeTip`                                                               | `permission`, `tip`                                             |
| `NativePresentation`, `NativeAlert`                                                           | `presentation`, `alert`                                         |
| `NativeTabBar`, `NativeTabAccessory`, `NativeSearchTab`, `NativeSearchField`                  | `tabBar`, `tabAccessory`, `searchTab`, `searchField`            |
| `NativeNavigationBar`, `NativeToolbar`, `NativeList`                                          | `navigationBar`, `toolbar`, `list`                              |
| `NativeInteraction`, `NativeMaterial`, `NativeHaptics`, `NativeNotifications`                 | `interaction`, `material`, `haptics`, `notifications`           |
| `NativeMap`, `NativeChart`                                                                    | `map`, `chart`                                                  |

To change how a ready-made island looks natively, register your own view under
its name after `NativeIslandsComponents.register()`; the later registration
wins. See [registering](host.md#register-components).
