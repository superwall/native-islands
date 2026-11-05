import type * as React from "react";
import { vi } from "vitest";
import { CAPABILITY, installCapability, renderNative } from "../support/react";

export const COMPONENTS = {
  glassButton: 1,
  closeButton: 1,
  menu: 1,
  toggle: 1,
  segmentedControl: 1,
  slider: 1,
  stepper: 1,
  picker: 1,
  datePicker: 1,
  colorPicker: 1,
  textField: 1,
  symbol: 1,
  symbolEffect: 1,
  gauge: 1,
  chart: 1,
  video: 1,
  photoPicker: 1,
  shareButton: 1,
  hapticButton: 1,
  tip: 1,
  map: 1,
  camera: 1,
  permission: 1,
};

/** A host that registered every component of the four Swift libraries. */
export const installComponents = () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(20, 40, 120, 44),
  );
  installCapability({ ...CAPABILITY, components: COMPONENTS });
};

/** Renders `ui` and returns the first island it mounted, with ways to talk back to it. */
export const mountComponent = async (ui: React.ReactElement) => {
  const view = renderNative(ui);
  await view.nextFrame();
  const mount = view.operations().find((operation) => operation.op === "mount");
  if (mount?.op !== "mount") throw new Error("Nothing was mounted.");
  view.ackAll();
  await view.nextFrame();
  let revision = 0;
  return {
    ...view,
    mount,
    event: (name: string, payload?: unknown) =>
      view.send({ event_name: "native_component_event", id: mount.id, name, payload }),
    state: (values: Record<string, unknown>) => {
      revision += 1;
      return view.send({ event_name: "native_component_state", id: mount.id, revision, values });
    },
  };
};

type Outgoing = { event_name: string; request_id?: string; name?: string };

/** Answers the last command the page sent, by name, as the host would. */
export const replyTo = async (
  view: { outgoing: readonly Outgoing[]; send: (message: never) => Promise<void> | void },
  name: string,
  reply: { ok: true; value?: unknown } | { ok: false; error: string },
) => {
  const command = view.outgoing.findLast(
    (message) => message.event_name === "native_component_command" && message.name === name,
  );
  if (!command?.request_id) throw new Error(`No ${name} command was sent.`);
  await view.send({
    event_name: "native_component_reply",
    request_id: command.request_id,
    ...reply,
  } as never);
};
