import * as React from "react";
import { supportsFeature } from "../capability";
import { handoffOf, inTransition, type NativeHandoff } from "../handoff";
import type { NativeFallbackReason, NativeMountRefusal } from "../islands";
import {
  boxElementsOf,
  frameIn,
  placementOf,
  sameAnchor,
  unionRect,
  type NativeAnchorOf,
} from "../measure";
import type { TNativeAccessibility, TNativeAnchor, TNativeFrame, TNativeSize } from "../schemas";
import { layoutWatcherFor, type LayoutPass } from "../watcher";
import { accessibilityOf } from "./accessibility";
import { useNativeIslandsContext } from "./context";
import { resolveNativeProps } from "./props";

/** Who sets a native component's size: its web children (`"web"`) or the native view (`"native"`). */
export type NativeSizing = "web" | "native";

/** Where a native component stands: web only, waiting for the host, or drawn natively. */
export type NativeMode = "web" | "pending" | "native";

export type NativeIslandOptions = {
  component: string;
  version: number;
  props: Readonly<Record<string, unknown>>;
  sizing: NativeSizing;
  colorProps: readonly string[];
  islandId?: string;
  enabled: boolean;
  accessibility?: TNativeAccessibility;
  onEvent: (name: string, payload: unknown) => void;
  onState?: (
    state: Readonly<Record<string, unknown>>,
    changed: Readonly<Record<string, unknown>>,
  ) => void;
  onRequest?: (name: string, payload: unknown) => unknown;
};

export type NativeIslandState = {
  id: string;
  mode: NativeMode;
  size?: TNativeSize;
  handoff?: NativeHandoff;
  command: (name: string, args?: unknown, options?: { timeoutMs?: number }) => Promise<unknown>;
  state: () => Readonly<Record<string, unknown>> | undefined;
};

type Reason = NativeMountRefusal | NativeFallbackReason | "timeout" | "no_elements";

const QUIET_REFUSALS: ReadonlySet<Reason> = new Set(["unavailable"]);

const MESSAGES: Partial<Record<Reason, string>> = {
  timeout: "the host has not answered yet; it switches to native if it does",
  no_elements: "it has no element children to measure; wrap an element, not bare text",
};

/** Frames that must pass without movement before an island that moved is shown again. */
export const SETTLE_FRAMES = 2;

const TOLERANCE = 0.5;

let nextOrder = 0;

const geometryPatch = (geometry: {
  frame: TNativeFrame;
  anchor: TNativeAnchor;
  visible: boolean;
}) =>
  geometry.visible
    ? { frame: geometry.frame, anchor: geometry.anchor, visible: true }
    : { visible: false };

const report = (component: string, reason: Reason, message?: string) => {
  if (QUIET_REFUSALS.has(reason)) return;
  const detail = message ?? MESSAGES[reason];
  console.warn(
    `<${component}> is showing its web version: ${reason}${detail ? ` (${detail})` : ""}.`,
  );
};

const moved = (left: TNativeFrame, right: TNativeFrame) =>
  Math.abs(left.x - right.x) > TOLERANCE ||
  Math.abs(left.y - right.y) > TOLERANCE ||
  Math.abs(left.width - right.width) > TOLERANCE ||
  Math.abs(left.height - right.height) > TOLERANCE;

export const useNativeIsland = (
  wrapper: React.RefObject<HTMLElement | null>,
  options: NativeIslandOptions,
): NativeIslandState => {
  const { islands, readiness } = useNativeIslandsContext();
  const generatedId = React.useId();
  const id = options.islandId ?? `${options.component}${generatedId}`;
  const [state, setState] = React.useState<Omit<NativeIslandState, "id" | "command" | "state">>({
    mode: "web",
  });
  const latest = React.useRef(options);
  latest.current = options;
  const mounted = React.useRef(false);
  const sentAnchor = React.useRef<TNativeAnchor | undefined>(undefined);
  const motion = React.useRef<{
    at?: NativeAnchorOf;
    frame?: TNativeFrame;
    moving: boolean;
    still: number;
  }>({ moving: false, still: 0 });

  const evaluate = React.useCallback(
    (element: HTMLElement) => {
      const placement = placementOf(element);
      if (!placement) return undefined;
      const tracked = motion.current;
      tracked.at = placement.at;
      tracked.frame = placement.frame;
      const layered = supportsFeature(islands.capability, "layered");
      const riding = layered && placement.kind === "scroller" ? placement.scroller : undefined;
      const handoff = tracked.moving
        ? "moving"
        : handoffOf(element, placement, layoutWatcherFor(element.ownerDocument).isMoving, layered);
      const previous = sentAnchor.current;
      const anchor =
        previous && sameAnchor(previous, placement.anchor) ? previous : placement.anchor;
      sentAnchor.current = anchor;
      return { frame: placement.frame, anchor, handoff, riding, visible: handoff === undefined };
    },
    [islands],
  );

  const specOf = React.useCallback(
    (element: HTMLElement) => {
      const geometry = evaluate(element);
      if (!geometry) return undefined;
      const current = latest.current;
      return {
        ...geometry,
        props: resolveNativeProps(current.props, element, current.colorProps),
        accessibility: accessibilityOf(boxElementsOf(element), current.accessibility) ?? {},
      };
    },
    [evaluate],
  );

  const setHandoff = React.useCallback((handoff: NativeHandoff | undefined) => {
    setState((previous) => (previous.handoff === handoff ? previous : { ...previous, handoff }));
  }, []);

  const { component, version, sizing, enabled } = options;

  React.useLayoutEffect(() => {
    const element = wrapper.current;
    if (!enabled || !element) return;
    const waits = islands.supports(component, version) === "supported";
    if (waits) readiness.begin(id);
    let live = false;
    let warned = false;
    let stopWaiting: (() => void) | undefined;
    const tryMount = (): boolean => {
      sentAnchor.current = undefined;
      motion.current.moving = false;
      motion.current.still = 0;
      const spec = specOf(element);
      if (!spec) {
        if (!warned && boxElementsOf(element).length === 0) {
          report(component, "no_elements");
          readiness.end(id);
        }
        warned = true;
        return false;
      }
      if (
        spec.handoff === "inactive" ||
        spec.handoff === "moving" ||
        inTransition(element, layoutWatcherFor(element.ownerDocument).isMoving, spec.riding)
      ) {
        readiness.end(id);
        return false;
      }
      if (waits) readiness.begin(id);
      const result = islands.mount(
        id,
        {
          component,
          version,
          sizing,
          visible: spec.visible,
          order: nextOrder++,
          frame: spec.frame,
          anchor: spec.anchor,
          props: spec.props,
          accessibility: spec.accessibility,
        },
        {
          onReady: () => {
            readiness.end(id);
            setState((previous) => ({ ...previous, mode: "native" }));
          },
          onPending: () => {
            readiness.begin(id);
            setState((previous) => ({ ...previous, mode: "pending" }));
          },
          onStall: () => {
            readiness.end(id);
            report(component, "timeout");
            setState((previous) => ({ ...previous, mode: "pending" }));
          },
          onFallback: (reason, message) => {
            mounted.current = false;
            readiness.end(id);
            report(component, reason, message);
            setState({ mode: "web" });
          },
          onEvent: (name, payload) => latest.current.onEvent(name, payload),
          onState: (values, changed) => latest.current.onState?.(values, changed),
          onRequest: (name, payload) => {
            const handler = latest.current.onRequest;
            if (!handler) {
              throw new Error(
                `<${component}> has no handler for the ${JSON.stringify(name)} request.`,
              );
            }
            return handler(name, payload);
          },
          onSize: (size) =>
            setState((previous) =>
              previous.size?.width === size.width && previous.size.height === size.height
                ? previous
                : { ...previous, size },
            ),
          refresh: () => {
            sentAnchor.current = undefined;
            motion.current.moving = false;
            motion.current.still = 0;
            const geometry = evaluate(element);
            return (
              geometry && {
                frame: geometry.frame,
                anchor: geometry.anchor,
                visible: geometry.visible,
              }
            );
          },
        },
      );
      if (!result.ok) {
        readiness.end(id);
        report(component, result.reason);
        return true;
      }
      live = true;
      mounted.current = true;
      setState({ mode: "pending", handoff: spec.handoff });
      return true;
    };
    const watcher = layoutWatcherFor(element.ownerDocument);
    stopWaiting = watcher.subscribe((pass) => {
      if (pass !== "layout" || !tryMount()) return;
      stopWaiting?.();
      stopWaiting = undefined;
    });
    watcher.refresh();
    return () => {
      stopWaiting?.();
      readiness.end(id);
      if (!live) return;
      mounted.current = false;
      islands.unmount(id);
      setState({ mode: "web" });
    };
  }, [islands, readiness, id, component, version, sizing, enabled, specOf, evaluate, wrapper]);

  React.useLayoutEffect(() => {
    const element = wrapper.current;
    if (!mounted.current || !element) return;
    const spec = specOf(element);
    if (!spec) return;
    islands.update(id, {
      ...geometryPatch(spec),
      props: spec.props,
      accessibility: spec.accessibility,
    });
    setHandoff(spec.handoff);
  });

  const active = state.mode !== "web";

  React.useEffect(() => {
    const element = wrapper.current;
    if (!active || !element) return;
    const relayout = () => {
      const geometry = evaluate(element);
      if (!geometry) return;
      islands.update(id, geometryPatch(geometry));
      setHandoff(geometry.handoff);
    };
    const follow = () => {
      const tracked = motion.current;
      const at = tracked.at as NativeAnchorOf;
      const rect = unionRect(boxElementsOf(element));
      if (!rect) return;
      const last = tracked.frame as TNativeFrame;
      const frame = frameIn(at, rect, element.ownerDocument);
      if (at.kind === "tracked") {
        if (moved(frame, last)) relayout();
        return;
      }
      if (moved(frame, last)) {
        tracked.frame = frame;
        tracked.still = 0;
        if (!tracked.moving) {
          tracked.moving = true;
          islands.update(id, { visible: false });
          setHandoff("moving");
        }
        return;
      }
      if (!tracked.moving) return;
      tracked.still += 1;
      if (tracked.still < SETTLE_FRAMES) return;
      tracked.moving = false;
      relayout();
    };
    const onPass = (pass: LayoutPass) => {
      follow();
      if (pass === "layout") relayout();
    };
    const unsubscribe = layoutWatcherFor(element.ownerDocument).subscribe(onPass);
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(relayout);
    for (const box of boxElementsOf(element)) observer?.observe(box);
    return () => {
      unsubscribe();
      observer?.disconnect();
    };
  }, [islands, id, active, evaluate, setHandoff, wrapper]);

  const command = React.useCallback<NativeIslandState["command"]>(
    (name, args, commandOptions) => islands.command(id, name, args, commandOptions),
    [islands, id],
  );
  const readState = React.useCallback(() => islands.state(id), [islands, id]);

  return { ...state, id, command, state: readState };
};
