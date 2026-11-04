import { defineNativeComponent } from "@superwall/native-islands/react";

/**
 * The native components the Islands app registers, by the names in
 * `examples/ios/Islands/Components/ShowcaseComponents.swift`.
 */

type GlassGroup = { glassGroup?: string };

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

export const NativeGlassButton = defineNativeComponent<{
  props: GlassGroup & {
    title?: string;
    systemImage?: string;
    prominence?: "regular" | "prominent";
    tint?: string;
    disabled?: boolean;
  };
  events: { press: undefined };
}>("glassButton", { colorProps: ["tint"] });

export const NativeToggle = defineNativeComponent<{
  props: { isOn: boolean; tint?: string; disabled?: boolean };
  events: { change: { isOn: boolean } };
}>("toggle", { sizing: "native", colorProps: ["tint"] });

export const NativeSegmentedControl = defineNativeComponent<{
  props: GlassGroup & { segments: readonly string[]; selectedIndex: number; disabled?: boolean };
  events: { change: { selectedIndex: number } };
}>("segmentedControl");

export const NativeSymbol = defineNativeComponent<{
  props: { name: string; tint?: string; weight?: SymbolWeight; pointSize?: number };
}>("symbol", { colorProps: ["tint"] });

export const NativeTabBar = defineNativeComponent<{
  props: GlassGroup & {
    titles: readonly string[];
    symbols: readonly string[];
    selectedIndex: number;
    tint?: string;
  };
  events: { select: { index: number } };
}>("tabBar", { colorProps: ["tint"] });

type Tinted = { tint?: string; disabled?: boolean };

export const NativeSlider = defineNativeComponent<{
  props: Tinted & {
    value: number;
    minimum: number;
    maximum: number;
    step?: number;
    minimumSymbol?: string;
    maximumSymbol?: string;
  };
  state: { value: number };
}>("slider", { colorProps: ["tint"] });

export const NativeStepper = defineNativeComponent<{
  props: { value: number; minimum: number; maximum: number; step?: number; disabled?: boolean };
  state: { value: number };
}>("stepper");

type PickerSpec = {
  props: {
    options: readonly string[];
    selectedIndex: number;
    style?: "menu" | "wheel";
    tint?: string;
  };
  state: { selectedIndex: number };
};

/** A wheel picker, which fills the box its web version gives it. */
export const NativePicker = defineNativeComponent<PickerSpec>("picker", { colorProps: ["tint"] });

/**
 * The same picker in its menu style, sized by its native label: the label is
 * the current option, so its width changes with the choice.
 */
export const NativeMenuPicker = defineNativeComponent<PickerSpec>("picker", {
  sizing: "native",
  colorProps: ["tint"],
});

export type DateComponents = "date" | "time" | "dateAndTime";

export const NativeDatePicker = defineNativeComponent<{
  props: {
    /** Local time as `yyyy-MM-ddTHH:mm`. */
    date: string;
    components?: DateComponents;
    style?: "compact" | "graphical" | "wheel";
    tint?: string;
  };
  state: { date: string };
}>("datePicker", { colorProps: ["tint"] });

export const NativeColorPicker = defineNativeComponent<{
  props: { color: string };
  /** The chosen colour as `#rrggbb`. */
  state: { color: string };
}>("colorPicker", { colorProps: ["color"] });

export type MenuItem = {
  id: string;
  title: string;
  systemImage?: string;
  destructive?: boolean;
  checked?: boolean;
  children?: readonly MenuItem[];
};

export const NativeMenu = defineNativeComponent<{
  props: GlassGroup & {
    title?: string;
    systemImage?: string;
    prominence?: "regular" | "prominent";
    tint?: string;
    items: readonly MenuItem[];
  };
  events: { select: { id: string } };
}>("menu", { colorProps: ["tint"] });

/**
 * The navigation bar over every screen, drawn natively so it stays put as
 * screens slide under it: Back while the stack can go back, the inline
 * title, and a menu of `items`.
 */
export const NativeNavigationBar = defineNativeComponent<{
  props: {
    title: string;
    titleShown: boolean;
    showsBack: boolean;
    systemImage: string;
    menuLabel: string;
    items: readonly MenuItem[];
  };
  events: { back: undefined; select: { id: string } };
}>("navigationBar");

export type TextFieldKind = "plain" | "email" | "number" | "secure";

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
  commands: { focus: { args: undefined; result: void }; blur: { args: undefined; result: void } };
}>("textField", { colorProps: ["tint"] });

export type GaugeStyle = "circular" | "capacity" | "linear" | "bar" | "spinner";

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

export type SymbolEffect =
  | "bounce"
  | "wiggle"
  | "pulse"
  | "variableColor"
  | "breathe"
  | "rotate"
  | "replace";

export const NativeSymbolEffect = defineNativeComponent<{
  props: {
    name: string;
    effect: SymbolEffect;
    trigger: number;
    active: boolean;
    tint?: string;
    pointSize?: number;
  };
}>("symbolEffect", { colorProps: ["tint"] });

export type ChartKind = "bar" | "line" | "area";

export type ChartPoint = { label: string; value: number };

export const NativeChart = defineNativeComponent<{
  props: { kind: ChartKind; points: readonly ChartPoint[]; tint?: string };
  events: { select: { label: string | null } };
}>("chart", { colorProps: ["tint"] });

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

export type VideoStatus = {
  playing: boolean;
  time: number;
  duration: number;
  pictureInPicture: boolean;
};

export const NativeVideo = defineNativeComponent<{
  props: { url: string };
  events: { status: VideoStatus };
  commands: {
    play: { args: undefined; result: void };
    pause: { args: undefined; result: void };
    pictureInPicture: { args: undefined; result: void };
  };
}>("video");

export type CameraState = "starting" | "running" | "unavailable" | "denied";

export const NativeCamera = defineNativeComponent<{
  /** The camera runs only while `running`, so a hidden screen holds no camera. */
  props: { position: "back" | "front"; running: boolean };
  events: { status: { state: CameraState } };
  /** A photo of the live camera as a JPEG data URL. */
  commands: { capture: { args: undefined; result: { image: string } } };
}>("camera");

type ActionButton = GlassGroup & {
  title?: string;
  systemImage?: string;
  prominence?: "regular" | "prominent";
  tint?: string;
};

export const NativePhotoPicker = defineNativeComponent<{
  props: ActionButton & { limit: number };
  /** The photos chosen, in order, as JPEG data URLs. */
  events: { pick: { images: readonly string[] } };
}>("photoPicker", { colorProps: ["tint"] });

export type PermissionKind = "camera" | "microphone" | "location" | "photos" | "notifications";

export type PermissionStatus = "notDetermined" | "granted" | "limited" | "denied" | "restricted";

/** Sized by its native view: Allow, Settings and Allowed differ in width. */
export const NativePermission = defineNativeComponent<{
  props: { kind: PermissionKind; tint?: string };
  state: { status: PermissionStatus };
}>("permission", { sizing: "native", colorProps: ["tint"] });

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

export const NativeSearchField = defineNativeComponent<{
  props: { text: string; placeholder?: string; tint?: string };
  events: { submit: { text: string } };
  state: { text: string };
  commands: { focus: { args: undefined; result: void }; blur: { args: undefined; result: void } };
}>("searchField", { colorProps: ["tint"] });
