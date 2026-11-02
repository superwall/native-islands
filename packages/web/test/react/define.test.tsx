import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  CloseButton,
  defineNativeComponent,
  GlassButton,
  SegmentedControl,
  SystemSymbol,
  Toggle,
  useNativeSupport,
} from "../../src/react";
import { eventNameOf } from "../../src/react/define";
import {
  createWrapper,
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
});

describe("defineNativeComponent", () => {
  it("names the component and its version", () => {
    const Rating = defineNativeComponent<{ props: { value: number } }>("rating", { version: 2 });
    expect(Rating.componentName).toBe("rating");
    expect(Rating.version).toBe(2);
    expect(Rating.displayName).toBe("Native(rating)");
    expect(defineNativeComponent("plain").version).toBe(1);
  });

  it("maps handler names to event names", () => {
    expect(eventNameOf("onPress")).toBe("press");
    expect(eventNameOf("onValueChange")).toBe("valueChange");
  });

  it("sends values as props, keeps handlers and reserved props out, and honours colour props", async () => {
    const Rating = defineNativeComponent<{
      props: { value: number; color: string; onboarding: boolean };
      events: { change: number };
    }>("custom", { version: 2, sizing: "native", colorProps: ["color"] });
    const onChange = vi.fn();
    const view = renderNative(
      <Rating
        value={3}
        color="red"
        onboarding
        onChange={onChange}
        islandId="rating"
        accessibility={{ label: "Rating" }}
      >
        <span data-rect={rectAttribute(0, 0, 10, 10)}>3 stars</span>
      </Rating>,
    );
    await view.nextFrame();
    expect(view.operations()[0]).toMatchObject({
      id: "rating",
      component: "custom",
      version: 2,
      sizing: "native",
      props: { value: 3, color: "rgb(255, 0, 0)", onboarding: true },
      accessibility: { label: "Rating" },
    });
    view.ackAll();
    view.send({ event_name: "native_component_event", id: "rating", name: "change", payload: 4 });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("treats a non-function on-prop as a value", async () => {
    const Banner = defineNativeComponent<{ props: { onboarding: string } }>("custom", {
      version: 2,
    });
    const view = renderNative(
      <Banner onboarding="step-1">
        <span data-rect={rectAttribute(0, 0, 10, 10)}>web</span>
      </Banner>,
    );
    await view.nextFrame();
    expect(view.operations()[0]).toMatchObject({ props: { onboarding: "step-1" } });
  });

  it("renders only the web version when native is off", async () => {
    const view = renderNative(
      <GlassButton title="Go" native={false}>
        <button type="button">Go</button>
      </GlassButton>,
    );
    await view.nextFrame();
    expect(view.batches()).toEqual([]);
  });
});

describe("built-in components", () => {
  it("use the names the host registers", () => {
    expect(
      [GlassButton, CloseButton, Toggle, SegmentedControl, SystemSymbol].map(
        (component) => component.componentName,
      ),
    ).toEqual(["glassButton", "closeButton", "toggle", "segmentedControl", "symbol"]);
  });

  it("send tint as a colour", async () => {
    const view = renderNative(
      <>
        <CloseButton tint="white">
          <button type="button" aria-label="Close" data-rect={rectAttribute(0, 0, 44, 44)} />
        </CloseButton>
        <SystemSymbol name="crown.fill" tint="#000">
          <span data-rect={rectAttribute(0, 60, 20, 20)}>♛</span>
        </SystemSymbol>
        <SegmentedControl segments={["Monthly", "Annual"]} selectedIndex={1}>
          <div data-rect={rectAttribute(0, 90, 200, 32)}>Monthly Annual</div>
        </SegmentedControl>
      </>,
    );
    await view.nextFrame();
    expect(
      view.operations().map((operation) => operation.op === "mount" && operation.props),
    ).toEqual([
      { tint: "rgb(255, 255, 255)" },
      { name: "crown.fill", tint: "rgb(0, 0, 0)" },
      { segments: ["Monthly", "Annual"], selectedIndex: 1 },
    ]);
  });
});

describe("useNativeSupport", () => {
  it("reports what the host offers", () => {
    const { result } = renderHook(
      () => [useNativeSupport("glassButton"), useNativeSupport("custom", 3), useNativeSupport("x")],
      { wrapper: createWrapper() },
    );
    expect(result.current).toEqual(["supported", "unsupported_version", "unknown_component"]);
  });

  it("is unavailable without a native host", () => {
    removeCapability();
    const { result } = renderHook(() => useNativeSupport("glassButton"), {
      wrapper: createWrapper(),
    });
    act(() => undefined);
    expect(result.current).toBe("unavailable");
  });
});
