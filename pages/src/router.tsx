import * as React from "react";
import { ISLAND_PHASE_ATTRIBUTE } from "@superwall/native-islands";

/** Every page, in the order the index lists them. */
export const ROUTES = [
  "index",
  "app-player",
  "app-paywall",
  "app-settings",
  "app-map",
  "buttons",
  "controls",
  "scrolling",
  "motion",
  "overlays",
  "stress",
  "state",
  "onboarding",
  "flow-plans",
  "flow-details",
  "flow-done",
  "perf",
] as const;

export type RouteName = (typeof ROUTES)[number];

export const TRANSITION_MS = 450;

type Transition = { route: RouteName; kind: "enter" | "leave"; key: number };

type RouterState = { stack: readonly RouteName[]; transition?: Transition };

export type Router = {
  stack: readonly RouteName[];
  current: RouteName;
  canGoBack: () => boolean;
  push: (route: RouteName) => void;
  back: () => void;
  reset: () => void;
};

const RouterContext = React.createContext<Router | undefined>(undefined);
const RouteContext = React.createContext<{ name: RouteName; active: boolean } | undefined>(
  undefined,
);

export const useRouter = (): Router => {
  const router = React.useContext(RouterContext);
  if (!router) throw new Error("useRouter needs a <Pages> above it.");
  return router;
};

/** Whether the page this component renders in is the one on top. */
export const useRouteActive = (): boolean => React.useContext(RouteContext)?.active ?? true;

const isRoute = (value: string | null): value is RouteName =>
  value !== null && (ROUTES as readonly string[]).includes(value);

/** `?route=<name>` opens straight on that page, with the index behind it. */
export const initialStack = (search: string): RouteName[] => {
  const route = new URLSearchParams(search).get("route");
  return isRoute(route) && route !== "index" ? ["index", route] : ["index"];
};

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const ROUTE_VALUES = Object.fromEntries(
  ROUTES.flatMap((name) => [
    [`${name}:on`, { name, active: true }],
    [`${name}:off`, { name, active: false }],
  ]),
) as Record<string, { name: RouteName; active: boolean }>;

const PageBody = React.memo(({ Page }: { Page: React.ComponentType }) => <Page />);

/**
 * A stack of pages that are all rendered at once. The page on top is live;
 * every other page stays laid out off to the side, inert, so its islands are
 * already drawn by the time it slides in. Each page scrolls on its own, and
 * each one waits at its own spot, so the host can tell their scrolling areas
 * apart even when two pages have the same size.
 */
export const Pages = ({
  pages,
  layout: Layout = React.Fragment,
}: {
  pages: Readonly<Record<RouteName, React.ComponentType>>;
  layout?: React.ComponentType<React.PropsWithChildren>;
}) => {
  const [state, setState] = React.useState<RouterState>(() => ({
    stack: initialStack(window.location.search),
  }));
  const keys = React.useRef(0);

  const navigate = React.useCallback((next: (stack: readonly RouteName[]) => RouterState) => {
    setState((current) => next(current.stack));
  }, []);

  const router = React.useMemo<Router>(() => {
    const top = state.stack[state.stack.length - 1] as RouteName;
    return {
      stack: state.stack,
      current: top,
      canGoBack: () => state.stack.length > 1,
      push: (route) =>
        navigate((stack) =>
          stack[stack.length - 1] === route
            ? { stack }
            : {
                stack: [...stack.filter((entry) => entry !== route), route],
                transition: { route, kind: "enter", key: ++keys.current },
              },
        ),
      back: () =>
        navigate((stack) =>
          stack.length > 1
            ? {
                stack: stack.slice(0, -1),
                transition: {
                  route: stack[stack.length - 1] as RouteName,
                  kind: "leave",
                  key: ++keys.current,
                },
              }
            : { stack },
        ),
      reset: () => navigate(() => ({ stack: ["index"] })),
    };
  }, [navigate, state.stack]);

  React.useEffect(() => {
    if (!state.transition) return;
    const { key } = state.transition;
    const timer = setTimeout(
      () =>
        setState((current) =>
          current.transition?.key === key ? { stack: current.stack } : current,
        ),
      reducedMotion() ? 0 : TRANSITION_MS,
    );
    return () => clearTimeout(timer);
  }, [state.transition]);

  const top = router.current;
  const below = state.stack[state.stack.length - 2];
  const layerOf = (name: RouteName): number => {
    if (state.transition?.route === name) return 3;
    if (name === top) return 2;
    if (name === below) return 1;
    return 0;
  };

  const inView = (name: RouteName) =>
    name === top || state.transition?.route === name || (!!state.transition && name === below);

  return (
    <RouterContext.Provider value={router}>
      <Layout>
        <div className="routes">
          {ROUTES.map((name) => {
            const Page = pages[name];
            const active = name === top && state.transition?.route !== name;
            const phase = state.transition?.route === name ? state.transition.kind : undefined;
            const leaving = phase === "leave";
            return (
              <RouteContext.Provider
                key={name}
                value={ROUTE_VALUES[`${name}:${name === top ? "on" : "off"}`]}
              >
                <section
                  className="route"
                  data-island-route={name}
                  data-route-state={name === top ? "top" : "below"}
                  style={{
                    zIndex: layerOf(name),
                    left: inView(name) ? 0 : `${(ROUTES.indexOf(name) + 1) * 100}%`,
                  }}
                  inert={!active && !leaving}
                  aria-hidden={!active}
                  {...(phase ? { [ISLAND_PHASE_ATTRIBUTE]: phase, "data-route-phase": phase } : {})}
                >
                  <div className="route-content">
                    <PageBody Page={Page} />
                  </div>
                </section>
              </RouteContext.Provider>
            );
          })}
        </div>
      </Layout>
    </RouterContext.Provider>
  );
};
