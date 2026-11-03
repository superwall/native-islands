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
