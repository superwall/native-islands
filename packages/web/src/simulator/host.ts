import {
  ISLAND_ID_ATTRIBUTE,
  SIMULATED_ISLAND_ATTRIBUTE,
  SIMULATOR_LAYER_ATTRIBUTE,
} from "../layout/attributes";
import { ToHostMessageSchema, type TToPageMessage } from "../protocol/messages";
import {
  NATIVE_CAPABILITY_GLOBAL,
  NATIVE_MESSAGE_HANDLER,
  NATIVE_PROTOCOL_VERSION,
  type TNativeAnchor,
  type TNativeFrame,
  type TNativeSticky,
  type TNativeMotion,
  type TNativeTransform,
  type TNativeOperation,
  type TNativeScroller,
  type TNativeSize,
} from "../protocol/schemas";
import { hostWindow, NATIVE_RECEIVER_GLOBAL } from "../bridge/transport";
import {
  boxElementsOf,
  contentBoxOf,
  isScroller,
  scrollOffsetOf,
  stickyShift,
  unionRect,
} from "../layout/measure";

export type NativeSimulatorOptions = {
  components?: Readonly<Record<string, number>>;
  sizes?: Readonly<Record<string, TNativeSize>>;
  failing?: readonly string[];
  silent?: readonly string[];
  latencyMs?: number;
  onCommand?: (island: SimulatedIsland, name: string, args: unknown) => unknown;
};

export type SimulatedIsland = {
  id: string;
  component: string;
  props: Readonly<Record<string, unknown>>;
  anchor: TNativeAnchor["type"];
  visible: boolean;
  element: HTMLElement;
  sequence: number;
  scroller?: HTMLElement;
  scrollerId?: string;
  frame: TNativeFrame;
  sticky?: TNativeSticky;
  clip?: TNativeFrame;
  transform?: TNativeTransform;
  opacity?: number;
  motion?: TNativeMotion;
  slide?: Animation;
};

export type SimulatedAlignment = {
  id: string;
  visible: boolean;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
};

export type NativeSimulator = {
  islands: () => SimulatedIsland[];
  press: (id: string, name?: string, payload?: unknown) => void;
  alignment: () => SimulatedAlignment[];
  setState: (id: string, values: Readonly<Record<string, unknown>>, replace?: boolean) => number;
  request: (
    id: string,
    name: string,
    payload?: unknown,
  ) => Promise<{ ok: boolean; value?: unknown; error?: string }>;
  commands: () => Array<{ id: string; name: string; args?: unknown }>;
  ready: () => boolean;
  uninstall: () => void;
};

export const SIMULATED_COMPONENTS: Readonly<Record<string, number>> = {
  glassButton: 1,
  closeButton: 1,
  toggle: 1,
  segmentedControl: 1,
  symbol: 1,
};

const SIMULATED_SIZES: Readonly<Record<string, TNativeSize>> = {
  toggle: { width: 51, height: 31 },
};

const MATCH_TOLERANCE = 1;

const near = (left: TNativeFrame, right: TNativeFrame) =>
  Math.abs(left.x - right.x) <= MATCH_TOLERANCE &&
  Math.abs(left.y - right.y) <= MATCH_TOLERANCE &&
  Math.abs(left.width - right.width) <= MATCH_TOLERANCE &&
  Math.abs(left.height - right.height) <= MATCH_TOLERANCE;

const labelOf = (component: string, props: Readonly<Record<string, unknown>>) => {
  const title = props.title ?? props.name;
  return typeof title === "string" ? `${component} · ${title}` : component;
};

const sameSlide = (left: TNativeMotion | undefined, right: TNativeMotion | undefined) =>
  JSON.stringify(left && { ...left, elapsed: 0 }) ===
  JSON.stringify(right && { ...right, elapsed: 0 });

/** Runs a slide the page sent on the outline, as the host runs it on a native view. */
const slide = (island: SimulatedIsland, motion: TNativeMotion | undefined) => {
  if (sameSlide(island.motion, motion)) return;
  island.motion = motion;
  island.slide?.cancel();
  island.slide = undefined;
  if (!motion || typeof island.element.animate !== "function") return;
  const animation = island.element.animate(
    motion.keyframes.map((frame, index) => {
      const easing = motion.easings?.[index];
      return {
        offset: frame.offset,
        translate: `${frame.x}px ${frame.y}px`,
        ...(easing ? { easing: `cubic-bezier(${easing.join(", ")})` } : {}),
      };
    }),
    { duration: motion.duration, fill: motion.fill ?? "none" },
  );
  animation.currentTime = Math.max(0, motion.elapsed);
  island.slide = animation;
};

const place = (
  island: SimulatedIsland,
  frame: TNativeFrame,
  sticky?: TNativeSticky,
  clip?: TNativeFrame,
  transform?: TNativeTransform,
  opacity?: number,
  motion?: TNativeMotion,
) => {
  island.frame = frame;
  island.sticky = sticky;
  island.clip = clip;
  island.transform = transform;
  island.opacity = opacity;
  relayOut(island);
  slide(island, motion);
};

const relayOut = (island: SimulatedIsland) => {
  const { scroller, frame, sticky, clip, transform } = island;
  let x = frame.x;
  let y = frame.y;
  if (scroller) {
    const origin = scrollOffsetOf(scroller);
    if (sticky) y += stickyShift(sticky, origin.y, scroller.clientHeight);
    x -= origin.x - scroller.scrollLeft;
    y -= origin.y - scroller.scrollTop;
  }
  Object.assign(island.element.style, {
    left: `${x}px`,
    top: `${y}px`,
    width: `${frame.width}px`,
    height: `${frame.height}px`,
    clipPath: clip
      ? `inset(${clip.y}px ${frame.width - clip.x - clip.width}px ${frame.height - clip.y - clip.height}px ${clip.x}px)`
      : "",
    transformOrigin: "50% 50%",
    transform: transform
      ? `matrix(${transform.a}, ${transform.b}, ${transform.c}, ${transform.d}, 0, 0)`
      : "",
  });
  if (island.visible) island.element.style.opacity = String(island.opacity ?? 1);
};

export const installNativeSimulator = (options: NativeSimulatorOptions = {}): NativeSimulator => {
  const global = hostWindow();
  const document = window.document;
  if (global.webkit?.messageHandlers?.[NATIVE_MESSAGE_HANDLER]) {
    throw new Error("A native host is already present; the simulator only runs in a browser.");
  }
  const components = options.components ?? SIMULATED_COMPONENTS;
  const sizes = { ...SIMULATED_SIZES, ...options.sizes };
  const failing = new Set(options.failing);
  const silent = new Set(options.silent);
  const islands = new Map<string, SimulatedIsland>();
  const followSticky = (event: Event) => {
    for (const island of islands.values()) {
      if (island.sticky && island.scroller === event.target) relayOut(island);
    }
  };
  document.addEventListener("scroll", followSticky, { capture: true, passive: true });
  const positioned = new Map<HTMLElement, string>();

  const layer = (position: "absolute" | "fixed") => {
    const element = document.createElement("div");
    element.setAttribute(SIMULATOR_LAYER_ATTRIBUTE, position);
    Object.assign(element.style, {
      position,
      left: "0",
      top: "0",
      width: "0",
      height: "0",
      overflow: "visible",
      pointerEvents: "none",
      zIndex: "2147483647",
    });
    document.body.appendChild(element);
    return element;
  };
  const pageLayer = layer("absolute");
  const screenLayer = layer("fixed");

  const revisions = new Map<string, number>();
  const requests = new Map<
    string,
    (answer: { ok: boolean; value?: unknown; error?: string }) => void
  >();
  const received: Array<{ id: string; name: string; args?: unknown }> = [];
  let requestCount = 0;

  const send = (message: TToPageMessage) => {
    const deliver = () => global[NATIVE_RECEIVER_GLOBAL]?.accept([message]);
    setTimeout(deliver, options.latencyMs ?? 0);
  };

  // The nearest scroller that matches. Two can match at one spot with the
  // same content, such as a screen opened straight onto with its tab's root
  // parked under it: of those, one that already holds another scroller's
  // islands is taken last.
  const scrollerFor = (scroller: TNativeScroller): HTMLElement | undefined => {
    const matches: Array<{ element: HTMLElement; distance: number }> = [];
    for (const candidate of document.querySelectorAll<HTMLElement>("*")) {
      if (candidate.hasAttribute(SIMULATOR_LAYER_ATTRIBUTE) || !isScroller(candidate)) continue;
      const box = contentBoxOf(candidate);
      const offset = scrollOffsetOf(candidate);
      const same =
        near(
          { ...offset, width: box.width, height: box.height },
          { ...scroller.scroll_offset, width: scroller.frame.width, height: scroller.frame.height },
        ) &&
        near(
          { x: 0, y: 0, width: candidate.scrollWidth, height: candidate.scrollHeight },
          { x: 0, y: 0, ...scroller.content_size },
        );
      if (!same) continue;
      const distance = Math.hypot(box.x - scroller.frame.x, box.y - scroller.frame.y);
      matches.push({ element: candidate, distance });
    }
    const nearest = Math.min(...matches.map((match) => match.distance));
    const tied = matches
      .filter((match) => match.distance <= nearest + 1)
      .map((match) => match.element);
    const claimed = (element: HTMLElement) =>
      [...islands.values()].some(
        (island) => island.scroller === element && island.scrollerId !== scroller.id,
      );
    return tied.find((element) => !claimed(element)) ?? tied[0];
  };

  const attach = (island: SimulatedIsland, anchor: TNativeAnchor): boolean => {
    if (anchor.type === "page") {
      island.scroller = undefined;
      island.scrollerId = undefined;
      pageLayer.appendChild(island.element);
      return true;
    }
    if (anchor.type === "screen") {
      island.scroller = undefined;
      island.scrollerId = undefined;
      screenLayer.appendChild(island.element);
      return true;
    }
    const scroller = scrollerFor(anchor.scroller);
    if (!scroller) return false;
    if (getComputedStyle(scroller).position === "static") {
      positioned.set(scroller, scroller.style.position);
      scroller.style.position = "relative";
    }
    island.scroller = scroller;
    island.scrollerId = anchor.scroller.id;
    scroller.appendChild(island.element);
    return true;
  };

  const show = (island: SimulatedIsland) => {
    island.element.style.opacity = island.visible ? String(island.opacity ?? 1) : "0";
    island.element.textContent = labelOf(island.component, island.props);
  };

  const remove = (id: string) => {
    islands.get(id)?.element.remove();
    islands.delete(id);
    revisions.delete(id);
  };

  const apply = (operation: TNativeOperation, acked: string[], sequence: number) => {
    if (operation.op === "unmount") {
      remove(operation.id);
      return;
    }
    if (operation.op === "mount") {
      const registered = components[operation.component];
      if (registered === undefined || registered < operation.version) {
        send({
          event_name: "native_component_error",
          id: operation.id,
          reason: registered === undefined ? "unknown_component" : "unsupported_version",
          sequence,
        });
        return;
      }
      if (failing.has(operation.component)) {
        send({
          event_name: "native_component_error",
          id: operation.id,
          reason: "render_failed",
          sequence,
        });
        return;
      }
      remove(operation.id);
      const element = document.createElement("div");
      element.setAttribute(SIMULATED_ISLAND_ATTRIBUTE, operation.id);
      Object.assign(element.style, {
        position: "absolute",
        boxSizing: "border-box",
        border: "2px solid #d63af9",
        background: "color-mix(in srgb, #d63af9 18%, transparent)",
        color: "#d63af9",
        font: "600 10px/1.2 ui-monospace, monospace",
        padding: "2px 4px",
        overflow: "hidden",
        pointerEvents: "none",
        transition: "opacity 120ms ease",
      });
      const island: SimulatedIsland = {
        id: operation.id,
        component: operation.component,
        props: operation.props,
        anchor: operation.anchor.type,
        visible: operation.visible,
        element,
        sequence,
        frame: operation.frame,
      };
      if (!attach(island, operation.anchor)) {
        send({
          event_name: "native_component_error",
          id: operation.id,
          reason: "anchor_not_found",
          sequence,
        });
        return;
      }
      islands.set(operation.id, island);
      place(
        island,
        operation.frame,
        operation.sticky,
        operation.clip,
        operation.transform,
        operation.opacity,
        operation.motion,
      );
      show(island);
      const size = operation.sizing === "native" ? sizes[operation.component] : undefined;
      if (size) send({ event_name: "native_component_size", id: operation.id, size, sequence });
      if (!silent.has(operation.component)) acked.push(operation.id);
      return;
    }
    const island = islands.get(operation.id);
    if (!island) return;
    if (operation.anchor && !attach(island, operation.anchor)) {
      remove(operation.id);
      send({
        event_name: "native_component_error",
        id: operation.id,
        reason: "anchor_not_found",
        sequence: island.sequence,
      });
      return;
    }
    if (operation.anchor) island.anchor = operation.anchor.type;
    if (operation.frame) {
      place(
        island,
        operation.frame,
        operation.sticky,
        operation.clip,
        operation.transform,
        operation.opacity,
        operation.motion,
      );
    }
    const echoed = operation.state_revision;
    const stale = echoed !== undefined && echoed < (revisions.get(operation.id) ?? 0);
    if (operation.props && !stale) island.props = operation.props;
    if (operation.visible !== undefined) island.visible = operation.visible;
    show(island);
  };

  let announced = false;
  const receive = (raw: unknown) => {
    const parsed = ToHostMessageSchema.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw);
    if (!parsed.success) {
      console.warn("The native simulator ignored a message it cannot read.", raw);
      return;
    }
    const message = parsed.data;
    if (message.event_name === "native_islands_ready") {
      announced = true;
      return;
    }
    if (message.event_name === "native_component_response") {
      const resolve = requests.get(message.request_id);
      requests.delete(message.request_id);
      resolve?.({
        ok: message.ok,
        ...(message.value === undefined ? {} : { value: message.value }),
        ...(message.error === undefined ? {} : { error: message.error }),
      });
      return;
    }
    if (message.event_name === "native_component_command") {
      received.push({
        id: message.id,
        name: message.name,
        ...(message.args === undefined ? {} : { args: message.args }),
      });
      const island = islands.get(message.id);
      let reply: TToPageMessage;
      try {
        if (!island) throw new Error(`no island ${message.id}`);
        const value = options.onCommand?.(island, message.name, message.args);
        reply = {
          event_name: "native_component_reply",
          request_id: message.request_id,
          ok: true,
          ...(value === undefined ? {} : { value }),
        };
      } catch (error) {
        reply = {
          event_name: "native_component_reply",
          request_id: message.request_id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
      send(reply);
      return;
    }
    const acked: string[] = [];
    for (const operation of message.operations) apply(operation, acked, message.sequence);
    if (acked.length > 0) {
      send({ event_name: "native_component_ack", sequence: message.sequence, ids: acked });
    }
  };

  const previousWebkit = global.webkit;
  global.webkit = {
    ...previousWebkit,
    messageHandlers: {
      ...previousWebkit?.messageHandlers,
      [NATIVE_MESSAGE_HANDLER]: { postMessage: receive },
    },
  };
  global[NATIVE_CAPABILITY_GLOBAL] = {
    protocol: NATIVE_PROTOCOL_VERSION,
    components: { ...components },
    anchors: ["page", "scroller", "screen"],
    features: ["state", "requests", "commands", "layered", "sticky", "clip", "transform", "motion"],
  };

  return {
    islands: () => [...islands.values()],
    ready: () => announced,
    press: (id, name = "press", payload) => {
      const island = islands.get(id);
      send({
        event_name: "native_component_event",
        id,
        name,
        ...(payload === undefined ? {} : { payload }),
        ...(island ? { sequence: island.sequence } : {}),
      });
    },
    setState: (id, values, replace = false) => {
      const revision = (revisions.get(id) ?? 0) + 1;
      revisions.set(id, revision);
      const island = islands.get(id);
      send({
        event_name: "native_component_state",
        id,
        revision,
        values: { ...values },
        ...(replace ? { replace } : {}),
        ...(island ? { sequence: island.sequence } : {}),
      });
      return revision;
    },
    request: (id, name, payload) => {
      requestCount += 1;
      const requestId = `simulated-${requestCount}`;
      const island = islands.get(id);
      return new Promise((resolve) => {
        requests.set(requestId, resolve);
        send({
          event_name: "native_component_request",
          id,
          request_id: requestId,
          name,
          ...(payload === undefined ? {} : { payload }),
          ...(island ? { sequence: island.sequence } : {}),
        });
      });
    },
    commands: () => [...received],
    alignment: () =>
      [...islands.values()].flatMap((island) => {
        const wrapper = [
          ...document.querySelectorAll<HTMLElement>(`[${ISLAND_ID_ATTRIBUTE}]`),
        ].find((candidate) => candidate.getAttribute(ISLAND_ID_ATTRIBUTE) === island.id);
        const web = wrapper && unionRect(boxElementsOf(wrapper));
        if (!web) return [];
        const drawn = island.element.getBoundingClientRect();
        return [
          {
            id: island.id,
            visible: island.visible,
            dx: drawn.left - web.x,
            dy: drawn.top - web.y,
            dw: drawn.width - web.width,
            dh: drawn.height - web.height,
          },
        ];
      }),
    uninstall: () => {
      document.removeEventListener("scroll", followSticky, { capture: true });
      for (const island of islands.values()) island.element.remove();
      for (const [scroller, position] of positioned) scroller.style.position = position;
      positioned.clear();
      pageLayer.remove();
      screenLayer.remove();
      islands.clear();
      global.webkit = previousWebkit;
      delete global[NATIVE_CAPABILITY_GLOBAL];
    },
  };
};
