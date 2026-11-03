import * as React from "react";
import type { TabId } from "./navigation";

/** A screen of the app: a tab's root, or a demo one of its rows opens. */
export type ScreenSpec = {
  id: string;
  tab: TabId;
  title: string;
  /** The SF Symbol its row shows. */
  symbol: string;
  /** The list section its row sits in on the tab's root. */
  section?: string;
  /** Other words a search for it should find, such as what its control is called elsewhere. */
  keywords?: readonly string[];
  /** Roots show a large title; demos an inline one. */
  largeTitle?: boolean;
  Component: React.ComponentType;
};

export type Nav = {
  screens: readonly ScreenSpec[];
  push: (screen: string) => void;
  back: () => void;
  /** Shows a screen on its own tab, from anywhere, such as a search result. */
  open: (screen: string) => void;
};

const NavContext = React.createContext<Nav>({
  screens: [],
  push: () => {},
  back: () => {},
  open: () => {},
});

export const NavProvider = NavContext.Provider;

export const useNav = (): Nav => React.useContext(NavContext);

const ShowingContext = React.createContext(true);

/** Holds whether a screen is the one on top of the showing tab. */
export const ShowingProvider = ShowingContext.Provider;

/**
 * Whether the screen this is on is showing. Every screen stays mounted, so a
 * demo that holds a device, such as the camera, lets go of it while hidden.
 */
export const useScreenShowing = (): boolean => React.useContext(ShowingContext);

/** The demos a tab's root lists, grouped by section in the order they were declared. */
export const sectionsOf = (
  screens: readonly ScreenSpec[],
  tab: TabId,
): readonly { title: string; screens: readonly ScreenSpec[] }[] => {
  const sections: { title: string; screens: ScreenSpec[] }[] = [];
  for (const screen of screens) {
    if (screen.tab !== tab || screen.id === tab || !screen.section) continue;
    const section = sections.find((entry) => entry.title === screen.section);
    if (section) section.screens.push(screen);
    else sections.push({ title: screen.section, screens: [screen] });
  }
  return sections;
};

/** The demo screens of one section of a tab, in the order its root lists them. */
export const demoScreens = (
  tab: TabId,
  section: string,
  demos: readonly Pick<ScreenSpec, "id" | "title" | "symbol" | "keywords" | "Component">[],
): ScreenSpec[] => demos.map((demo) => ({ ...demo, tab, section }));

const folded = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * The demos a search finds, in the order the tabs list them: every word of
 * the query has to start a word of the demo's title, section or keywords,
 * the way Settings searches. An empty query finds every demo.
 */
export const searchScreens = (screens: readonly ScreenSpec[], query: string): ScreenSpec[] => {
  const words = folded(query).split(/\s+/).filter(Boolean);
  return screens.filter((screen) => {
    if (!screen.section || screen.id === screen.tab) return false;
    const haystack = folded(
      [screen.title, screen.section, ...(screen.keywords ?? [])].join(" "),
    ).split(/[^\p{L}\p{N}]+/u);
    return words.every((word) => haystack.some((entry) => entry.startsWith(word)));
  });
};
