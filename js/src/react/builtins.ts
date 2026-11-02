import { defineNativeComponent } from "./define";

type GlassGroup = {
  /** Glass that blends and morphs with every other native component sharing this name. Default: none. */
  glassGroup?: string;
};

/** A Liquid Glass button drawn by the host. Its web children are the fallback. */
export const GlassButton = defineNativeComponent<{
  props: GlassGroup & {
    /** The label. Default: none, for an icon-only button. */
    title?: string;
    /** An SF Symbol shown before the title. Default: none. */
    systemImage?: string;
    /** `"prominent"` fills the glass with `tint`, for the primary action. Default: `"regular"`. */
    prominence?: "regular" | "prominent";
    /** The glass tint, any CSS colour or `var(--token)`. Default: the system tint. */
    tint?: string;
    /** Dims the button and stops `onPress`. Default: `false`. */
    disabled?: boolean;
  };
  events: { press: undefined };
}>("glassButton", { colorProps: ["tint"] });

/** The host's glass close button. */
export const CloseButton = defineNativeComponent<{
  props: GlassGroup & {
    /** The glass tint, any CSS colour or `var(--token)`. Default: the system tint. */
    tint?: string;
  };
  events: { press: undefined };
}>("closeButton", { colorProps: ["tint"] });

/** A native switch, sized by the system. Keep `isOn` in React state and update it from `onChange`. */
export const Toggle = defineNativeComponent<{
  props: {
    /** Whether the switch is on. */
    isOn: boolean;
    /** The colour when on, any CSS colour or `var(--token)`. Default: the system green. */
    tint?: string;
    /** Dims the switch and stops `onChange`. Default: `false`. */
    disabled?: boolean;
  };
  events: { change: { isOn: boolean } };
}>("toggle", { sizing: "native", colorProps: ["tint"] });

/** A native segmented control. Keep `selectedIndex` in React state and update it from `onChange`. */
export const SegmentedControl = defineNativeComponent<{
  props: GlassGroup & {
    /** The segment labels, in order. */
    segments: readonly string[];
    /** The selected segment, from 0. */
    selectedIndex: number;
    /** Dims the control and stops `onChange`. Default: `false`. */
    disabled?: boolean;
  };
  events: { change: { selectedIndex: number } };
}>("segmentedControl");

/** An SF Symbol drawn by the system. */
export const SystemSymbol = defineNativeComponent<{
  props: {
    /** The symbol's name, such as `"crown.fill"`. */
    name: string;
    /** The symbol's colour, any CSS colour or `var(--token)`. Default: the text colour. */
    tint?: string;
    /** The stroke weight. Default: `"regular"`. */
    weight?:
      | "ultraLight"
      | "thin"
      | "light"
      | "regular"
      | "medium"
      | "semibold"
      | "bold"
      | "heavy"
      | "black";
    /** The size in points. Default: fits the web element's height. */
    pointSize?: number;
  };
}>("symbol", { colorProps: ["tint"] });
