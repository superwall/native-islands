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
  /** Roots show a large title; demos an inline one. */
  largeTitle?: boolean;
  Component: React.ComponentType;
};

export type Nav = {
  screens: readonly ScreenSpec[];
  push: (screen: string) => void;
  back: () => void;
};

const NavContext = React.createContext<Nav>({ screens: [], push: () => {}, back: () => {} });

export const NavProvider = NavContext.Provider;

export const useNav = (): Nav => React.useContext(NavContext);

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
