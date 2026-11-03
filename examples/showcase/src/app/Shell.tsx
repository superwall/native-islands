import * as React from "react";
import { ISLAND_PHASE_ATTRIBUTE } from "@superwall/native-islands";
import { useNativeIslandsReady } from "@superwall/native-islands/react";
import { BarButton } from "../ui/controls";
import { TabBar } from "../ui/TabBar";
import { NavProvider, type Nav, type ScreenSpec } from "./nav";
import {
  TABS,
  canGoBack,
  initialState,
  navigate,
  placeOf,
  renderedScreens,
  type NavState,
  type ScreenPlace,
  type TabId,
} from "./navigation";
import { useSwipeBack } from "./useSwipeBack";

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
  parkedAt,
  motion,
  back,
}: {
  spec: ScreenSpec;
  place: ScreenPlace;
  parkedAt: number;
  motion: Motion | undefined;
  back?: () => void;
}) => {
  const onScroll = React.useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      const scrolled = event.currentTarget.scrollTop > (spec.largeTitle ? 44 : 4);
      event.currentTarget.parentElement?.toggleAttribute("data-scrolled", scrolled);
    },
    [spec.largeTitle],
  );
  return (
    <section
      className="screen"
      data-screen={spec.id}
      data-place={place}
      data-motion={motion}
      data-inline-title={spec.largeTitle ? undefined : ""}
      style={{ left: place === "away" ? `${(parkedAt + 1) * 100}%` : 0 }}
      inert={place !== "top" || motion !== undefined}
      aria-hidden={place !== "top"}
      {...(motion ? { [ISLAND_PHASE_ATTRIBUTE]: motion } : {})}
    >
      <div className="screen-scroll" onScroll={onScroll}>
        <div className="screen-content">
          <div className="nav-spacer" />
          {spec.largeTitle && <h1 className="large-title">{spec.title}</h1>}
          <ScreenBody Component={spec.Component} />
        </div>
      </div>
      <header className="nav-bar">
        <div className="nav-leading">
          {back && (
            <BarButton
              symbol="chevron.left"
              label="Back"
              glassGroup={`nav-${spec.id}`}
              onPress={back}
            />
          )}
        </div>
        <div className="nav-title">{spec.title}</div>
        <div className="nav-trailing" />
      </header>
    </section>
  );
};

/**
 * The app: a tab bar over one navigation stack per tab. Every screen in every
 * stack stays rendered, so going back is instant and islands are always
 * drawn; screens not showing wait off to the side, each at its own spot, so
 * the host can tell their scrolling areas apart.
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
      const frame = requestAnimationFrame(() => requestAnimationFrame(move));
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
    }),
    [screens],
  );

  const swipeBack = React.useCallback(() => dispatch({ type: "pop", animated: false }), []);
  useSwipeBack(root, canGoBack(state) && !transition, swipeBack);

  const order = screens.map((spec) => spec.id);

  return (
    <NavProvider value={nav}>
      <div className="screens" ref={root}>
        {TABS.flatMap((tab: TabId) => {
          const shown = renderedScreens(state, tab);
          return shown.map((id, index) => {
            const spec = specs.get(id);
            if (!spec) return null;
            const place = placeOf(state, tab, id);
            return (
              <Screen
                key={id}
                spec={spec}
                place={place}
                parkedAt={order.indexOf(id)}
                motion={motionOf(state, place)}
                back={index > 0 ? nav.back : undefined}
              />
            );
          });
        })}
      </div>
      <TabBar selected={state.tab} onSelect={(tab) => dispatch({ type: "select", tab })} />
    </NavProvider>
  );
};
