import { act, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ISLAND_STYLE_ATTRIBUTE, NATIVE_ACK_TIMEOUT_MS } from "../../src";
import {
  GlassButton,
  NativeIslandsProvider,
  useNativeIslands,
  useNativeIslandsReady,
} from "../../src/react";
import { createReadiness } from "../../src/react/context";
import {
  fakeTransport,
  installCapability,
  mockLayout,
  rectAttribute,
  removeCapability,
  renderNative,
} from "./harness";

beforeEach(() => {
  mockLayout();
  installCapability();
});

afterEach(() => {
  removeCapability();
  vi.restoreAllMocks();
  document.head.querySelector(`style[${ISLAND_STYLE_ATTRIBUTE}]`)?.remove();
});

const Ready = ({ onReady }: { onReady: (ready: boolean) => void }) => {
  onReady(useNativeIslandsReady());
  return null;
};

describe("createReadiness", () => {
  it("counts each id once and tells listeners only when readiness flips", () => {
    const readiness = createReadiness();
    const listener = vi.fn();
    const stop = readiness.subscribe(listener);
    expect(readiness.ready()).toBe(true);
    readiness.begin("a");
    readiness.begin("a");
    readiness.begin("b");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(readiness.ready()).toBe(false);
    readiness.end("a");
    readiness.end("missing");
    expect(listener).toHaveBeenCalledTimes(1);
    readiness.end("b");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(readiness.ready()).toBe(true);
    stop();
    readiness.begin("c");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("useNativeIslandsReady", () => {
  it("is false while an island waits for its ack and true once the host draws it", async () => {
    const seen: boolean[] = [];
    const view = renderNative(
      <>
        <GlassButton title="Go">
          <button data-rect={rectAttribute(0, 0, 100, 44)}>Go</button>
        </GlassButton>
        <Ready onReady={(ready) => seen.push(ready)} />
      </>,
    );
    await view.nextFrame();
    expect(seen.at(-1)).toBe(false);
    view.ackAll();
    expect(seen.at(-1)).toBe(true);
  });

  it("does not wait for a component the host does not offer", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const seen: boolean[] = [];
    installCapability({ protocol: 1, components: { toggle: 1 } });
    const view = renderNative(
      <>
        <GlassButton title="Go">
          <button data-rect={rectAttribute(0, 0, 100, 44)}>Go</button>
        </GlassButton>
        <Ready onReady={(ready) => seen.push(ready)} />
      </>,
    );
    await view.nextFrame();
    expect(seen.every(Boolean)).toBe(true);
    expect(view.batches()).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      "<glassButton> is showing its web version: unknown_component.",
    );
  });

  it("stops waiting when the host does not answer in time", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const seen: boolean[] = [];
    const view = renderNative(
      <>
        <GlassButton title="Go">
          <button data-rect={rectAttribute(0, 0, 100, 44)}>Go</button>
        </GlassButton>
        <Ready onReady={(ready) => seen.push(ready)} />
      </>,
    );
    await view.nextFrame();
    expect(seen.at(-1)).toBe(false);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, NATIVE_ACK_TIMEOUT_MS + 50));
    });
    expect(seen.at(-1)).toBe(true);
  });

  it("waits again while the host re-mounts after a reset", async () => {
    const seen: boolean[] = [];
    const view = renderNative(
      <>
        <GlassButton title="Go">
          <button data-rect={rectAttribute(0, 0, 100, 44)}>Go</button>
        </GlassButton>
        <Ready onReady={(ready) => seen.push(ready)} />
      </>,
    );
    await view.nextFrame();
    view.ackAll();
    expect(seen.at(-1)).toBe(true);
    view.send({ event_name: "native_component_reset" });
    expect(seen.at(-1)).toBe(false);
  });

  it("stops waiting when the island unmounts first", async () => {
    const seen: boolean[] = [];
    const Toggleable = ({ show }: { show: boolean }) => (
      <>
        {show ? (
          <GlassButton title="Go">
            <button data-rect={rectAttribute(0, 0, 100, 44)}>Go</button>
          </GlassButton>
        ) : null}
        <Ready onReady={(ready) => seen.push(ready)} />
      </>
    );
    const view = renderNative(<Toggleable show />);
    await view.nextFrame();
    expect(seen.at(-1)).toBe(false);
    view.rerender(<Toggleable show={false} />);
    expect(seen.at(-1)).toBe(true);
  });

  it("stops waiting for an island with nothing to measure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const seen: boolean[] = [];
    const view = renderNative(
      <>
        <GlassButton title="Go">Go</GlassButton>
        <Ready onReady={(ready) => seen.push(ready)} />
      </>,
    );
    await view.nextFrame();
    expect(seen.at(-1)).toBe(true);
  });
});

describe("NativeIslandsProvider", () => {
  it("connects its own controller and disconnects it on unmount", () => {
    const stop = vi.fn();
    const transport = { post: vi.fn(() => true), listen: vi.fn(() => stop) };
    const view = render(
      <NativeIslandsProvider connect={{ transport }}>
        <span />
      </NativeIslandsProvider>,
    );
    expect(transport.listen).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    view.unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("keeps one controller for its whole life", () => {
    const { transport } = fakeTransport();
    const seen = new Set<unknown>();
    const Probe = () => {
      seen.add(useNativeIslands());
      return null;
    };
    const view = render(
      <NativeIslandsProvider connect={{ transport }}>
        <Probe />
      </NativeIslandsProvider>,
    );
    view.rerender(
      <NativeIslandsProvider connect={{ transport }}>
        <Probe />
      </NativeIslandsProvider>,
    );
    expect(seen.size).toBe(1);
  });

  it("adds the island styles to the document once", () => {
    const { transport } = fakeTransport();
    render(
      <>
        <NativeIslandsProvider connect={{ transport }} />
        <NativeIslandsProvider connect={{ transport }} />
      </>,
    );
    expect(document.head.querySelectorAll(`style[${ISLAND_STYLE_ATTRIBUTE}]`)).toHaveLength(1);
  });

  it("is required by the hooks", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useNativeIslands())).toThrow(
      "Native islands must be used within a NativeIslandsProvider.",
    );
  });
});
