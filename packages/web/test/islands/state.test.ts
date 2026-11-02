import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToHostMessageSchema, type TToPageMessage, type TToHostMessage } from "../../src";
import {
  createNativeIslands,
  NATIVE_COMMAND_TIMEOUT_MS,
  NativeCommandError,
  readNativeCapability,
  supportsFeature,
  type NativeIslandListener,
  type NativeIslandSpec,
} from "../../src";

const spec: NativeIslandSpec = {
  component: "signupForm",
  version: 1,
  props: { plan: "annual" },
  frame: { x: 0, y: 0, width: 300, height: 400 },
  anchor: { type: "page" },
  visible: true,
  order: 0,
  sizing: "web",
};

const setup = (features: readonly string[] = ["state", "requests", "commands"]) => {
  const posted: TToHostMessage[] = [];
  const pending: Array<() => void> = [];
  const report = vi.fn();
  const islands = createNativeIslands({
    capability: readNativeCapability({ protocol: 1, components: { signupForm: 1 }, features }),
    post: (message) => {
      expect(ToHostMessageSchema.safeParse(message).success).toBe(true);
      posted.push(message);
    },
    schedule: (flush) => pending.push(flush),
    report,
  });
  const frame = () => {
    for (const flush of pending.splice(0)) flush();
  };
  const receive = (message: TToPageMessage) => islands.handle(message);
  const operations = () =>
    posted.flatMap((message) =>
      message.event_name === "native_component_batch" ? message.operations : [],
    );
  const of = <E extends TToHostMessage["event_name"]>(event: E) =>
    posted.filter(
      (message): message is Extract<TToHostMessage, { event_name: E }> =>
        message.event_name === event,
    );
  const ready = (listener: NativeIslandListener = {}, id = "signup") => {
    islands.mount(id, spec, listener);
    frame();
    const sequence = posted.filter(
      (message) => message.event_name === "native_component_batch",
    ).length;
    receive({ event_name: "native_component_ack", sequence, ids: [id] });
  };
  return { islands, posted, frame, receive, operations, of, ready, report };
};

const flushPromises = async () => {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("capability features", () => {
  it("keeps the features it knows and names the rest", () => {
    const result = readNativeCapability({
      protocol: 1,
      components: {},
      features: ["state", "telepathy"],
    });
    expect(supportsFeature(result, "state")).toBe(true);
    expect(supportsFeature(result, "commands")).toBe(false);
    expect(result.status === "available" && result.ignored).toEqual(['feature "telepathy"']);
    expect(supportsFeature(readNativeCapability(undefined), "state")).toBe(false);
    const bare = readNativeCapability({ protocol: 1, components: {} });
    expect(bare.status === "available" && bare.capability.features).toEqual([]);
  });
});

describe("native state", () => {
  it("merges state patches by revision and hands the whole state to the listener", () => {
    const { islands, receive, ready } = setup();
    const onState = vi.fn();
    ready({ onState });
    receive({
      event_name: "native_component_state",
      id: "signup",
      revision: 1,
      values: { email: "a" },
    });
    receive({
      event_name: "native_component_state",
      id: "signup",
      revision: 2,
      values: { agreed: true },
    });
    expect(onState).toHaveBeenLastCalledWith({ email: "a", agreed: true }, { agreed: true }, 2);
    expect(islands.state("signup")).toEqual({ email: "a", agreed: true });
  });

  it("replaces the state when the host says so", () => {
    const { islands, receive, ready } = setup();
    ready();
    receive({ event_name: "native_component_state", id: "signup", revision: 1, values: { a: 1 } });
    receive({
      event_name: "native_component_state",
      id: "signup",
      revision: 2,
      values: { b: 2 },
      replace: true,
    });
    expect(islands.state("signup")).toEqual({ b: 2 });
  });

  it("drops state that arrives out of order, for a stale mount or for an unknown island", () => {
    const { islands, receive, ready } = setup();
    const onState = vi.fn();
    ready({ onState });
    receive({ event_name: "native_component_state", id: "signup", revision: 3, values: { a: 3 } });
    receive({ event_name: "native_component_state", id: "signup", revision: 2, values: { a: 2 } });
    receive({
      event_name: "native_component_state",
      id: "signup",
      revision: 9,
      values: { a: 9 },
    });
    receive({ event_name: "native_component_state", id: "ghost", revision: 1, values: {} });
    receive({ event_name: "native_component_state", id: "signup", revision: 0, values: {} });
    expect(islands.state("signup")).toEqual({ a: 9 });
    expect(islands.state("ghost")).toBeUndefined();
    expect(onState).toHaveBeenCalledTimes(2);
  });

  it("tells the host which state revision each props update reflects", () => {
    const { islands, receive, ready, frame, operations } = setup();
    ready();
    expect(operations()[0]).not.toHaveProperty("state_revision");
    receive({ event_name: "native_component_state", id: "signup", revision: 4, values: { a: 1 } });
    islands.update("signup", { props: { plan: "monthly" } });
    frame();
    expect(operations().at(-1)).toEqual({
      op: "update",
      id: "signup",
      props: { plan: "monthly" },
      state_revision: 4,
    });
    islands.update("signup", { visible: false });
    frame();
    expect(operations().at(-1)).toEqual({ op: "update", id: "signup", visible: false });
  });

  it("starts revisions again after a reset, and mounts with the revision it has seen", () => {
    const { islands, receive, ready, frame, operations } = setup();
    ready();
    receive({ event_name: "native_component_state", id: "signup", revision: 4, values: { a: 1 } });
    receive({ event_name: "native_component_reset" });
    frame();
    expect(operations().at(-1)).toMatchObject({ op: "mount" });
    expect(operations().at(-1)).not.toHaveProperty("state_revision");
    receive({ event_name: "native_component_state", id: "signup", revision: 1, values: { b: 2 } });
    expect(islands.state("signup")).toEqual({ a: 1, b: 2 });
    islands.unmount("signup");
    islands.mount("signup", spec);
    receive({ event_name: "native_component_state", id: "signup", revision: 1, values: {} });
    frame();
    expect(operations().at(-1)).toMatchObject({ op: "mount", state_revision: 1 });
  });
});

describe("requests from native", () => {
  it("answers with what the web handler returns, sync or async", async () => {
    const { receive, ready, of } = setup();
    ready({
      onRequest: (name, payload) =>
        name === "validate"
          ? Promise.resolve({ valid: (payload as { email: string }).email.endsWith(".com") })
          : "pong",
    });
    receive({
      event_name: "native_component_request",
      id: "signup",
      request_id: "r1",
      name: "validate",
      payload: { email: "a@b.com" },
    });
    receive({
      event_name: "native_component_request",
      id: "signup",
      request_id: "r2",
      name: "ping",
    });
    await flushPromises();
    const answers = of("native_component_response").toSorted((left, right) =>
      left.request_id.localeCompare(right.request_id),
    );
    expect(answers).toEqual([
      {
        event_name: "native_component_response",
        id: "signup",
        request_id: "r1",
        ok: true,
        value: { valid: true },
      },
      {
        event_name: "native_component_response",
        id: "signup",
        request_id: "r2",
        ok: true,
        value: "pong",
      },
    ]);
  });

  it("answers ok without a value when the handler returns nothing", async () => {
    const { receive, ready, of } = setup();
    ready({ onRequest: () => undefined });
    receive({ event_name: "native_component_request", id: "signup", request_id: "r", name: "x" });
    await flushPromises();
    expect(of("native_component_response")).toEqual([
      { event_name: "native_component_response", id: "signup", request_id: "r", ok: true },
    ]);
  });

  it("answers with an error when nobody handles it, the handler fails, or the answer is not JSON", async () => {
    const { receive, ready, of, report } = setup();
    ready({}, "bare");
    ready(
      {
        onRequest: (name) => {
          if (name === "throws") throw new Error("boom");
          if (name === "rejects") return Promise.reject(new Error("nope"));
          return new Date();
        },
      },
      "signup",
    );
    receive({ event_name: "native_component_request", id: "bare", request_id: "a", name: "x" });
    receive({
      event_name: "native_component_request",
      id: "signup",
      request_id: "b",
      name: "throws",
    });
    receive({
      event_name: "native_component_request",
      id: "signup",
      request_id: "c",
      name: "rejects",
    });
    receive({
      event_name: "native_component_request",
      id: "signup",
      request_id: "d",
      name: "date",
    });
    receive({ event_name: "native_component_request", id: "ghost", request_id: "e", name: "x" });
    await flushPromises();
    const answers = Object.fromEntries(
      of("native_component_response").map((message) => [message.request_id, message]),
    );
    expect(answers.a).toMatchObject({ ok: false, error: 'No handler for "x".' });
    expect(answers.b).toMatchObject({ ok: false, error: "Error: boom" });
    expect(answers.c).toMatchObject({ ok: false, error: "Error: nope" });
    expect(answers.d).toMatchObject({ ok: false, error: "The page's answer is not JSON." });
    expect(answers.e).toMatchObject({ ok: false, error: 'No live native component "ghost".' });
    expect(report).toHaveBeenCalledTimes(2);
  });

  it("refuses requests for an island that is not acknowledged yet", async () => {
    const { islands, receive, of } = setup();
    islands.mount("signup", spec, { onRequest: () => "never" });
    receive({ event_name: "native_component_request", id: "signup", request_id: "r", name: "x" });
    await flushPromises();
    expect(of("native_component_response")[0]).toMatchObject({ ok: false });
  });
});

describe("commands to native", () => {
  it("resolves with the host's reply and rejects with its error", async () => {
    const { islands, receive, ready, of } = setup();
    ready();
    const focus = islands.command("signup", "focus", { field: "email" });
    const reset = islands.command("signup", "reset");
    const [sentFocus, sentReset] = of("native_component_command");
    expect(sentFocus).toEqual({
      event_name: "native_component_command",
      id: "signup",
      request_id: expect.any(String),
      name: "focus",
      args: { field: "email" },
    });
    expect(sentReset).not.toHaveProperty("args");
    receive({
      event_name: "native_component_reply",
      request_id: sentFocus?.request_id ?? "",
      ok: true,
      value: 1,
    });
    receive({
      event_name: "native_component_reply",
      request_id: sentReset?.request_id ?? "",
      ok: false,
    });
    await expect(focus).resolves.toBe(1);
    await expect(reset).rejects.toMatchObject({
      reason: "rejected",
      message: "The host refused the command.",
    });
    receive({ event_name: "native_component_reply", request_id: "unknown", ok: true });
  });

  it("passes the host's error message on", async () => {
    const { islands, receive, ready, of } = setup();
    ready();
    const scroll = islands.command("signup", "scrollTo");
    receive({
      event_name: "native_component_reply",
      request_id: of("native_component_command")[0]?.request_id ?? "",
      ok: false,
      error: "unknown command",
    });
    await expect(scroll).rejects.toThrow("unknown command");
  });

  it("rejects without sending when the host takes no commands, the island is not showing, or the arguments are not JSON", async () => {
    const without = setup(["state"]);
    without.ready();
    await expect(without.islands.command("signup", "focus")).rejects.toMatchObject({
      reason: "unsupported",
    });
    const { islands, of } = setup();
    islands.mount("signup", spec);
    await expect(islands.command("signup", "focus")).rejects.toMatchObject({ reason: "not_ready" });
    await expect(islands.command("ghost", "focus")).rejects.toBeInstanceOf(NativeCommandError);
    const ready = setup();
    ready.ready();
    await expect(
      ready.islands.command("signup", "focus", { at: new Date() }),
    ).rejects.toMatchObject({
      reason: "invalid_args",
    });
    expect(of("native_component_command")).toEqual([]);
  });

  it("times out when the host never answers", async () => {
    const { islands, ready } = setup();
    ready();
    const slow = islands.command("signup", "focus");
    const quick = islands.command("signup", "blur", undefined, { timeoutMs: 10 });
    vi.advanceTimersByTime(10);
    await expect(quick).rejects.toMatchObject({ reason: "timeout" });
    vi.advanceTimersByTime(NATIVE_COMMAND_TIMEOUT_MS);
    await expect(slow).rejects.toMatchObject({ reason: "timeout" });
  });

  it("rejects pending commands when the island unmounts, falls back or mounts again", async () => {
    const { islands, receive, ready } = setup();
    ready({}, "a");
    ready({}, "b");
    ready({}, "c");
    ready({}, "d");
    const unmounted = islands.command("a", "focus");
    const failed = islands.command("b", "focus");
    const reset = islands.command("c", "focus");
    const other = islands.command("d", "focus");
    islands.unmount("a");
    receive({ event_name: "native_component_error", id: "b", reason: "render_failed" });
    receive({ event_name: "native_component_reset" });
    await expect(unmounted).rejects.toMatchObject({ reason: "unmounted" });
    await expect(failed).rejects.toMatchObject({ reason: "unmounted" });
    await expect(reset).rejects.toMatchObject({ reason: "unmounted" });
    await expect(other).rejects.toMatchObject({ reason: "unmounted" });
  });
});
