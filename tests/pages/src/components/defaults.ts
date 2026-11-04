import { defineNativeComponent } from "native-islands/react";

type GlassGroup = {
  glassGroup?: string;
};

export const GlassButton = defineNativeComponent<{
  props: GlassGroup & {
    title?: string;
    systemImage?: string;
    prominence?: "regular" | "prominent";
    tint?: string;
    disabled?: boolean;
  };
  events: { press: undefined };
}>("glassButton", { colorProps: ["tint"] });

export const CloseButton = defineNativeComponent<{
  props: GlassGroup & {
    tint?: string;
  };
  events: { press: undefined };
}>("closeButton", { colorProps: ["tint"] });

export const Toggle = defineNativeComponent<{
  props: {
    isOn: boolean;
    tint?: string;
    disabled?: boolean;
  };
  events: { change: { isOn: boolean } };
}>("toggle", { sizing: "native", colorProps: ["tint"] });

export const SegmentedControl = defineNativeComponent<{
  props: GlassGroup & {
    segments: readonly string[];
    selectedIndex: number;
    disabled?: boolean;
  };
  events: { change: { selectedIndex: number } };
}>("segmentedControl");

export const SystemSymbol = defineNativeComponent<{
  props: {
    name: string;
    tint?: string;
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
    pointSize?: number;
  };
}>("symbol", { colorProps: ["tint"] });
