import { act } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TToHostMessage } from "../../../src/protocol/messages";
import {
  defineNativeComponent,
  Native,
  NativeCommandError,
  type NativeHandle,
} from "../../../src/react";
import {
  installCapability,
  mockLayout,
  rectAttribute,
  removeCapability,
  renderNative,
} from "../../support/react";

const SignupForm = defineNativeComponent<{
  props: { plan: string };
  events: { submit: { email: string } };
  state: { email: string; agreed: boolean };
  requests: { validate: { payload: { email: string }; result: { valid: boolean } } };
  commands: { focus: { args: { field: string }; result: boolean } };
}>("custom", { version: 2 });

const responses = (outgoing: readonly TToHostMessage[]) =>
  outgoing.flatMap((message) =>
    message.event_name === "native_component_response" ? [message] : [],
  );

const commands = (outgoing: readonly TToHostMessage[]) =>
  outgoing.flatMap((message) =>
    message.event_name === "native_component_command" ? [message] : [],
  );

const settle = () =>
  act(async () => {
    for (let index = 0; index < 5; index += 1) await Promise.resolve();
  });

beforeEach(() => {
  mockLayout();
  installCapability();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  removeCapability();
  vi.restoreAllMocks();
});

const Form = (props: {
  onState?: (state: Partial<{ email: string; agreed: boolean }>) => void;
  onEmail?: (next: string) => void;
  onAgreed?: (next: boolean) => void;
  validate?: (payload: { email: string }) => { valid: boolean } | Promise<{ valid: boolean }>;
  handle?: React.Ref<
    NativeHandle<
      { focus: { args: { field: string }; result: boolean } },
      { email: string; agreed: boolean }
    >
  >;
  plan?: string;
}) => (
  <SignupForm
    islandId="signup"
    plan={props.plan ?? "annual"}
    onStateChange={props.onState}
    onEmailChange={props.onEmail}
    onAgreedChange={props.onAgreed}
    onValidate={props.validate}
    ref={props.handle}
  >
    <form data-rect={rectAttribute(0, 0, 360, 420)}>
      <input aria-label="Email" />
    </form>
  </SignupForm>
);

describe("state from native", () => {
  it("hands every change to onStateChange with the full state, and sends the revision back with new props", async () => {
    const onState = vi.fn();
    const view = renderNative(<Form onState={onState} />);
    await view.nextFrame();
    view.ackAll();
    view.send({
      event_name: "native_component_state",
      id: "signup",
      revision: 1,
      values: { email: "a" },
    });
    view.send({
      event_name: "native_component_state",
      id: "signup",
      revision: 2,
      values: { agreed: true },
    });
    expect(onState).toHaveBeenLastCalledWith({ email: "a", agreed: true }, { agreed: true });
    view.rerender(<Form onState={onState} plan="monthly" />);
    await view.nextFrame();
    expect(view.operations().at(-1)).toMatchObject({
      op: "update",
      props: { plan: "monthly" },
      state_revision: 2,
    });
  });

  it("calls each on<Key>Change with the new value of only the keys that changed, after onStateChange", async () => {
    const calls: string[] = [];
    const onState = vi.fn(() => calls.push("state"));
    const onEmail = vi.fn((next: string) => calls.push(`email:${next}`));
    const onAgreed = vi.fn();
    const view = renderNative(<Form onState={onState} onEmail={onEmail} onAgreed={onAgreed} />);
    await view.nextFrame();
    view.ackAll();
    view.send({
      event_name: "native_component_state",
      id: "signup",
      revision: 1,
      values: { email: "a" },
    });
    expect(calls).toEqual(["state", "email:a"]);
    expect(onAgreed).not.toHaveBeenCalled();
    view.send({
      event_name: "native_component_state",
      id: "signup",
      revision: 2,
      values: { agreed: false },
    });
    expect(onAgreed).toHaveBeenCalledWith(false);
    expect(onEmail).toHaveBeenCalledTimes(1);
  });

  it("calls the newest on<Key>Change after a rerender, without onStateChange", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = renderNative(<Form onEmail={first} />);
    await view.nextFrame();
    view.ackAll();
    view.rerender(<Form onEmail={second} />);
    view.send({
      event_name: "native_component_state",
      id: "signup",
      revision: 1,
      values: { email: "c" },
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("c");
  });

  it("lets a ref read the last state and works without a state handler", async () => {
    const handle =
      React.createRef<
        NativeHandle<
          { focus: { args: { field: string }; result: boolean } },
          { email: string; agreed: boolean }
        >
      >();
    const view = renderNative(<Form handle={handle} />);
    await view.nextFrame();
    view.ackAll();
    expect(handle.current?.state()).toEqual({});
    view.send({
      event_name: "native_component_state",
      id: "signup",
      revision: 1,
      values: { email: "b" },
    });
    expect(handle.current?.state()).toEqual({ email: "b" });
  });
});

describe("requests from native", () => {
  it("routes a request to its on<Request> prop and answers with what it returns", async () => {
    const validate = vi.fn(async ({ email }: { email: string }) => ({
      valid: email.includes("@"),
    }));
    const view = renderNative(<Form validate={validate} />);
    await view.nextFrame();
    view.ackAll();
    view.send({
      event_name: "native_component_request",
      id: "signup",
      request_id: "r1",
      name: "validate",
      payload: { email: "a@b.co" },
    });
    await settle();
    expect(validate).toHaveBeenCalledWith({ email: "a@b.co" });
    expect(responses(view.outgoing)).toEqual([
      {
        event_name: "native_component_response",
        id: "signup",
        request_id: "r1",
        ok: true,
        value: { valid: true },
      },
    ]);
  });

  it("refuses a request nobody handles, naming it", async () => {
    const view = renderNative(<Form />);
    await view.nextFrame();
    view.ackAll();
    view.send({
      event_name: "native_component_request",
      id: "signup",
      request_id: "r",
      name: "validate",
    });
    await settle();
    expect(responses(view.outgoing)[0]).toMatchObject({
      ok: false,
      error: 'Error: <custom> has no handler for the "validate" request.',
    });
  });

  it("refuses requests on a bare Native without onRequest", async () => {
    const view = renderNative(
      <Native component="custom" version={2} islandId="bare">
        <span data-rect={rectAttribute(0, 0, 10, 10)}>web</span>
      </Native>,
    );
    await view.nextFrame();
    view.ackAll();
    view.send({ event_name: "native_component_request", id: "bare", request_id: "r", name: "x" });
    await settle();
    expect(responses(view.outgoing)[0]).toMatchObject({
      ok: false,
      error: 'Error: <custom> has no handler for the "x" request.',
    });
  });
});

describe("commands to native", () => {
  it("sends typed commands through the ref and resolves with native's answer", async () => {
    const handle =
      React.createRef<
        NativeHandle<
          { focus: { args: { field: string }; result: boolean } },
          { email: string; agreed: boolean }
        >
      >();
    const view = renderNative(<Form handle={handle} />);
    await view.nextFrame();
    view.ackAll();
    let result: Promise<boolean> | undefined;
    act(() => {
      result = handle.current?.command("focus", { field: "email" });
    });
    const sent = commands(view.outgoing)[0];
    expect(sent).toMatchObject({ id: "signup", name: "focus", args: { field: "email" } });
    view.send({
      event_name: "native_component_reply",
      request_id: sent?.request_id ?? "",
      ok: true,
      value: true,
    });
    await expect(result).resolves.toBe(true);
  });

  it("rejects with a NativeCommandError before the view is showing", async () => {
    const handle = React.createRef<NativeHandle>();
    renderNative(
      <Native component="custom" version={2} ref={handle}>
        <span data-rect={rectAttribute(0, 0, 10, 10)}>web</span>
      </Native>,
    );
    await expect(handle.current?.command("focus")).rejects.toBeInstanceOf(NativeCommandError);
  });
});
