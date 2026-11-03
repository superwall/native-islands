export const TABS = ["components", "capabilities", "settings", "search"] as const;

/** The tabs the tab bar lists; Search is the separate button beside it, as on iOS 26. */
export const BAR_TABS = ["components", "capabilities", "settings"] as const;

export type TabId = (typeof TABS)[number];

export const isTab = (value: string | null | undefined): value is TabId =>
  TABS.some((tab) => tab === value);

/**
 * A push first mounts the new screen off to the side so its islands are drawn
 * (`mounting`), then slides it in (`moving`). A pop slides the leaving screen
 * out while it stays rendered.
 */
export type Transition = {
  key: number;
  kind: "push" | "pop";
  tab: TabId;
  screen: string;
  stage: "mounting" | "moving";
};

export type NavState = {
  tab: TabId;
  stacks: Readonly<Record<TabId, readonly string[]>>;
  transition?: Transition;
  key: number;
};

export type NavAction =
  | { type: "push"; screen: string }
  | { type: "pop"; animated: boolean }
  | { type: "select"; tab: TabId }
  | { type: "open"; tab: TabId; screen: string }
  | { type: "move"; key: number }
  | { type: "finish"; key: number };

const roots = (): Record<TabId, readonly string[]> => ({
  components: ["components"],
  capabilities: ["capabilities"],
  settings: ["settings"],
  search: ["search"],
});

/**
 * `?tab=<tab>` opens on that tab, and `?screen=<id>` on that screen with its
 * tab's root behind it, so every screen has a direct URL.
 */
export const initialState = (
  search: string,
  tabOf: (screen: string) => TabId | undefined,
): NavState => {
  const query = new URLSearchParams(search);
  const stacks = roots();
  const screen = query.get("screen");
  const screenTab = screen ? tabOf(screen) : undefined;
  if (screen && screenTab && screen !== screenTab) {
    stacks[screenTab] = [screenTab, screen];
    return { tab: screenTab, stacks, key: 0 };
  }
  const tab = query.get("tab");
  return { tab: isTab(tab) ? tab : "components", stacks, key: 0 };
};

export const topOf = (state: NavState, tab: TabId = state.tab): string =>
  state.stacks[tab].at(-1) ?? tab;

export const canGoBack = (state: NavState): boolean => state.stacks[state.tab].length > 1;

export const navigate = (state: NavState, action: NavAction): NavState => {
  const stack = state.stacks[state.tab];
  switch (action.type) {
    case "push": {
      if (state.transition || stack.at(-1) === action.screen) return state;
      const key = state.key + 1;
      return {
        ...state,
        key,
        stacks: {
          ...state.stacks,
          [state.tab]: [...stack.filter((entry) => entry !== action.screen), action.screen],
        },
        transition: { key, kind: "push", tab: state.tab, screen: action.screen, stage: "mounting" },
      };
    }
    case "pop": {
      const leaving = stack.at(-1);
      if (state.transition || stack.length < 2 || !leaving) return state;
      const stacks = { ...state.stacks, [state.tab]: stack.slice(0, -1) };
      if (!action.animated) return { ...state, stacks };
      const key = state.key + 1;
      return {
        ...state,
        key,
        stacks,
        transition: { key, kind: "pop", tab: state.tab, screen: leaving, stage: "moving" },
      };
    }
    case "select": {
      if (action.tab !== state.tab) return { ...state, tab: action.tab, transition: undefined };
      if (stack.length < 2) return state;
      return {
        ...state,
        stacks: { ...state.stacks, [state.tab]: [state.tab] },
        transition: undefined,
      };
    }
    case "open": {
      if (state.transition) return state;
      if (action.screen === action.tab) return navigate(state, { type: "select", tab: action.tab });
      const key = state.key + 1;
      return {
        ...state,
        tab: action.tab,
        key,
        stacks: { ...state.stacks, [action.tab]: [action.tab, action.screen] },
        transition: {
          key,
          kind: "push",
          tab: action.tab,
          screen: action.screen,
          stage: "mounting",
        },
      };
    }
    case "move":
      return state.transition?.key === action.key && state.transition.stage === "mounting"
        ? { ...state, transition: { ...state.transition, stage: "moving" } }
        : state;
    case "finish":
      return state.transition?.key === action.key ? { ...state, transition: undefined } : state;
  }
};

/** The screens a tab keeps rendered: its stack, and a screen still sliding out. */
export const renderedScreens = (state: NavState, tab: TabId): readonly string[] => {
  const stack = state.stacks[tab];
  const { transition } = state;
  return transition?.kind === "pop" && transition.tab === tab
    ? [...stack, transition.screen]
    : stack;
};

export type ScreenPlace = "top" | "below" | "away";

/**
 * Where a screen sits: on top, just below the top one, or parked off to the
 * side, as is every screen outside its tab's stack.
 */
export const placeOf = (state: NavState, tab: TabId, screen: string): ScreenPlace => {
  if (tab !== state.tab) return "away";
  const shown = renderedScreens(state, tab);
  const index = shown.indexOf(screen);
  if (index < 0) return "away";
  const { transition } = state;
  if (transition?.kind === "push" && transition.stage === "mounting") {
    if (screen === transition.screen) return "away";
    return index === shown.length - 2 ? "top" : "away";
  }
  if (index === shown.length - 1) return "top";
  if (index === shown.length - 2) return "below";
  return "away";
};

/**
 * Whether a screen takes part in layout: the one on top once it settles, and
 * a screen being pushed while it still waits off to the side. Islands on an
 * inert screen keep the frame they were last measured at, so a pushed screen
 * goes live before it moves, or its islands slide in where its content used
 * to be and jump into place when the push ends.
 */
export const isLive = (state: NavState, tab: TabId, screen: string): boolean => {
  const { transition } = state;
  if (transition && transition.tab === tab && transition.screen === screen)
    return transition.kind === "push" && transition.stage === "mounting";
  if (transition?.stage === "moving" && transition.tab === state.tab && tab === state.tab)
    return false;
  return placeOf(state, tab, screen) === "top";
};
