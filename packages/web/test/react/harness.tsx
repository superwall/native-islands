import { act, render } from "@testing-library/react";
import * as React from "react";
import { vi } from "vitest";
import {
  ISLAND_COMPONENT_ATTRIBUTE,
  NATIVE_CAPABILITY_GLOBAL,
  type NativeIslands,
  type NativeIslandsTransport,
  type TToHostMessage,
  type TToPageMessage,
} from "../../src";
import { connectNativeIslands } from "../../src/connect";
import { NativeIslandsProvider } from "../../src/react";

export type NativeBatch = Extract<TToHostMessage, { event_name: "native_component_batch" }>;

export const CAPABILITY = {
  protocol: 1,
  components: {
    glassButton: 1,
    closeButton: 1,
    toggle: 1,
    segmentedControl: 1,
    symbol: 1,
    custom: 2,
  },
  anchors: ["page", "scroller", "screen"],
  features: ["state", "requests", "commands"],
};

const globals = window as unknown as Record<string, unknown>;

export const installCapability = (capability: unknown = CAPABILITY) => {
  globals[NATIVE_CAPABILITY_GLOBAL] = capability;
};

export const removeCapability = () => {
  delete globals[NATIVE_CAPABILITY_GLOBAL];
};

export const rectAttribute = (x: number, y: number, width: number, height: number) =>
  `${x},${y},${width},${height}`;

export const mockLayout = () =>
  vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      const [x = 0, y = 0, width = 0, height = 0] = (this.dataset.rect ?? "0,0,0,0")
        .split(",")
        .map(Number);
      return {
        x,
        y,
        width,
        height,
        left: x,
        top: y,
        right: x + width,
        bottom: y + height,
        toJSON: () => ({}),
      } as DOMRect;
    });

export const fakeTransport = () => {
  const outgoing: TToHostMessage[] = [];
  let receive: ((message: unknown) => void) | undefined;
  const transport: NativeIslandsTransport = {
    post: (message) => {
      outgoing.push(message);
      return true;
    },
    listen: (handler) => {
      receive = handler;
      return () => {
        receive = undefined;
      };
    },
  };
  return { outgoing, transport, deliver: (message: unknown) => receive?.(message) };
};

export const createWrapper = () => {
  const { transport } = fakeTransport();
  return ({ children }: React.PropsWithChildren) => (
    <NativeIslandsProvider connect={{ transport }}>{children}</NativeIslandsProvider>
  );
};

export const renderNative = (ui: React.ReactElement) => {
  const { outgoing, transport, deliver } = fakeTransport();
  let controller: NativeIslands | undefined;
  const connection = () => {
    const connected = connectNativeIslands({ transport });
    controller = connected.islands;
    return connected.islands;
  };
  const islands = connection();
  const wrap = (node: React.ReactElement) => (
    <NativeIslandsProvider islands={islands}>{node}</NativeIslandsProvider>
  );
  const view = render(wrap(ui));
  const batches = () =>
    outgoing.filter(
      (message): message is NativeBatch => message.event_name === "native_component_batch",
    );
  const operations = () => batches().flatMap((batch) => batch.operations);
  const send = (message: TToPageMessage) =>
    act(() => {
      deliver(message);
    });
  const ackAll = () => {
    for (const batch of batches()) {
      const ids = batch.operations.flatMap((operation) =>
        operation.op === "mount" ? [operation.id] : [],
      );
      if (ids.length > 0)
        send({ event_name: "native_component_ack", sequence: batch.sequence, ids });
    }
  };
  const nextFrame = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      controller?.flush();
    });
  return {
    ...view,
    rerender: (node: React.ReactElement) => view.rerender(wrap(node)),
    outgoing,
    islands,
    batches,
    operations,
    send,
    ackAll,
    nextFrame,
  };
};

export const islandOf = (container: HTMLElement, component = "glassButton") =>
  container.querySelector(`[${ISLAND_COMPONENT_ATTRIBUTE}="${component}"]`) as HTMLElement;

let overrides = new WeakMap<Element, Record<string, string>>();
let styleSpy: unknown;

export const overrideStyle = (element: Element, values: Record<string, string>) => {
  overrides.set(element, { ...overrides.get(element), ...values });
  if (styleSpy) return;
  const original = window.getComputedStyle.bind(window);
  styleSpy = vi.spyOn(window, "getComputedStyle").mockImplementation((target, pseudo) => {
    const style = original(target, pseudo);
    const extra = overrides.get(target);
    if (!extra) return style;
    return new Proxy(style, {
      get: (base, key) => {
        if (typeof key === "string" && key in extra) return extra[key];
        const value = Reflect.get(base, key, base);
        return typeof value === "function" ? value.bind(base) : value;
      },
    });
  });
};

export const resetStyleOverrides = () => {
  overrides = new WeakMap();
  styleSpy = undefined;
};

export const setScrollGeometry = (
  element: HTMLElement,
  geometry: Partial<
    Record<
      | "scrollTop"
      | "scrollLeft"
      | "scrollHeight"
      | "scrollWidth"
      | "clientHeight"
      | "clientWidth"
      | "clientTop"
      | "clientLeft",
      number
    >
  >,
) => {
  for (const [key, value] of Object.entries(geometry)) {
    Object.defineProperty(element, key, { value, configurable: true, writable: true });
  }
};
