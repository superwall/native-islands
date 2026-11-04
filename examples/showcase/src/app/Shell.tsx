import * as React from "react";
import { ISLAND_PHASE_ATTRIBUTE } from "@superwall/native-islands";
import { useNativeIslandsReady } from "@superwall/native-islands/react";
import { NativeNavigationBar } from "../islands/definitions";
import { WebSymbol } from "../ui/icons";
import { WebMenu } from "../ui/inputs";
import { TabBar } from "../ui/TabBar";
import { NavProvider, ShowingProvider, type Nav, type ScreenSpec } from "./nav";
import {
  canGoBack,
  initialState,
  topOf,
  isLive,
  mountedScreens,
  navigate,
  placeOf,
  type NavState,
  type ScreenPlace,
} from "./navigation";
import { useNativeEnabled, usePreferences } from "./preferences";
import { useSwipeBack } from "./useSwipeBack";
import { viewModeItems, viewModeOf } from "./viewMode";

const PUSH_MS = 500;

/** How long a pushed screen waits off to the side for its islands before it slides in anyway. */
const MOUNT_WAIT_MS = 250;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

type Motion = "push-in" | "push-under" | "pop-out" | "pop-under";

const motionOf = (state: NavState, place: ScreenPlace): Motion | undefined => {
  const { transition } = state;
  if (!transition || transition.stage !== "moving" || transition.tab !== state.tab) return;
  if (place === "away") return;
  if (transition.kind === "push") return place === "top" ? "push-in" : "push-under";
  return place === "top" ? "pop-out" : "pop-under";
};

const ScreenBody = React.memo(({ Component }: { Component: React.ComponentType }) => <Component />);

const Screen = ({
  spec,
  place,
  live,
  parkedAt,
  motion,
  onScrolled,
}: {
  spec: ScreenSpec;
  place: ScreenPlace;
  live: boolean;
  parkedAt: number;
  motion: Motion | undefined;
  onScrolled: (screen: string, scrolled: boolean) => void;
}) => {
  const onScroll = React.useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      const scrolled = event.currentTarget.scrollTop > (spec.largeTitle ? 44 : 4);
      event.currentTarget.parentElement?.toggleAttribute("data-scrolled", scrolled);
      onScrolled(spec.id, scrolled);
    },
    [spec.id, spec.largeTitle, onScrolled],
  );
  return (
    <section
      className="screen"
      data-screen={spec.id}
      data-place={place}
      data-motion={motion}
      data-inline-title={spec.largeTitle ? undefined : ""}
      style={{ left: place === "away" ? `${(parkedAt + 1) * 100}%` : 0 }}
      inert={!live}
      aria-hidden={place !== "top"}
      {...(motion ? { [ISLAND_PHASE_ATTRIBUTE]: motion } : {})}
    >
      <div className="screen-scroll" onScroll={onScroll}>
        <div className="screen-content">
          <div className="nav-spacer" />
          {spec.largeTitle && <h1 className="large-title">{spec.title}</h1>}
          <ShowingProvider value={place === "top"}>
            <ScreenBody Component={spec.Component} />
          </ShowingProvider>
        </div>
      </div>
      <div className="nav-bar" aria-hidden />
    </section>
  );
};

/**
 * The navigation bar over every screen. It is one bar for the whole app, as
 * UINavigationBar is, so it stays put while screens slide under it, and only
 * its items change: Back appears once the stack can go back, the title is the
 * top screen's, and the View Mode menu sits at its right on every screen.
 */
const NavigationBar = ({
  title,
  titleShown,
  showsBack,
  onBack,
}: {
  title: string;
  titleShown: boolean;
  showsBack: boolean;
  onBack: () => void;
}) => {
  const { mode, set } = usePreferences();
  const items = viewModeItems(mode);
  const select = (id: string) => {
    const next = viewModeOf(id);
    if (next) set({ mode: next });
  };
  return (
    <header className="app-nav">
      <NativeNavigationBar
        islandId="navigation-bar"
        title={title}
        titleShown={titleShown}
        showsBack={showsBack}
        systemImage="square.stack.3d.up.fill"
        menuLabel="View Mode"
        items={items}
        native={useNativeEnabled()}
        onBack={onBack}
        onSelect={({ id }) => select(id)}
      >
        <div className="nav-items">
          <div className="nav-leading">
            {showsBack && (
              <button type="button" className="glass-circle" aria-label="Back" onClick={onBack}>
                <WebSymbol name="chevron.left" className="bar-symbol" />
              </button>
            )}
          </div>
          <div className="nav-title" data-shown={titleShown ? "" : undefined}>
            {title}
          </div>
          <div className="nav-trailing">
            <WebMenu
              label="View Mode"
              symbol="square.stack.3d.up.fill"
              items={items}
              onSelect={select}
            />
          </div>
        </div>
      </NativeNavigationBar>
    </header>
  );
};

/**
 * The app: a tab bar over one navigation stack per tab. A screen mounts the
 * first time it is pushed and then only ever moves: screens not showing wait
 * off to the side, each at its own spot, so the host can tell their
 * scrolling areas apart, and a pushed screen's islands are drawn before it
 * slides in.
 */
export const Shell = ({ screens }: { screens: readonly ScreenSpec[] }) => {
  const specs = React.useMemo(() => new Map(screens.map((spec) => [spec.id, spec])), [screens]);
  const tabOf = React.useCallback((screen: string) => specs.get(screen)?.tab, [specs]);
  const [state, dispatch] = React.useReducer(navigate, undefined, () =>
    initialState(window.location.search, tabOf),
  );
  const ready = useNativeIslandsReady();
  const root = React.useRef<HTMLDivElement>(null);
  const { transition } = state;

  React.useEffect(() => {
    if (transition?.stage !== "mounting") return;
    const { key } = transition;
    const move = () => dispatch({ type: "move", key });
    if (ready) {
      // The screen went live this render: one frame for the layout watcher to
      // measure its islands, one for their frames to reach the host, and one
      // for the host to place them before the screen starts to move.
      let frame = 0;
      const after = (frames: number) => {
        frame = requestAnimationFrame(() => (frames > 1 ? after(frames - 1) : move()));
      };
      after(3);
      return () => cancelAnimationFrame(frame);
    }
    const timer = setTimeout(move, MOUNT_WAIT_MS);
    return () => clearTimeout(timer);
  }, [transition, ready]);

  React.useEffect(() => {
    if (transition?.stage !== "moving") return;
    const { key } = transition;
    const timer = setTimeout(
      () => dispatch({ type: "finish", key }),
      reducedMotion() ? 0 : PUSH_MS,
    );
    return () => clearTimeout(timer);
  }, [transition]);

  const nav = React.useMemo<Nav>(
    () => ({
      screens,
      push: (screen) => dispatch({ type: "push", screen }),
      back: () => dispatch({ type: "pop", animated: true }),
      open: (screen) => {
        const tab = specs.get(screen)?.tab;
        if (tab) dispatch({ type: "open", tab, screen });
      },
    }),
    [screens, specs],
  );

  const swipeBack = React.useCallback(() => dispatch({ type: "pop", animated: false }), []);
  const [scrolled, setScrolled] = React.useState<Readonly<Record<string, boolean>>>({});
  const onScrolled = React.useCallback(
    (screen: string, next: boolean) =>
      setScrolled((current) =>
        current[screen] === next ? current : { ...current, [screen]: next },
      ),
    [],
  );
  const mounted = React.useRef<ReadonlySet<string>>(new Set());
  mounted.current = mountedScreens(state, mounted.current);
  const top = specs.get(topOf(state));
  useSwipeBack(root, canGoBack(state) && !transition, swipeBack);

  return (
    <NavProvider value={nav}>
      <div className="screens" ref={root}>
        {screens.map(
          (spec, index) =>
            mounted.current.has(spec.id) && (
              <Screen
                key={spec.id}
                spec={spec}
                place={placeOf(state, spec.tab, spec.id)}
                live={isLive(state, spec.tab, spec.id)}
                parkedAt={index}
                motion={motionOf(state, placeOf(state, spec.tab, spec.id))}
                onScrolled={onScrolled}
              />
            ),
        )}
      </div>
      <NavigationBar
        title={top?.title ?? ""}
        titleShown={!top?.largeTitle || scrolled[top.id] === true}
        showsBack={canGoBack(state)}
        onBack={nav.back}
      />
      <TabBar selected={state.tab} onSelect={(tab) => dispatch({ type: "select", tab })} />
    </NavProvider>
  );
};
