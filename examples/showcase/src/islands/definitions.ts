import type { MenuItem } from "native-islands/components";
import { defineNativeComponent } from "native-islands/react";

/**
 * The Islands app's own native components, by the names in
 * `examples/ios/Islands/Components/ShowcaseComponents.swift`. The common
 * controls come from `native-islands/components`.
 */

type GlassGroup = { glassGroup?: string };

export const NativeSearchTab = defineNativeComponent<{
  props: GlassGroup & { selected: boolean; tint?: string };
  events: { press: undefined };
}>("searchTab", { colorProps: ["tint"] });

export const NativeTabBar = defineNativeComponent<{
  props: GlassGroup & {
    titles: readonly string[];
    symbols: readonly string[];
    selectedIndex: number;
    tint?: string;
  };
  events: { select: { index: number } };
}>("tabBar", { colorProps: ["tint"] });

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

export const NativeSearchField = defineNativeComponent<{
  props: { text: string; placeholder?: string; tint?: string };
  events: { submit: { text: string } };
  state: { text: string };
  commands: { focus: { args: undefined; result: void }; blur: { args: undefined; result: void } };
}>("searchField", { colorProps: ["tint"] });
