import { defineNativeComponent } from "../react/components/define";

/**
 * The native half of each component, by the names `NativeIslandsComponents`
 * registers in Swift. Props here are the contract both sides share.
 */

type GlassGroup = { glassGroup?: string };

export type Prominence = "regular" | "prominent";

export type SymbolWeight =
  | "ultraLight"
  | "thin"
  | "light"
  | "regular"
  | "medium"
  | "semibold"
  | "bold"
  | "heavy"
  | "black";

export type MenuItem = {
  id: string;
  title: string;
  systemImage?: string;
  destructive?: boolean;
  checked?: boolean;
  children?: readonly MenuItem[];
};

export type DateComponents = "date" | "time" | "dateAndTime";

export type DatePickerStyle = "compact" | "graphical" | "wheel";

export type PickerStyle = "menu" | "wheel";

export type TextFieldKind = "plain" | "email" | "number" | "secure";

export type GaugeStyle = "circular" | "capacity" | "linear" | "bar" | "spinner";

export type SymbolEffectName =
  | "bounce"
  | "wiggle"
  | "pulse"
  | "variableColor"
  | "breathe"
  | "rotate"
  | "replace";

export type TextFieldCommands = {
  focus: { args: undefined; result: void };
  blur: { args: undefined; result: void };
};

export const NativeGlassButton = defineNativeComponent<{
  props: GlassGroup & {
    title?: string;
    systemImage?: string;
    prominence?: Prominence;
    tint?: string;
    disabled?: boolean;
  };
  events: { press: undefined };
}>("glassButton", { colorProps: ["tint"] });

export const NativeCloseButton = defineNativeComponent<{
  props: GlassGroup & { tint?: string };
  events: { press: undefined };
}>("closeButton", { colorProps: ["tint"] });

export const NativeMenu = defineNativeComponent<{
  props: GlassGroup & {
    title?: string;
    systemImage?: string;
    prominence?: Prominence;
    tint?: string;
    items: readonly MenuItem[];
  };
  events: { select: { id: string } };
}>("menu", { colorProps: ["tint"] });

export const NativeToggle = defineNativeComponent<{
  props: { isOn: boolean; tint?: string; disabled?: boolean };
  state: { isOn: boolean };
}>("toggle", { sizing: "native", colorProps: ["tint"] });

export const NativeSegmentedControl = defineNativeComponent<{
  props: GlassGroup & { segments: readonly string[]; selectedIndex: number; disabled?: boolean };
  state: { selectedIndex: number };
}>("segmentedControl");

export const NativeSlider = defineNativeComponent<{
  props: {
    value: number;
    minimum: number;
    maximum: number;
    step?: number;
    minimumSymbol?: string;
    maximumSymbol?: string;
    tint?: string;
    disabled?: boolean;
  };
  state: { value: number };
}>("slider", { colorProps: ["tint"] });

export const NativeStepper = defineNativeComponent<{
  props: { value: number; minimum: number; maximum: number; step?: number; disabled?: boolean };
  state: { value: number };
}>("stepper");

type PickerSpec = {
  props: { options: readonly string[]; selectedIndex: number; style?: PickerStyle; tint?: string };
  state: { selectedIndex: number };
};

/** A wheel picker, which fills the box its web version gives it. */
export const NativeWheelPicker = defineNativeComponent<PickerSpec>("picker", {
  colorProps: ["tint"],
});

/** A menu picker, sized by its native label: the current option, so its width follows the choice. */
export const NativeMenuPicker = defineNativeComponent<PickerSpec>("picker", {
  sizing: "native",
  colorProps: ["tint"],
});

export const NativeDatePicker = defineNativeComponent<{
  props: {
    /** Local time as `yyyy-MM-ddTHH:mm`. */
    date: string;
    components?: DateComponents;
    style?: DatePickerStyle;
    tint?: string;
  };
  state: { date: string };
}>("datePicker", { colorProps: ["tint"] });

export const NativeColorPicker = defineNativeComponent<{
  props: { color: string };
  /** The chosen colour as `#rrggbb`. */
  state: { color: string };
}>("colorPicker", { colorProps: ["color"] });

export const NativeTextField = defineNativeComponent<{
  props: {
    text: string;
    placeholder?: string;
    kind?: TextFieldKind;
    submitLabel?: "done" | "search";
    tint?: string;
  };
  events: { submit: { text: string }; focusChange: { focused: boolean } };
  state: { text: string };
  commands: TextFieldCommands;
}>("textField", { colorProps: ["tint"] });

export const NativeSymbol = defineNativeComponent<{
  props: { name: string; tint?: string; weight?: SymbolWeight; pointSize?: number };
}>("symbol", { colorProps: ["tint"] });

export const NativeSymbolEffect = defineNativeComponent<{
  props: {
    name: string;
    effect: SymbolEffectName;
    trigger: number;
    active: boolean;
    tint?: string;
    pointSize?: number;
  };
}>("symbolEffect", { colorProps: ["tint"] });

export const NativeGauge = defineNativeComponent<{
  props: {
    value: number;
    style: GaugeStyle;
    label?: string;
    minimumLabel?: string;
    maximumLabel?: string;
    tint?: string;
  };
}>("gauge", { colorProps: ["tint"] });

export type ChartKind = "bar" | "line" | "area" | "point";

/** An x value: a label on a `category` axis, a number, or an ISO 8601 date such as `2026-11-04`. */
export type ChartX = string | number;

export type ChartSeries = {
  id: string;
  /** The name in the legend. Defaults to `id`. */
  name?: string;
  /** The mark of this series. Defaults to the chart's `kind`. */
  kind?: ChartKind;
  /** Hex (`#ff9500`), `rgb()` or a `var(--token)` holding one. Defaults to the tint, then a palette. */
  color?: string;
  points: readonly { x: ChartX; y: number }[];
};

export type ChartXAxis = { type?: "category" | "number" | "date"; title?: string };

export type ChartYAxis = {
  title?: string;
  min?: number;
  max?: number;
  /** `percent` writes 0.25 as 25%; `currency` uses `currency`, USD by default. */
  format?: "number" | "percent" | "currency";
  currency?: string;
};

/** The x under the finger, as the page wrote it, and each series' value there; `x` is null on release. */
export type ChartSelection = { x: ChartX | null; values: readonly { series: string; y: number }[] };

/** Registered by `NativeIslandsCharts`. */
export const NativeChart = defineNativeComponent<{
  props: {
    series: readonly ChartSeries[];
    kind?: ChartKind;
    xAxis?: ChartXAxis;
    yAxis?: ChartYAxis;
    stacked?: boolean;
    smooth?: boolean;
    legend?: boolean;
    tint?: string;
  };
  events: { select: ChartSelection };
}>("chart", { colorProps: ["tint"] });

export type VideoStatus = {
  playing: boolean;
  time: number;
  duration: number;
  pictureInPicture: boolean;
};

export type VideoCommands = {
  play: { args: undefined; result: void };
  pause: { args: undefined; result: void };
  pictureInPicture: { args: undefined; result: void };
};

export const NativeVideo = defineNativeComponent<{
  props: { url: string };
  events: { status: VideoStatus };
  commands: VideoCommands;
}>("video");

type ActionButton = GlassGroup & {
  title?: string;
  systemImage?: string;
  prominence?: Prominence;
  tint?: string;
};

export const NativePhotoPicker = defineNativeComponent<{
  props: ActionButton & { limit: number };
  /** The photos chosen, in order, as JPEG data URLs. */
  events: { pick: { images: readonly string[] } };
}>("photoPicker", { colorProps: ["tint"] });

export type HapticFeedback =
  | "light"
  | "medium"
  | "heavy"
  | "soft"
  | "rigid"
  | "success"
  | "warning"
  | "error"
  | "selection";

export const NativeHapticButton = defineNativeComponent<{
  props: ActionButton & { feedback: HapticFeedback };
  events: { press: undefined };
}>("hapticButton", { colorProps: ["tint"] });

export const NativeShareButton = defineNativeComponent<{
  props: ActionButton & { text?: string; url?: string };
  /** The activity chosen, such as `com.apple.UIKit.activity.CopyToPasteboard`, or null if cancelled. */
  events: { complete: { activity: string | null } };
}>("shareButton", { colorProps: ["tint"] });

export type TipAction = { id: string; title: string };

export type TipArrowEdge = "top" | "bottom" | "leading" | "trailing";

/**
 * TipKit's inline tip. Its web version sets its size; once TipKit stops
 * showing it (`shown: false`), the web version collapses so it takes no room.
 */
export const NativeTip = defineNativeComponent<{
  props: {
    /** Names the tip: TipKit remembers across launches that it was closed. */
    id: string;
    title: string;
    message?: string;
    systemImage?: string;
    actions?: readonly TipAction[];
    arrowEdge?: TipArrowEdge;
    tint?: string;
    /** The tip's fill; an opaque card colour by default. */
    background?: string;
  };
  events: { action: { id: string }; dismiss: undefined };
  state: { shown: boolean };
  commands: { invalidate: { args: undefined; result: void } };
}>("tip", { colorProps: ["tint", "background"] });

export type MapStyle = "standard" | "hybrid" | "imagery";

export type MapPlace = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  symbol?: string;
};

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

/** Registered by `NativeIslandsMaps`. */
export const NativeMap = defineNativeComponent<{
  props: {
    places: readonly MapPlace[];
    style: MapStyle;
    realistic?: boolean;
    showsUser?: boolean;
    selectedId?: string;
    tint?: string;
  };
  events: { select: { id: string | null }; regionChange: MapRegion };
}>("map", { colorProps: ["tint"] });

export type CameraState = "starting" | "running" | "unavailable" | "denied";

/** Needs `NSCameraUsageDescription` in the app. */
export const NativeCamera = defineNativeComponent<{
  /** The camera runs only while `running`, so a hidden screen holds no camera. */
  props: { position: "back" | "front"; running: boolean };
  events: { status: { state: CameraState } };
  /** A photo of the live camera as a JPEG data URL. */
  commands: { capture: { args: undefined; result: { image: string } } };
}>("camera");

export type PermissionKind = "camera" | "microphone" | "location" | "photos" | "notifications";

export type PermissionStatus = "notDetermined" | "granted" | "limited" | "denied" | "restricted";

/** Needs the usage description of each kind it asks for. Sized by its native view: Allow, Settings and Allowed differ in width. */
export const NativePermission = defineNativeComponent<{
  props: { kind: PermissionKind; tint?: string };
  state: { status: PermissionStatus };
}>("permission", { sizing: "native", colorProps: ["tint"] });

// Presentations

export type PresentationStyle = "sheet" | "fullScreenCover" | "popover" | "inspector";

/** `medium`, `large`, or a height in points such as `"240"`. */
export type SheetDetent = "medium" | "large" | `${number}`;

export type PresentationDismiss = {
  /** `user` swiped or tapped outside; `page` the presented page closed it. */
  reason: "user" | "page";
  /** What the presented page passed to `dismiss()`. */
  result: NativeJSON;
};

/** A JSON value crossing to or from a presented page. */
export type NativeJSON =
  | string
  | number
  | boolean
  | null
  | readonly NativeJSON[]
  | { readonly [key: string]: NativeJSON };

/** Another page, presented natively in its own web view with its own islands. */
export const NativePresentation = defineNativeComponent<{
  props: {
    open: boolean;
    /** Read relative to this page. */
    url: string;
    style?: PresentationStyle;
    detents?: readonly SheetDetent[];
    selectedDetent?: SheetDetent;
    grabber?: boolean;
    /** False keeps a swipe or a tap outside from closing it. */
    dismissible?: boolean;
    /** Leaves the page behind a medium sheet undimmed and usable. */
    undimmed?: boolean;
    cornerRadius?: number;
    /** A popover's size in points. */
    width?: number;
    height?: number;
    /** A popover on iPhone becomes a sheet when `sheet`. */
    compact?: "popover" | "sheet";
    /** The title in the system navigation bar. */
    title?: string;
    /** False leaves out the system navigation bar with the title and Done. */
    header?: boolean;
    /** Shows behind the page while it loads. */
    background?: string;
    /** False loads the page only when it opens, instead of ahead of time. */
    preload?: boolean;
  };
  events: { dismiss: PresentationDismiss; message: { data: NativeJSON } };
  state: { open: boolean; selectedDetent: SheetDetent };
  commands: { post: { args: NativeJSON; result: void } };
}>("presentation", { colorProps: ["background"] });

export type AlertButtonRole = "default" | "cancel" | "destructive";

export type AlertButton = {
  id: string;
  title: string;
  role?: AlertButtonRole;
  /** The button Return chooses; bold in an alert. */
  preferred?: boolean;
};

export type AlertTextField = { id: string; placeholder?: string; text?: string; secure?: boolean };

export const NativeAlert = defineNativeComponent<{
  props: {
    open: boolean;
    style?: "alert" | "confirmationDialog";
    title?: string;
    message?: string;
    buttons: readonly AlertButton[];
    textFields?: readonly AlertTextField[];
    tint?: string;
  };
  events: { action: { id: string; values: Readonly<Record<string, string>> } };
  state: { open: boolean };
}>("alert", { colorProps: ["tint"] });

// App chrome

/** An item of a navigation bar or toolbar: a button, a menu of `items`, or room between groups. */
export type BarItem =
  | {
      id: string;
      kind?: "button" | "menu";
      title?: string;
      systemImage?: string;
      /** Stands on its own, filled with `tint`. */
      prominent?: boolean;
      /** Hex or `rgb()`. */
      tint?: string;
      disabled?: boolean;
      items?: readonly MenuItem[];
    }
  | { id?: string; kind: "spacer" | "flexibleSpace" };

export type Tab = {
  id: string;
  title: string;
  systemImage: string;
  badge?: string | number;
};

export const NativeTabBar = defineNativeComponent<{
  props: GlassGroup & {
    tabs: readonly Tab[];
    selectedId?: string;
    selectedIndex?: number;
    tint?: string;
  };
  events: { select: { index: number; id: string } };
}>("tabBar", { colorProps: ["tint"] });

export const NativeTabAccessory = defineNativeComponent<{
  props: GlassGroup & {
    title: string;
    subtitle?: string;
    systemImage?: string;
    actions?: readonly BarItem[];
    tint?: string;
  };
  events: { press: undefined; action: { id: string } };
}>("tabAccessory", { colorProps: ["tint"] });

export const NativeSearchTab = defineNativeComponent<{
  props: GlassGroup & { selected: boolean; tint?: string };
  events: { press: undefined };
}>("searchTab", { colorProps: ["tint"] });

export const NativeSearchField = defineNativeComponent<{
  props: GlassGroup & { text: string; placeholder?: string; tint?: string };
  events: { submit: { text: string } };
  state: { text: string };
  commands: TextFieldCommands;
}>("searchField", { colorProps: ["tint"] });

export const NativeNavigationBar = defineNativeComponent<{
  props: {
    title: string;
    /** False hides the inline title, while a large title shows on the page. */
    titleShown?: boolean;
    showsBack?: boolean;
    backTitle?: string;
    leading?: readonly BarItem[];
    trailing?: readonly BarItem[];
    tint?: string;
  };
  events: { back: undefined; select: { id: string } };
}>("navigationBar", { colorProps: ["tint"] });

export const NativeToolbar = defineNativeComponent<{
  props: { items: readonly BarItem[]; itemHeight?: number; tint?: string };
  events: { select: { id: string } };
}>("toolbar", { colorProps: ["tint"] });

// Lists

export type ListAction = {
  id: string;
  title: string;
  systemImage?: string;
  role?: "destructive";
  /** Hex or `rgb()`. */
  tint?: string;
};

export type ListRow = {
  id: string;
  title: string;
  subtitle?: string;
  systemImage?: string;
  /** Fills a rounded square behind `systemImage`, as Settings does. Hex or `rgb()`. */
  iconTint?: string;
  value?: string;
  badge?: string | number;
  accessory?: "none" | "chevron" | "info";
  role?: "destructive";
  disabled?: boolean;
  leadingActions?: readonly ListAction[];
  trailingActions?: readonly ListAction[];
  /** Makes the row a disclosure group; nested children make an outline. */
  children?: readonly ListRow[];
};

export type ListSection = {
  id: string;
  header?: string;
  footer?: string;
  rows: readonly ListRow[];
};

export type ListStyle = "insetGrouped" | "grouped" | "plain" | "sidebar";

export type SelectionMode = "none" | "single" | "multiple";

export const NativeList = defineNativeComponent<{
  props: {
    sections: readonly ListSection[];
    style?: ListStyle;
    selectionMode?: SelectionMode;
    selected?: readonly string[];
    expanded?: readonly string[];
    editing?: boolean;
    reorderable?: boolean;
    deletable?: boolean;
    tint?: string;
  };
  events: {
    press: { id: string };
    action: { row: string; id: string };
    reorder: { section: string; ids: readonly string[] };
    delete: { section: string; ids: readonly string[] };
    expand: { id: string; expanded: boolean };
  };
  state: {
    sections: readonly ListSection[];
    selected: readonly string[];
    expanded: readonly string[];
    /** The height the native rows take, in points. */
    contentHeight: number;
  };
}>("list", { colorProps: ["tint"] });

// System

export type HapticEvent = {
  /** Seconds from the start. */
  time: number;
  kind?: "transient" | "continuous";
  /** Seconds, for a continuous event. */
  duration?: number;
  /** 0 to 1. */
  intensity?: number;
  /** 0 to 1: dull to crisp. */
  sharpness?: number;
  attack?: number;
  decay?: number;
};

export type HapticPattern = { events: readonly HapticEvent[]; loop?: boolean };

export const NativeHaptics = defineNativeComponent<{
  commands: {
    play: { args: HapticPattern; result: { played: boolean } };
    impact: { args: { style: HapticFeedback; intensity?: number }; result: { played: boolean } };
    stop: { args: undefined; result: void };
  };
}>("haptics");

export type NotificationStatus = "notDetermined" | "granted" | "limited" | "denied";

export type LocalNotification = {
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
  /** Seconds from now; at least 60 when it repeats. */
  after?: number;
  /** Local time as `yyyy-MM-ddTHH:mm`, instead of `after`. */
  date?: string;
  repeats?: boolean;
  sound?: boolean;
  badge?: number;
  threadId?: string;
  /** Comes back with `open` and `deliver`. */
  data?: NativeJSON;
};

export const NativeNotifications = defineNativeComponent<{
  events: {
    open: { id: string; data: NativeJSON };
    deliver: { id: string; data: NativeJSON };
  };
  state: { status: NotificationStatus };
  commands: {
    requestAuthorization: {
      args: { provisional?: boolean } | undefined;
      result: { status: NotificationStatus };
    };
    schedule: { args: LocalNotification; result: void };
    cancel: { args: { ids: readonly string[] }; result: void };
    cancelAll: { args: undefined; result: void };
    pending: { args: undefined; result: { ids: readonly string[] } };
    setBadge: { args: { count: number }; result: void };
  };
}>("notifications");

export const NativeInteraction = defineNativeComponent<{
  props: {
    items?: readonly MenuItem[];
    title?: string;
    longPress?: boolean;
    minimumDuration?: number;
    haptic?: HapticFeedback | "none";
    /** The corner radius of the lifted preview. */
    cornerRadius?: number;
  };
  events: { press: undefined; longPress: undefined; select: { id: string } };
}>("interaction");

export type MaterialName =
  | "ultraThin"
  | "thin"
  | "regular"
  | "thick"
  | "ultraThick"
  | "bar"
  | "glass"
  | "clearGlass";

export const NativeMaterial = defineNativeComponent<{
  props: {
    material: MaterialName;
    cornerRadius?: number;
    title?: string;
    subtitle?: string;
    systemImage?: string;
    tint?: string;
    glassTint?: string;
  };
}>("material", { colorProps: ["tint", "glassTint"] });
