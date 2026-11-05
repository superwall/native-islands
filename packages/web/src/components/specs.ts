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
  };
  events: { action: { id: string }; dismiss: undefined };
  state: { shown: boolean };
  commands: { invalidate: { args: undefined; result: void } };
}>("tip", { colorProps: ["tint"] });

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

/** Registered by `NativeIslandsCamera`. */
export const NativeCamera = defineNativeComponent<{
  /** The camera runs only while `running`, so a hidden screen holds no camera. */
  props: { position: "back" | "front"; running: boolean };
  events: { status: { state: CameraState } };
  /** A photo of the live camera as a JPEG data URL. */
  commands: { capture: { args: undefined; result: { image: string } } };
}>("camera");

export type PermissionKind = "camera" | "microphone" | "location" | "photos" | "notifications";

export type PermissionStatus = "notDetermined" | "granted" | "limited" | "denied" | "restricted";

/** Registered by `NativeIslandsPermissions`. Sized by its native view: Allow, Settings and Allowed differ in width. */
export const NativePermission = defineNativeComponent<{
  props: { kind: PermissionKind; tint?: string };
  state: { status: PermissionStatus };
}>("permission", { sizing: "native", colorProps: ["tint"] });
