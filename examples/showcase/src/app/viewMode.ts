import type { MenuItem } from "../islands/definitions";

/**
 * How the app draws its islands: as native views, as their web versions, or
 * as their web versions outlined where the native views would sit.
 */
export type ViewMode = "native" | "web" | "outlines";

export const VIEW_MODES: readonly { value: ViewMode; title: string; symbol: string }[] = [
  { value: "native", title: "Native", symbol: "iphone" },
  { value: "web", title: "Web", symbol: "globe" },
  { value: "outlines", title: "Outlines", symbol: "square.dashed" },
];

/** The items of the view mode menu, with the current mode checked. */
export const viewModeItems = (mode: ViewMode): MenuItem[] =>
  VIEW_MODES.map((option) => ({
    id: option.value,
    title: option.title,
    systemImage: option.symbol,
    checked: option.value === mode,
  }));

/** The mode a menu item stands for, or nothing for an id that is none. */
export const viewModeOf = (id: string): ViewMode | undefined =>
  VIEW_MODES.find((option) => option.value === id)?.value;
