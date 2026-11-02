import {
  ISLAND_ID_ATTRIBUTE,
  SIMULATED_ISLAND_ATTRIBUTE,
  SIMULATOR_LAYER_ATTRIBUTE,
} from "./attributes";
import { ToHostMessageSchema, type TToPageMessage } from "./messages";
import {
  NATIVE_CAPABILITY_GLOBAL,
  NATIVE_MESSAGE_HANDLER,
  NATIVE_PROTOCOL_VERSION,
  type TNativeAnchor,
  type TNativeFrame,
  type TNativeSticky,
  type TNativeTransform,
  type TNativeOperation,
  type TNativeScroller,
  type TNativeSize,
} from "./schemas";
import { NATIVE_RECEIVER_GLOBAL, type NativeIslandsReceiver } from "./transport";
import {
  boxElementsOf,
  contentBoxOf,
  isScroller,
  scrollOffsetOf,
  stickyShift,
  unionRect,
} from "./measure";

/** What the simulated host offers and how it misbehaves, for testing pages in a browser. */
export type NativeSimulatorOptions = {
  /** Registered components and their versions. Default: every built-in at version 1. */
  components?: Readonly<Record<string, number>>;
  /** The size a `sizing: "native"` component reports. Default: `toggle` is 51×31. */
  sizes?: Readonly<Record<string, TNativeSize>>;
  /** Components the host fails to render, answered with `render_failed`. Default: none. */
  failing?: readonly string[];
  /** Components the host never acknowledges, so the page stalls them. Default: none. */
  silent?: readonly string[];
  /** How long the host takes to answer, in ms. Default: `0`. */
  latencyMs?: number;
  /**
   * Answers the page's commands, as the app's native view would. Return a
   * value to reply with it, or throw to refuse. Default: every command succeeds
   * with no value.
   */
  onCommand?: (island: SimulatedIsland, name: string, args: unknown) => unknown;
};

/** One island as the simulated host drew it. */
export type SimulatedIsland = {
  /** The island's id, as the page sent it. */
  id: string;
  /** The registered component it draws. */
  component: string;
  /** The props it was last sent. */
  props: Readonly<Record<string, unknown>>;
  /** Where it is anchored. */
  anchor: TNativeAnchor["type"];
  /** Whether the page currently wants it shown. */
  visible: boolean;
  /** The outline drawn in its place. */
  element: HTMLElement;
  /** The batch that mounted it, sent back on its events, sizes and errors. */
  sequence: number;
  /** The scroller it is drawn in, for a `scroller` anchor. */
  scroller?: HTMLElement;
  /** Its frame as the page last sent it, unstuck. */
  frame?: TNativeFrame;
  /** The sticky box it follows, for a sticky island. */
  sticky?: TNativeSticky;
  /** The part of it drawn, in its own coordinates. */
  clip?: TNativeFrame;
  /** How it is turned about its centre. */
  transform?: TNativeTransform;
  /** How opaque it is drawn. */
  opacity?: number;
};

/** How far an island's drawn view sits from its web element, in CSS pixels. */
export type SimulatedAlignment = {
  /** The island's id. */
  id: string;
  /** Whether the page currently wants it shown. */
  visible: boolean;
  /** Horizontal offset of the drawn view from its web element. */
  dx: number;
  /** Vertical offset of the drawn view from its web element. */
  dy: number;
  /** Width difference between the drawn view and its web element. */
  dw: number;
  /** Height difference between the drawn view and its web element. */
  dh: number;
};

/** A simulated native host, returned by `installNativeSimulator`. */
export type NativeSimulator = {
  /** Every island the host has drawn. */
  islands: () => SimulatedIsland[];
  /** Sends an event as if the user used the native view. `name` defaults to `"press"`; `payload` to none. */
  press: (id: string, name?: string, payload?: unknown) => void;
  /** How far each drawn island sits from its web element. */
  alignment: () => SimulatedAlignment[];
  /** Reports native state as if the user changed it, merged unless `replace`. Returns the revision sent. */
  setState: (id: string, values: Readonly<Record<string, unknown>>, replace?: boolean) => number;
  /** Asks the page something, as native would, and resolves with its answer. */
  request: (
    id: string,
    name: string,
    payload?: unknown,
  ) => Promise<{ ok: boolean; value?: unknown; error?: string }>;
  /** Every command the page has sent, oldest first. */
  commands: () => Array<{ id: string; name: string; args?: unknown }>;
  /**
   * Whether the page announced that its islands are settled. Until then a real
   * host would keep the web view hidden; the simulator only records it.
   */
  ready: () => boolean;
  /** Removes the host, its drawings and `window.__NATIVE_ISLANDS__`. */
  uninstall: () => void;
};

/** The components the simulator registers when `components` is not given: every built-in at version 1. */
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

type Global = Window & {
  [NATIVE_CAPABILITY_GLOBAL]?: unknown;
  [NATIVE_RECEIVER_GLOBAL]?: NativeIslandsReceiver;
  webkit?: { messageHandlers?: Record<string, { postMessage: (message: unknown) => void }> };
};

const near = (left: TNativeFrame, right: TNativeFrame) =>
  Math.abs(left.x - right.x) <= MATCH_TOLERANCE &&
  Math.abs(left.y - right.y) <= MATCH_TOLERANCE &&
  Math.abs(left.width - right.width) <= MATCH_TOLERANCE &&
  Math.abs(left.height - right.height) <= MATCH_TOLERANCE;

const labelOf = (component: string, props: Readonly<Record<string, unknown>>) => {
  const title = props.title ?? props.name;
  return typeof title === "string" ? `${component} · ${title}` : component;
};

const place = (
  island: SimulatedIsland,
  frame: TNativeFrame,
  sticky?: TNativeSticky,
  clip?: TNativeFrame,
  transform?: TNativeTransform,
  opacity?: number,
) => {
  island.frame = frame;
  island.sticky = sticky;
  island.clip = clip;
  island.transform = transform;
  island.opacity = opacity;
  relayOut(island);
};

const relayOut = (island: SimulatedIsland) => {
  const { scroller, frame, sticky, clip, transform } = island;
  if (!frame) return;
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

/**
 * Installs a host in this window that draws every island as an outlined
 * overlay where the native view would be, so a page's islands can be checked
 * in any browser. Call it before the page connects to its host.
 */
export const installNativeSimulator = (options: NativeSimulatorOptions = {}): NativeSimulator => {
  const global = window as Global;
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

  const scrollerFor = (scroller: TNativeScroller): HTMLElement | undefined => {
    let best: HTMLElement | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
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
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    return best;
  };

  const attach = (island: SimulatedIsland, anchor: TNativeAnchor): boolean => {
    if (anchor.type === "page") {
      island.scroller = undefined;
      pageLayer.appendChild(island.element);
      return true;
    }
    if (anchor.type === "screen") {
      island.scroller = undefined;
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
    features: ["state", "requests", "commands", "layered", "sticky", "clip", "transform"],
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
