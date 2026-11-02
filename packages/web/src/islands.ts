import {
  NATIVE_PROTOCOL_VERSION,
  NativeComponentLimits,
  NativeOperationSchema,
  type TNativeAccessibility,
  type TNativeAnchor,
  type TNativeErrorReason,
  type TNativeFrame,
  type TNativeShade,
  type TNativeTransform,
  type TNativeSticky,
  type TNativeOperation,
  type TNativeProps,
  type TNativeSize,
} from "./schemas";
import {
  NativeComponentAckSchema,
  NativeComponentErrorSchema,
  NativeComponentEventSchema,
  NativeComponentReplySchema,
  NativeComponentRequestSchema,
  NativeComponentSizeSchema,
  NativeComponentStateSchema,
  type TToHostMessage,
} from "./messages";
import {
  nativeSupport,
  supportsAnchor,
  supportsFeature,
  type NativeCapabilityResult,
  type NativeSupport,
} from "./capability";

export const NATIVE_ACK_TIMEOUT_MS = 500;

export const NATIVE_FLUSH_FALLBACK_MS = 50;

export const NATIVE_COMMAND_TIMEOUT_MS = 5000;

export type NativeCommandFailure =
  | "unsupported"
  | "not_ready"
  | "invalid_args"
  | "timeout"
  | "rejected"
  | "unmounted";

export class NativeCommandError extends Error {
  readonly reason: NativeCommandFailure;

  constructor(reason: NativeCommandFailure, message: string) {
    super(message);
    this.name = "NativeCommandError";
    this.reason = reason;
  }
}

export type NativeIslandSpec = {
  component: string;
  version: number;
  props: Readonly<Record<string, unknown>>;
  frame: TNativeFrame;
  anchor: TNativeAnchor;
  visible: boolean;
  order: number;
  sizing: "web" | "native";
  accessibility?: TNativeAccessibility;
  /** Keeps the island stuck like its sticky box. Travels with `frame`. Default: not sticky. */
  sticky?: TNativeSticky;
  /** The part of the island to draw, in its own coordinates. Travels with `frame`. Default: all of it. */
  clip?: TNativeFrame;
  /** Parts of the island the page covers, cut out of it, in its own coordinates. Travels with `frame`. Default: none. */
  holes?: TNativeFrame[];
  /** See-through parts of the page laid over the island, in its own coordinates. Travels with `frame`. Default: none. */
  shades?: TNativeShade[];
  /** Turns the island about its frame's centre. Travels with `frame`. Default: not turned. */
  transform?: TNativeTransform;
  /** How opaque the island is drawn. Travels with `frame`. Default: `1`. */
  opacity?: number;
};

/**
 * What changed about an island. `sticky`, `clip` and `holes` belong to the
 * frame they come with: a patch with a `frame` and without them unsticks,
 * unclips and fills the holes.
 */
export type NativeIslandPatch = Partial<
  Pick<
    NativeIslandSpec,
    | "props"
    | "frame"
    | "anchor"
    | "visible"
    | "order"
    | "accessibility"
    | "sticky"
    | "clip"
    | "holes"
    | "shades"
    | "transform"
    | "opacity"
  >
>;

export type NativeFallbackReason = TNativeErrorReason | "invalid_spec";

export type NativeIslandListener = {
  onReady?: () => void;
  onPending?: () => void;
  onStall?: () => void;
  onFallback?: (reason: NativeFallbackReason, message?: string) => void;
  onEvent?: (name: string, payload: unknown) => void;
  onSize?: (size: TNativeSize) => void;
  onState?: (
    state: Readonly<Record<string, unknown>>,
    changed: Readonly<Record<string, unknown>>,
    revision: number,
  ) => void;
  onRequest?: (name: string, payload: unknown) => unknown;
  refresh?: () => NativeIslandPatch | undefined;
};

export type NativeMountRefusal =
  | Exclude<NativeSupport, "supported">
  | "unsupported_anchor"
  | "duplicate_id"
  | "limit_exceeded"
  | "invalid_spec";

export type NativeMountResult = { ok: true } | { ok: false; reason: NativeMountRefusal };

export type NativeIslandStatus = "pending" | "ready" | "stalled";

export type NativeScheduler = (flush: () => void) => void;

export type NativeIslandsOptions = {
  capability: NativeCapabilityResult;
  post: (message: TToHostMessage) => void;
  schedule?: NativeScheduler;
  ackTimeoutMs?: number;
  report?: (message: string, error?: unknown) => void;
};

export interface NativeIslands {
  readonly capability: NativeCapabilityResult;
  supports: (component: string, version: number) => NativeSupport;
  mount: (id: string, spec: NativeIslandSpec, listener?: NativeIslandListener) => NativeMountResult;
  update: (id: string, patch: NativeIslandPatch) => void;
  unmount: (id: string) => void;
  status: (id: string) => NativeIslandStatus | undefined;
  handle: (message: unknown) => boolean;
  flush: () => void;
  /**
   * Tells the host every island the page rendered is settled, so a host
   * holding the web view hidden reveals it. Sends pending operations first.
   * Only the first call per controller sends anything; returns whether it did.
   */
  announceReady: () => boolean;
  resync: () => void;
  retry: () => void;
  state: (id: string) => Readonly<Record<string, unknown>> | undefined;
  command: (
    id: string,
    name: string,
    args?: unknown,
    options?: { timeoutMs?: number },
  ) => Promise<unknown>;
}

type WireSpec = Omit<NativeIslandSpec, "props"> & { props: TNativeProps };

type Island = {
  spec: WireSpec;
  sent?: WireSpec;
  listener: NativeIslandListener;
  status: NativeIslandStatus;
  mountSequence?: number;
  timer?: ReturnType<typeof setTimeout>;
  state: Record<string, unknown>;
  revision: number;
};

type PendingCommand = {
  id: string;
  resolve: (value: unknown) => void;
  reject: (error: NativeCommandError) => void;
  timer: ReturnType<typeof setTimeout>;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const toJson = (
  value: unknown,
  seen: Set<unknown>,
): { ok: true; value: unknown } | { ok: false } => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return { ok: true, value };
  }
  if (typeof value === "number")
    return Number.isFinite(value) ? { ok: true, value } : { ok: false };
  if (typeof value !== "object" || seen.has(value)) return { ok: false };
  seen.add(value);
  if (Array.isArray(value)) {
    const items: unknown[] = [];
    for (const item of value) {
      const converted = toJson(item, seen);
      if (!converted.ok) return converted;
      items.push(converted.value);
    }
    seen.delete(value);
    return { ok: true, value: items };
  }
  if (!isPlainObject(value)) return { ok: false };
  const entries: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    const converted = toJson(item, seen);
    if (!converted.ok) return converted;
    entries[key] = converted.value;
  }
  seen.delete(value);
  return { ok: true, value: entries };
};

const jsonOf = (value: unknown): { ok: true; value: unknown } | { ok: false } =>
  value === undefined ? { ok: true, value: undefined } : toJson(value, new Set());

export const toNativeProps = (
  props: Readonly<Record<string, unknown>>,
): TNativeProps | undefined => {
  if (!isPlainObject(props)) return undefined;
  const converted = toJson(props, new Set());
  return converted.ok && isPlainObject(converted.value) ? converted.value : undefined;
};

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const defaultScheduler: NativeScheduler = (flush) => {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    flush();
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
  setTimeout(run, NATIVE_FLUSH_FALLBACK_MS);
};

const clearTimer = (island: Island) => {
  if (island.timer !== undefined) clearTimeout(island.timer);
  island.timer = undefined;
};

const parseOperation = (candidate: unknown): TNativeOperation | undefined => {
  const parsed = NativeOperationSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
};

const validOperation = (operation: TNativeOperation) => parseOperation(operation) !== undefined;

const validId = (id: string) => id.length > 0 && id.length <= NativeComponentLimits.maxIdLength;

const UPDATABLE = ["props", "frame", "anchor", "visible", "order", "accessibility"] as const;

const defaultReport = (message: string, error?: unknown) => {
  if (error === undefined) console.warn(message);
  else console.error(message, error);
};

const stale = (island: Island, sequence: number | undefined) =>
  sequence !== undefined && island.mountSequence !== undefined && sequence < island.mountSequence;

const wireOf = (island: Island): WireSpec =>
  island.status === "stalled" ? { ...island.spec, visible: false } : island.spec;

export const createNativeIslands = (options: NativeIslandsOptions): NativeIslands => {
  const { capability, post } = options;
  const schedule = options.schedule ?? defaultScheduler;
  const ackTimeoutMs = options.ackTimeoutMs ?? NATIVE_ACK_TIMEOUT_MS;
  const report = options.report ?? defaultReport;
  const islands = new Map<string, Island>();
  const unmounts = new Set<string>();
  const commands = new Map<string, PendingCommand>();
  let sequence = 0;
  let commandCount = 0;
  let scheduled = false;

  const requestFlush = () => {
    if (scheduled) return;
    scheduled = true;
    schedule(() => {
      scheduled = false;
      flush();
    });
  };

  const call = (id: string, run: () => void) => {
    try {
      run();
    } catch (error) {
      report(`A handler for native component ${JSON.stringify(id)} threw.`, error);
    }
  };

  const settleCommands = (id: string, message: string) => {
    for (const [requestId, pending] of commands) {
      if (pending.id !== id) continue;
      clearTimeout(pending.timer);
      commands.delete(requestId);
      pending.reject(new NativeCommandError("unmounted", message));
    }
  };

  const fail = (id: string, island: Island, reason: NativeFallbackReason, message?: string) => {
    clearTimer(island);
    settleCommands(id, `Native component ${JSON.stringify(id)} fell back to web.`);
    islands.delete(id);
    if (island.mountSequence !== undefined) {
      unmounts.add(id);
      requestFlush();
    }
    call(id, () => island.listener.onFallback?.(reason, message));
  };

  const stall = (id: string, island: Island) => {
    island.timer = undefined;
    island.status = "stalled";
    requestFlush();
    call(id, () => island.listener.onStall?.());
  };

  const anchorAllowed = (spec: WireSpec) => supportsAnchor(capability, spec.anchor.type);

  const operationsFor = (): TNativeOperation[] => {
    const operations: TNativeOperation[] = [];
    for (const id of unmounts) operations.push({ op: "unmount", id });
    unmounts.clear();
    for (const [id, island] of islands) {
      const spec = wireOf(island);
      const { sent } = island;
      if (!anchorAllowed(spec)) {
        fail(
          id,
          island,
          "anchor_not_found",
          `the host does not offer the ${spec.anchor.type} anchor`,
        );
        continue;
      }
      const revision = island.revision > 0 ? { state_revision: island.revision } : {};
      if (!sent) {
        const { accessibility, sticky, clip, holes, shades, transform, opacity, ...rest } = spec;
        const operation: TNativeOperation = {
          op: "mount",
          id,
          ...rest,
          ...(accessibility === undefined ? {} : { accessibility }),
          ...(sticky === undefined ? {} : { sticky }),
          ...(clip === undefined ? {} : { clip }),
          ...(holes === undefined ? {} : { holes }),
          ...(shades === undefined ? {} : { shades }),
          ...(transform === undefined ? {} : { transform }),
          ...(opacity === undefined ? {} : { opacity }),
          ...revision,
        };
        if (!validOperation(operation)) {
          fail(id, island, "invalid_spec");
          continue;
        }
        operations.push(operation);
        continue;
      }
      const changes: Record<string, unknown> = {};
      for (const key of UPDATABLE) {
        if (spec[key] !== undefined && !same(spec[key], sent[key])) changes[key] = spec[key];
      }
      if (
        !same(spec.sticky, sent.sticky) ||
        !same(spec.clip, sent.clip) ||
        !same(spec.holes, sent.holes) ||
        !same(spec.shades, sent.shades) ||
        !same(spec.transform, sent.transform) ||
        spec.opacity !== sent.opacity
      ) {
        changes.frame = spec.frame;
      }
      if ("frame" in changes) {
        if (spec.sticky !== undefined) changes.sticky = spec.sticky;
        if (spec.clip !== undefined) changes.clip = spec.clip;
        if (spec.holes !== undefined) changes.holes = spec.holes;
        if (spec.shades !== undefined) changes.shades = spec.shades;
        if (spec.transform !== undefined) changes.transform = spec.transform;
        if (spec.opacity !== undefined) changes.opacity = spec.opacity;
      }
      if (Object.keys(changes).length === 0) continue;
      const operation = parseOperation({
        op: "update",
        id,
        ...changes,
        ...("props" in changes ? revision : {}),
      });
      if (!operation) {
        fail(id, island, "invalid_spec");
        continue;
      }
      operations.push(operation);
    }
    return operations;
  };

  const flush = () => {
    const operations = operationsFor();
    for (
      let start = 0;
      start < operations.length;
      start += NativeComponentLimits.maxOperationsPerBatch
    ) {
      const chunk = operations.slice(start, start + NativeComponentLimits.maxOperationsPerBatch);
      sequence += 1;
      const batchSequence = sequence;
      for (const operation of chunk) {
        const island = islands.get(operation.id);
        if (!island || operation.op === "unmount") continue;
        island.sent = wireOf(island);
        if (operation.op !== "mount") continue;
        island.mountSequence = batchSequence;
        clearTimer(island);
        island.timer = setTimeout(() => stall(operation.id, island), ackTimeoutMs);
      }
      post({
        event_name: "native_component_batch",
        protocol: NATIVE_PROTOCOL_VERSION,
        sequence: batchSequence,
        operations: chunk,
      });
    }
  };

  let announced = false;
  const announceReady = () => {
    if (announced || capability.status !== "available") return false;
    announced = true;
    flush();
    post({ event_name: "native_islands_ready", sequence });
    return true;
  };

  const supports = (component: string, version: number) =>
    nativeSupport(capability, component, version);

  const mount: NativeIslands["mount"] = (id, spec, listener = {}) => {
    const support = supports(spec.component, spec.version);
    if (support !== "supported") return { ok: false, reason: support };
    if (!validId(id)) return { ok: false, reason: "invalid_spec" };
    if (!supportsAnchor(capability, spec.anchor.type)) {
      return { ok: false, reason: "unsupported_anchor" };
    }
    if (islands.has(id)) return { ok: false, reason: "duplicate_id" };
    if (islands.size >= NativeComponentLimits.maxIslands) {
      return { ok: false, reason: "limit_exceeded" };
    }
    const props = toNativeProps(spec.props);
    if (!props) return { ok: false, reason: "invalid_spec" };
    islands.set(id, {
      spec: { ...spec, props },
      listener,
      status: "pending",
      state: {},
      revision: 0,
    });
    requestFlush();
    return { ok: true };
  };

  const apply = (id: string, island: Island, patch: NativeIslandPatch) => {
    const { props: rawProps, ...rest } = patch;
    let props = island.spec.props;
    if (rawProps !== undefined) {
      const converted = toNativeProps(rawProps);
      if (!converted) {
        fail(id, island, "invalid_spec");
        return false;
      }
      props = converted;
    }
    const geometry =
      patch.frame === undefined
        ? {}
        : {
            sticky: patch.sticky,
            clip: patch.clip,
            holes: patch.holes,
            shades: patch.shades,
            transform: patch.transform,
            opacity: patch.opacity,
          };
    island.spec = { ...island.spec, ...rest, ...geometry, props };
    return true;
  };

  const update: NativeIslands["update"] = (id, patch) => {
    const island = islands.get(id);
    if (!island) return;
    if (apply(id, island, patch)) requestFlush();
  };

  const unmount: NativeIslands["unmount"] = (id) => {
    const island = islands.get(id);
    if (!island) return;
    clearTimer(island);
    settleCommands(id, `Native component ${JSON.stringify(id)} unmounted.`);
    islands.delete(id);
    if (island.mountSequence === undefined) return;
    unmounts.add(id);
    requestFlush();
  };

  const remount = (id: string, island: Island, hostMayHaveIt: boolean) => {
    clearTimer(island);
    let fresh: NativeIslandPatch | undefined;
    call(id, () => {
      fresh = island.listener.refresh?.();
    });
    if (fresh && !apply(id, island, fresh)) return;
    if (hostMayHaveIt && island.mountSequence !== undefined) unmounts.add(id);
    settleCommands(id, `Native component ${JSON.stringify(id)} is mounting again.`);
    island.revision = 0;
    island.sent = undefined;
    island.mountSequence = undefined;
    island.status = "pending";
    call(id, () => island.listener.onPending?.());
  };

  const acknowledge = (ackSequence: number, ids: readonly string[]) => {
    for (const id of ids) {
      const island = islands.get(id);
      if (!island || island.status === "ready" || island.mountSequence === undefined) continue;
      if (island.mountSequence > ackSequence) continue;
      clearTimer(island);
      const wasStalled = island.status === "stalled";
      island.status = "ready";
      if (wasStalled) requestFlush();
      call(id, () => island.listener.onReady?.());
    }
  };

  const resync = () => {
    unmounts.clear();
    for (const [id, island] of islands) remount(id, island, false);
    if (islands.size > 0) requestFlush();
  };

  const retry = () => {
    let any = false;
    for (const [id, island] of islands) {
      if (island.status !== "stalled") continue;
      remount(id, island, true);
      any = true;
    }
    if (any) requestFlush();
  };

  const parse = <T>(
    schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
    message: { event_name: string },
  ): T | undefined => {
    const parsed = schema.safeParse(message);
    if (parsed.success) return parsed.data;
    report(`Ignored a malformed ${message.event_name} message from the host.`);
    return undefined;
  };

  const respond = (
    id: string,
    requestId: string,
    result: { ok: true; value: unknown } | { ok: false; error: string },
  ) => {
    if (result.ok) {
      const converted = jsonOf(result.value);
      if (!converted.ok) {
        respond(id, requestId, { ok: false, error: "The page's answer is not JSON." });
        return;
      }
      post({
        event_name: "native_component_response",
        id,
        request_id: requestId,
        ok: true,
        ...(converted.value === undefined ? {} : { value: converted.value }),
      });
      return;
    }
    post({
      event_name: "native_component_response",
      id,
      request_id: requestId,
      ok: false,
      error: result.error,
    });
  };

  const answer = (
    id: string,
    requestId: string,
    name: string,
    payload: unknown,
    requestSequence: number | undefined,
  ) => {
    const island = islands.get(id);
    if (!island || island.status !== "ready" || stale(island, requestSequence)) {
      respond(id, requestId, {
        ok: false,
        error: `No live native component ${JSON.stringify(id)}.`,
      });
      return;
    }
    const handler = island.listener.onRequest;
    if (!handler) {
      respond(id, requestId, { ok: false, error: `No handler for ${JSON.stringify(name)}.` });
      return;
    }
    let pending: unknown;
    try {
      pending = handler(name, payload);
    } catch (error) {
      report(`A request handler for native component ${JSON.stringify(id)} threw.`, error);
      respond(id, requestId, { ok: false, error: String(error) });
      return;
    }
    Promise.resolve(pending).then(
      (value) => respond(id, requestId, { ok: true, value }),
      (error: unknown) => {
        report(`A request handler for native component ${JSON.stringify(id)} rejected.`, error);
        respond(id, requestId, { ok: false, error: String(error) });
      },
    );
  };

  const command: NativeIslands["command"] = (id, name, args, commandOptions = {}) => {
    if (!supportsFeature(capability, "commands")) {
      return Promise.reject(
        new NativeCommandError("unsupported", "The host does not take commands."),
      );
    }
    const island = islands.get(id);
    if (!island || island.status !== "ready") {
      return Promise.reject(
        new NativeCommandError(
          "not_ready",
          `Native component ${JSON.stringify(id)} is not showing.`,
        ),
      );
    }
    const converted = jsonOf(args);
    if (!converted.ok) {
      return Promise.reject(
        new NativeCommandError("invalid_args", "Command arguments must be JSON."),
      );
    }
    commandCount += 1;
    const requestId = `command-${commandCount}`;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        commands.delete(requestId);
        reject(
          new NativeCommandError("timeout", `The host did not answer ${JSON.stringify(name)}.`),
        );
      }, commandOptions.timeoutMs ?? NATIVE_COMMAND_TIMEOUT_MS);
      commands.set(requestId, { id, resolve, reject, timer });
      post({
        event_name: "native_component_command",
        id,
        request_id: requestId,
        name,
        ...(converted.value === undefined ? {} : { args: converted.value }),
      });
    });
  };

  const handle: NativeIslands["handle"] = (raw) => {
    if (typeof raw !== "object" || raw === null) return false;
    const eventName = "event_name" in raw ? raw.event_name : undefined;
    if (typeof eventName !== "string") return false;
    const named = { ...raw, event_name: eventName };
    switch (eventName) {
      case "native_component_ack": {
        const ack = parse(NativeComponentAckSchema, named);
        if (ack) acknowledge(ack.sequence, ack.ids);
        return true;
      }
      case "native_component_error": {
        const error = parse(NativeComponentErrorSchema, named);
        const island = error && islands.get(error.id);
        if (error && island && !stale(island, error.sequence)) {
          fail(error.id, island, error.reason, error.message);
        }
        return true;
      }
      case "native_component_event": {
        const event = parse(NativeComponentEventSchema, named);
        const island = event && islands.get(event.id);
        if (
          event &&
          island &&
          island.status === "ready" &&
          island.sent?.visible === true &&
          !stale(island, event.sequence)
        ) {
          call(event.id, () => island.listener.onEvent?.(event.name, event.payload));
        }
        return true;
      }
      case "native_component_size": {
        const size = parse(NativeComponentSizeSchema, named);
        const island = size && islands.get(size.id);
        if (size && island && !stale(island, size.sequence)) {
          call(size.id, () => island.listener.onSize?.(size.size));
        }
        return true;
      }
      case "native_component_state": {
        const incoming = parse(NativeComponentStateSchema, named);
        const island = incoming && islands.get(incoming.id);
        if (!incoming || !island || stale(island, incoming.sequence)) return true;
        if (incoming.revision <= island.revision) return true;
        island.revision = incoming.revision;
        island.state = incoming.replace
          ? { ...incoming.values }
          : { ...island.state, ...incoming.values };
        const state = island.state;
        call(incoming.id, () =>
          island.listener.onState?.(state, incoming.values, incoming.revision),
        );
        return true;
      }
      case "native_component_request": {
        const request = parse(NativeComponentRequestSchema, named);
        if (request)
          answer(request.id, request.request_id, request.name, request.payload, request.sequence);
        return true;
      }
      case "native_component_reply": {
        const reply = parse(NativeComponentReplySchema, named);
        const pending = reply && commands.get(reply.request_id);
        if (!reply || !pending) return true;
        clearTimeout(pending.timer);
        commands.delete(reply.request_id);
        if (reply.ok) pending.resolve(reply.value);
        else
          pending.reject(
            new NativeCommandError("rejected", reply.error ?? "The host refused the command."),
          );
        return true;
      }
      case "native_component_reset":
        resync();
        return true;
      default:
        return false;
    }
  };

  return {
    capability,
    supports,
    mount,
    update,
    unmount,
    status: (id) => islands.get(id)?.status,
    handle,
    flush,
    announceReady,
    resync,
    retry,
    state: (id) => islands.get(id)?.state,
    command,
  };
};
