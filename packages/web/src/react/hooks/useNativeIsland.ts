import { withoutUndefined } from "../../protocol/defined";
import * as React from "react";
import { supportsFeature } from "../../protocol/capability";
import { ISLAND_PHASE_ATTRIBUTE } from "../../layout/attributes";
import { handoffOf, inTransition, type Linear, type NativeHandoff } from "../../layout/handoff";
import type { NativeFallbackReason, NativeMountRefusal } from "../../islands/controller";
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
} from "../../layout/measure";
import type {
  TNativeAccessibility,
  TNativeAnchor,
  TNativeFrame,
  TNativeShade,
  TNativeMotion,
  TNativeTransform,
  TNativeSize,
  TNativeSticky,
} from "../../protocol/schemas";
import { layoutWatcherFor, type LayoutPass } from "../../layout/watcher";
import { accessibilityOf } from "../dom/accessibility";
import { useNativeIslandsContext } from "../provider/context";
import { resolveNativeProps } from "../dom/props";

export type NativeSizing = "web" | "native";

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
  anchorType?: TNativeAnchor["type"];
  /** The host is taking over a view it kept, so the web version goes without a fade. */
  reusing?: boolean;
  command: (name: string, args?: unknown, options?: { timeoutMs?: number }) => Promise<unknown>;
  state: () => Readonly<Record<string, unknown>> | undefined;
};

type Reason = NativeMountRefusal | NativeFallbackReason | "timeout" | "no_elements";

const QUIET_REFUSALS: ReadonlySet<Reason> = new Set(["unavailable"]);

const MESSAGES: Partial<Record<Reason, string>> = {
  timeout: "the host has not answered yet; it switches to native if it does",
  no_elements:
    "it has no element child with a box to measure; wrap an element that is not hidden, not bare text",
};

const TOLERANCE = 0.5;

/** How long after a take-over the web version still goes without a fade. */
export const REUSE_GRACE_MS = 150;

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
  motion?: TNativeMotion;
};

const geometryPatch = (geometry: Geometry) =>
  geometry.visible
    ? withoutUndefined({
        frame: geometry.frame,
        anchor: geometry.anchor,
        visible: true,
        sticky: geometry.sticky,
        clip: geometry.clip,
        holes: geometry.holes,
        shades: geometry.shades,
        transform: geometry.transform,
        opacity: geometry.opacity,
        motion: geometry.motion,
      })
    : { visible: false };

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
  const { width, height } =
    Math.abs(determinant) > 0.2
      ? {
          width: (bounds.width * d - bounds.height * c) / determinant,
          height: (bounds.height * a - bounds.width * b) / determinant,
        }
      : boxElementsOf(element).reduce(
          (_, box) => ({ width: box.offsetWidth, height: box.offsetHeight }),
          { width: bounds.width, height: bounds.height },
        );
  return {
    x: bounds.x + bounds.width / 2 - width / 2,
    y: bounds.y + bounds.height / 2 - height / 2,
    width,
    height,
  };
};

const localClip = (
  clip: TNativeFrame,
  rect: TNativeFrame,
  scale: { x: number; y: number },
): TNativeFrame => ({
  x: (clip.x - rect.x) / scale.x,
  y: (clip.y - rect.y) / scale.y,
  width: clip.width / scale.x,
  height: clip.height / scale.y,
});

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
        motion?: TNativeMotion;
        slid?: { x: number; y: number };
      } = {};
      const handoff = handoffOf(element, placement, watcher.isMoving, layered, {
        clip: supportsFeature(islands.capability, "clip"),
        transform: supportsFeature(islands.capability, "transform"),
        motion: supportsFeature(islands.capability, "motion"),
        isRevealing: watcher.isRevealing,
        out,
      });
      tracked.revealing = out.revealing === true;
      const scale = riding ? scaleOf(riding) : { x: 1, y: 1 };
      const clip = out.clip && localClip(out.clip, placement.rect, scale);
      const holes = out.holes?.map((hole) => localClip(hole, placement.rect, scale));
      const shades = out.shades?.map(({ color, ...area }) => ({
        ...localClip(area, placement.rect, scale),
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
      const measured = transform
        ? untransformedFrame(element, placement.frame, transform)
        : placement.frame;
      const slid = out.motion ? out.slid : undefined;
      return {
        frame: slid ? { ...measured, x: measured.x - slid.x, y: measured.y - slid.y } : measured,
        anchor,
        handoff,
        riding,
        visible: handoff === undefined,
        ...withoutUndefined({
          transform,
          opacity: out.opacity,
          motion: out.motion,
          sticky: placement.sticky,
          clip,
          holes,
          shades,
        }),
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
    let grace: ReturnType<typeof setTimeout> | undefined;
    const tryMount = (onlyReusing = false): boolean => {
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
      if (
        onlyReusing &&
        !islands.reusable({ component, version, sizing, props: spec.props, anchor: spec.anchor })
      ) {
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
          ...withoutUndefined({
            sticky: spec.sticky,
            clip: spec.clip,
            holes: spec.holes,
            shades: spec.shades,
            transform: spec.transform,
            opacity: spec.opacity,
            motion: spec.motion,
          }),
        },
        {
          onReady: () => {
            readiness.end(id);
            setState((previous) => ({ ...previous, mode: "native" }));
          },
          onPending: () => {
            readiness.begin(id);
            setState((previous) => ({ ...previous, mode: "pending", reusing: undefined }));
          },
          onStall: () => {
            readiness.end(id);
            report(component, "timeout");
            setState((previous) => ({ ...previous, mode: "pending", reusing: undefined }));
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
              geometry &&
              withoutUndefined({
                frame: geometry.frame,
                anchor: geometry.anchor,
                visible: geometry.visible,
                sticky: geometry.sticky,
                clip: geometry.clip,
                holes: geometry.holes,
                shades: geometry.shades,
                transform: geometry.transform,
                opacity: geometry.opacity,
                motion: geometry.motion,
              })
            );
          },
        },
        { reuse: onlyReusing },
      );
      if (!result.ok) {
        readiness.end(id);
        report(component, result.reason);
        return true;
      }
      live = true;
      mounted.current = true;
      setState(
        withoutUndefined({
          mode: "pending" as const,
          handoff: spec.handoff,
          anchorType: spec.anchor.type,
          reusing: result.reusing,
        }),
      );
      if (result.reusing) {
        grace = setTimeout(() => {
          setState((previous) => ({ ...previous, reusing: undefined }));
        }, REUSE_GRACE_MS);
      }
      return true;
    };
    // An island coming back where the host still holds a view like it, such
    // as a search result showing again, mounts in this commit so the host
    // can show that view in the frame the row first paints. Every other
    // island waits for the next layout pass, when the page has settled.
    if (!(islands.mayReuse(component) && tryMount(true))) {
      const watcher = layoutWatcherFor(element.ownerDocument);
      stopWaiting = watcher.subscribe((pass) => {
        if (pass !== "layout" || !tryMount()) return;
        stopWaiting?.();
        stopWaiting = undefined;
      });
      watcher.refresh();
    }
    return () => {
      stopWaiting?.();
      clearTimeout(grace);
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
      const { at, frame: natural, sticky } = motion.current;
      const rect = unionRect(boxElementsOf(element));
      if (!at || !natural || !rect) return;
      const last =
        sticky && at.kind === "scroller"
          ? {
              ...natural,
              y:
                natural.y +
                stickyShift(sticky, scrollOffsetOf(at.scroller).y, at.scroller.clientHeight),
            }
          : natural;
      if (moved(frameIn(at, rect, element.ownerDocument), last)) relayout();
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
