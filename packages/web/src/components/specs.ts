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
  events: { change: { isOn: boolean } };
}>("toggle", { sizing: "native", colorProps: ["tint"] });

export const NativeSegmentedControl = defineNativeComponent<{
  props: GlassGroup & { segments: readonly string[]; selectedIndex: number; disabled?: boolean };
  events: { change: { selectedIndex: number } };
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
