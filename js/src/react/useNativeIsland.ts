import * as React from "react";
import { supportsFeature } from "../capability";
import { ISLAND_PHASE_ATTRIBUTE } from "../attributes";
import { handoffOf, inTransition, type Linear, type NativeHandoff } from "../handoff";
import type { NativeFallbackReason, NativeMountRefusal } from "../islands";
import {
  boxElementsOf,
  frameIn,
  placementOf,
  sameAnchor,
  scaleOf,
  scrollOffsetOf,
  stickyShift,
  unionRect,
  type NativeAnchorOf,
} from "../measure";
import type {
  TNativeAccessibility,
  TNativeAnchor,
  TNativeFrame,
  TNativeShade,
  TNativeTransform,
  TNativeSize,
  TNativeSticky,
} from "../schemas";
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
  /** Where the host draws the island, once it was sent. */
  anchorType?: TNativeAnchor["type"];
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

const TOLERANCE = 0.5;

let nextOrder = 0;

type Geometry = {
  frame: TNativeFrame;
  anchor: TNativeAnchor;
  visible: boolean;
  sticky?: TNativeSticky;
  clip?: TNativeFrame;
  holes?: TNativeFrame[];
  shades?: TNativeShade[];
  transform?: TNativeTransform;
  opacity?: number;
};

const geometryPatch = (geometry: Geometry) =>
  geometry.visible
    ? {
        frame: geometry.frame,
        anchor: geometry.anchor,
        visible: true,
        ...(geometry.sticky ? { sticky: geometry.sticky } : {}),
        ...(geometry.clip ? { clip: geometry.clip } : {}),
        ...(geometry.holes ? { holes: geometry.holes } : {}),
        ...(geometry.shades ? { shades: geometry.shades } : {}),
        ...(geometry.transform ? { transform: geometry.transform } : {}),
        ...(geometry.opacity === undefined ? {} : { opacity: geometry.opacity }),
      }
    : { visible: false };

/**
 * The element's box before it is turned, centred where the turned box is,
 * since turning about any point keeps the centre of its bounds. The size is
 * worked back from the bounds and the transform, which keeps fractions of a
 * pixel; layout's whole-pixel size stands in near 45°, where that can't be
 * solved.
 */
const untransformedFrame = (
  element: HTMLElement,
  bounds: TNativeFrame,
  transform: TNativeTransform,
): TNativeFrame => {
  const a = Math.abs(transform.a);
  const b = Math.abs(transform.b);
  const c = Math.abs(transform.c);
  const d = Math.abs(transform.d);
  const determinant = a * d - c * b;
  let width: number;
  let height: number;
  if (Math.abs(determinant) > 0.2) {
    width = (bounds.width * d - bounds.height * c) / determinant;
    height = (bounds.height * a - bounds.width * b) / determinant;
  } else {
    const box = boxElementsOf(element)[0] as HTMLElement | undefined;
    width = box?.offsetWidth ?? bounds.width;
    height = box?.offsetHeight ?? bounds.height;
  }
  return {
    x: bounds.x + bounds.width / 2 - width / 2,
    y: bounds.y + bounds.height / 2 - height / 2,
    width,
    height,
  };
};

const localClip = (
  clip: TNativeFrame | undefined,
  rect: TNativeFrame,
  scroller: HTMLElement | undefined,
): TNativeFrame | undefined => {
  if (!clip) return undefined;
  const scale = scroller ? scaleOf(scroller) : { x: 1, y: 1 };
  return {
    x: (clip.x - rect.x) / scale.x,
    y: (clip.y - rect.y) / scale.y,
    width: clip.width / scale.x,
    height: clip.height / scale.y,
  };
};

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
    sticky?: TNativeSticky;
    revealing?: boolean;
  }>({});

  const evaluate = React.useCallback(
    (element: HTMLElement) => {
      const placement = placementOf(element, {
        sticky: supportsFeature(islands.capability, "sticky"),
      });
      if (!placement) return undefined;
      const tracked = motion.current;
      tracked.at = placement.at;
      tracked.frame = placement.frame;
      tracked.sticky = placement.sticky;
      const layered = supportsFeature(islands.capability, "layered");
      const riding = layered && placement.kind === "scroller" ? placement.scroller : undefined;
      const watcher = layoutWatcherFor(element.ownerDocument);
      const out: {
        clip?: TNativeFrame;
        holes?: TNativeFrame[];
        shades?: TNativeShade[];
        revealing?: boolean;
        transform?: Linear;
        opacity?: number;
      } = {};
      const handoff = handoffOf(element, placement, watcher.isMoving, layered, {
        clip: supportsFeature(islands.capability, "clip"),
        transform: supportsFeature(islands.capability, "transform"),
        isRevealing: watcher.isRevealing,
        out,
      });
      tracked.revealing = out.revealing === true;
      const clip = localClip(out.clip, placement.rect, riding);
      const holes = out.holes?.map(
        (hole) => localClip(hole, placement.rect, riding) as TNativeFrame,
      );
      const shades = out.shades?.map(({ color, ...area }) => ({
        ...(localClip(area, placement.rect, riding) as TNativeFrame),
        color,
      }));
      const previous = sentAnchor.current;
      const anchor =
        previous && sameAnchor(previous, placement.anchor) ? previous : placement.anchor;
      sentAnchor.current = anchor;
      const transform = out.transform && {
        a: out.transform[0],
        b: out.transform[1],
        c: out.transform[2],
        d: out.transform[3],
      };
      return {
        frame: transform
          ? untransformedFrame(element, placement.frame, transform)
          : placement.frame,
        ...(transform ? { transform } : {}),
        ...(out.opacity === undefined ? {} : { opacity: out.opacity }),
        anchor,
        handoff,
        riding,
        visible: handoff === undefined,
        ...(placement.sticky ? { sticky: placement.sticky } : {}),
        ...(clip ? { clip } : {}),
        ...(holes ? { holes } : {}),
        ...(shades ? { shades } : {}),
      };
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

  const setPlacement = React.useCallback(
    (handoff: NativeHandoff | undefined, anchorType: TNativeAnchor["type"]) => {
      setState((previous) =>
        previous.handoff === handoff && previous.anchorType === anchorType
          ? previous
          : { ...previous, handoff, anchorType },
      );
    },
    [],
  );

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
        inTransition(
          element,
          layoutWatcherFor(element.ownerDocument).isMoving,
          spec.riding,
          supportsFeature(islands.capability, "clip")
            ? layoutWatcherFor(element.ownerDocument).isRevealing
            : undefined,
        )
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
          ...(spec.sticky ? { sticky: spec.sticky } : {}),
          ...(spec.clip ? { clip: spec.clip } : {}),
          ...(spec.holes ? { holes: spec.holes } : {}),
          ...(spec.shades ? { shades: spec.shades } : {}),
          ...(spec.transform ? { transform: spec.transform } : {}),
          ...(spec.opacity === undefined ? {} : { opacity: spec.opacity }),
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
            const geometry = evaluate(element);
            return (
              geometry && {
                frame: geometry.frame,
                anchor: geometry.anchor,
                visible: geometry.visible,
                ...(geometry.sticky ? { sticky: geometry.sticky } : {}),
                ...(geometry.clip ? { clip: geometry.clip } : {}),
                ...(geometry.holes ? { holes: geometry.holes } : {}),
                ...(geometry.shades ? { shades: geometry.shades } : {}),
                ...(geometry.transform ? { transform: geometry.transform } : {}),
                ...(geometry.opacity === undefined ? {} : { opacity: geometry.opacity }),
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
      setState({ mode: "pending", handoff: spec.handoff, anchorType: spec.anchor.type });
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
    setPlacement(spec.handoff, spec.anchor.type);
  });

  const active = state.mode !== "web";

  React.useEffect(() => {
    const element = wrapper.current;
    if (!active || !element) return;
    const relayout = () => {
      const geometry = evaluate(element);
      if (!geometry) return;
      islands.update(id, geometryPatch(geometry));
      setPlacement(geometry.handoff, geometry.anchor.type);
    };
    const follow = () => {
      const tracked = motion.current;
      const at = tracked.at as NativeAnchorOf;
      const rect = unionRect(boxElementsOf(element));
      if (!rect) return;
      const natural = tracked.frame as TNativeFrame;
      const last =
        tracked.sticky && at.kind === "scroller"
          ? {
              ...natural,
              y:
                natural.y +
                stickyShift(
                  tracked.sticky,
                  scrollOffsetOf(at.scroller).y,
                  at.scroller.clientHeight,
                ),
            }
          : natural;
      const frame = frameIn(at, rect, element.ownerDocument);
      if (at.kind === "tracked") {
        if (moved(frame, last)) relayout();
        return;
      }
      if (moved(frame, last)) relayout();
    };
    const offstage = `[inert], [${ISLAND_PHASE_ATTRIBUTE}]`;
    const onPass = (pass: LayoutPass) => {
      // A page that isn't showing, or is sliding in or out, carries its
      // islands itself; following them there would only stream frames. The
      // page coming on stage is a layout change, which measures them again.
      if (element.closest(offstage)) return;
      follow();
      if (pass === "layout" || motion.current.revealing) relayout();
    };
    const unsubscribe = layoutWatcherFor(element.ownerDocument).subscribe(onPass);
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(relayout);
    for (const box of boxElementsOf(element)) observer?.observe(box);
    return () => {
      unsubscribe();
      observer?.disconnect();
    };
  }, [islands, id, active, evaluate, setPlacement, wrapper]);

  const command = React.useCallback<NativeIslandState["command"]>(
    (name, args, commandOptions) => islands.command(id, name, args, commandOptions),
    [islands, id],
  );
  const readState = React.useCallback(() => islands.state(id), [islands, id]);

  return { ...state, id, command, state: readState };
};
