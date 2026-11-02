import { describe, expect, it } from "vitest";
import {
  NATIVE_CAPABILITY_GLOBAL,
  NATIVE_MESSAGE_HANDLER,
  NATIVE_PROTOCOL_VERSION,
  NativeCapabilitySchema,
  NativeComponentLimits,
  ToHostMessageSchema,
  ToPageMessageSchema,
} from "../src";
import contract from "../../contract/contract.json";

const mount = {
  op: "mount",
  id: "cta",
  component: "glassButton",
  version: 1,
  props: { title: "Continue" },
  frame: { x: 0, y: 0, width: 100, height: 44 },
  anchor: { type: "page" },
  visible: true,
  order: 0,
  sizing: "web",
};

const batch = (operations: unknown[], extra: object = {}) => ({
  event_name: "native_component_batch",
  protocol: NATIVE_PROTOCOL_VERSION,
  sequence: 1,
  operations,
  ...extra,
});

const outgoingOk = (message: object) =>
  expect(ToHostMessageSchema.safeParse(message).success).toBe(true);
const outgoingRejects = (message: object) =>
  expect(ToHostMessageSchema.safeParse(message).success).toBe(false);
const incomingOk = (message: object) => expect(ToPageMessageSchema.parse(message)).toEqual(message);
const incomingRejects = (message: object) =>
  expect(ToPageMessageSchema.safeParse(message).success).toBe(false);

describe("the shared contract", () => {
  it("names the global and the message handler the host provides", () => {
    expect(NATIVE_CAPABILITY_GLOBAL).toBe("__NATIVE_ISLANDS__");
    expect(NATIVE_MESSAGE_HANDLER).toBe("nativeIslands");
  });

  it("parses every message the page sends exactly", () => {
    for (const message of contract.toHost) {
      expect(ToHostMessageSchema.parse(message)).toEqual(message);
    }
  });

  it("parses every message the host sends exactly", () => {
    for (const message of contract.toPage) incomingOk(message);
  });

  it("parses the capability the host injects", () => {
    expect(NativeCapabilitySchema.parse(contract.capability)).toEqual(contract.capability);
  });
});

describe("native_component_batch", () => {
  it("accepts mount, update and unmount, alone and together", () => {
    outgoingOk(batch([mount]));
    outgoingOk(batch([{ op: "update", id: "cta" }]));
    outgoingOk(batch([{ op: "update", id: "cta", order: 3, accessibility: { hidden: true } }]));
    outgoingOk(batch([{ op: "unmount", id: "cta" }]));
    outgoingOk(
      batch([mount, { op: "update", id: "cta", visible: false }, { op: "unmount", id: "x" }]),
    );
  });

  it("rejects an empty batch, an oversized batch and the wrong protocol", () => {
    outgoingRejects(batch([]));
    outgoingRejects(
      batch(
        Array.from({ length: NativeComponentLimits.maxOperationsPerBatch + 1 }, (_, index) => ({
          op: "unmount",
          id: `island-${index}`,
        })),
      ),
    );
    outgoingRejects(batch([mount], { protocol: 2 }));
    outgoingRejects(batch([mount], { sequence: 0 }));
    outgoingRejects(batch([mount], { sequence: 1.5 }));
  });

  it("rejects frames a native view cannot take", () => {
    for (const frame of [
      { x: 0, y: 0, width: -1, height: 10 },
      { x: Number.NaN, y: 0, width: 1, height: 1 },
      { x: 0, y: Number.POSITIVE_INFINITY, width: 1, height: 1 },
      { x: 0, y: 0, width: 1 },
    ]) {
      outgoingRejects(batch([{ ...mount, frame }]));
    }
  });

  it("rejects malformed ids, names, versions and anchors", () => {
    outgoingRejects(batch([{ ...mount, id: "" }]));
    outgoingRejects(batch([{ ...mount, id: "x".repeat(NativeComponentLimits.maxIdLength + 1) }]));
    outgoingRejects(batch([{ ...mount, component: "" }]));
    outgoingRejects(batch([{ ...mount, version: 0 }]));
    outgoingRejects(batch([{ ...mount, anchor: { type: "floating" } }]));
    outgoingRejects(batch([{ ...mount, anchor: { type: "scroller" } }]));
    outgoingRejects(batch([{ ...mount, sizing: "auto" }]));
    outgoingRejects(batch([{ ...mount, order: -1 }]));
    outgoingRejects(batch([{ op: "replace", id: "cta" }]));
  });
});

describe("messages from the host", () => {
  it("accepts an optional sequence on errors, sizes and events", () => {
    incomingOk({ event_name: "native_component_event", id: "a", name: "press", sequence: 3 });
    incomingOk({
      event_name: "native_component_error",
      id: "a",
      reason: "render_failed",
      sequence: 3,
    });
    incomingOk({
      event_name: "native_component_size",
      id: "a",
      size: { width: 1, height: 1 },
      sequence: 3,
    });
    incomingRejects({ event_name: "native_component_event", id: "a", name: "press", sequence: 0 });
  });

  it("accepts an event with or without a payload", () => {
    incomingOk({ event_name: "native_component_event", id: "a", name: "press" });
    incomingOk({ event_name: "native_component_event", id: "a", name: "change", payload: 3 });
    incomingRejects({ event_name: "native_component_event", id: "a", name: "" });
  });

  it("accepts every error reason and rejects others", () => {
    for (const reason of [
      "unknown_component",
      "unsupported_version",
      "invalid_props",
      "anchor_not_found",
      "render_failed",
      "limit_exceeded",
      "duplicate_id",
    ]) {
      incomingOk({ event_name: "native_component_error", id: "a", reason });
    }
    incomingRejects({ event_name: "native_component_error", id: "a", reason: "sad" });
  });

  it("rejects malformed acks and sizes", () => {
    incomingRejects({ event_name: "native_component_ack", sequence: 0, ids: [] });
    incomingRejects({ event_name: "native_component_ack", sequence: 1 });
    incomingRejects({
      event_name: "native_component_size",
      id: "a",
      size: { width: -2, height: 1 },
    });
  });
});

describe("native component state, requests and commands", () => {
  it("rejects messages from the other direction and unknown ones", () => {
    outgoingRejects({ event_name: "native_component_ack", sequence: 1, ids: [] });
    incomingRejects(batch([mount]));
    outgoingRejects({ event_name: "native_component_teleport" });
  });

  it("rejects state without a positive revision or with non-object values", () => {
    incomingRejects({ event_name: "native_component_state", id: "a", revision: 0, values: {} });
    incomingRejects({ event_name: "native_component_state", id: "a", revision: 1, values: [] });
    incomingRejects({ event_name: "native_component_state", id: "a", values: {} });
  });

  it("rejects requests and replies without a request id", () => {
    incomingRejects({ event_name: "native_component_request", id: "a", name: "validate" });
    incomingRejects({
      event_name: "native_component_request",
      id: "a",
      request_id: "",
      name: "validate",
    });
    incomingRejects({ event_name: "native_component_reply", ok: true });
  });

  it("rejects commands and responses the host could not route", () => {
    outgoingRejects({
      event_name: "native_component_command",
      id: "",
      request_id: "r",
      name: "focus",
    });
    outgoingRejects({ event_name: "native_component_command", id: "a", request_id: "r", name: "" });
    outgoingRejects({ event_name: "native_component_response", id: "a", request_id: "r" });
  });

  it("rejects a negative state revision on an update", () => {
    outgoingRejects(batch([{ op: "update", id: "a", state_revision: -1 }]));
  });
});

describe("NativeCapabilitySchema", () => {
  it("leaves entries it cannot judge to the reader, so newer hosts stay readable", () => {
    expect(
      NativeCapabilitySchema.safeParse({
        protocol: 3,
        components: { glassButton: "1", "": 1 },
        anchors: ["page", "sheet"],
      }).success,
    ).toBe(true);
  });

  it("accepts a capability without anchors", () => {
    expect(NativeCapabilitySchema.safeParse({ protocol: 1, components: {} }).success).toBe(true);
  });

  it("rejects malformed capabilities", () => {
    for (const value of [
      null,
      {},
      { protocol: 0, components: {} },
      { protocol: 1, components: [] },
      { protocol: 1, components: {}, anchors: "page" },
    ]) {
      expect(NativeCapabilitySchema.safeParse(value).success).toBe(false);
    }
  });
});
