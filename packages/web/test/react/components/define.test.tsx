import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  defineNativeComponent,
  type NativeComponentProps,
  type NativeValue,
  useNativeSupport,
} from "../../../src/react";
import {
  CloseButton,
  GlassButton,
  SegmentedControl,
  SystemSymbol,
  Toggle,
} from "../../support/components";
import { eventNameOf, isNativeValue } from "../../../src/react/components/define";
import {
  createWrapper,
  installCapability,
  mockLayout,
  rectAttribute,
  removeCapability,
  renderNative,
} from "../../support/react";

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

  it("types request and per-key state handlers as on… props, with no requests prop", () => {
    type Props = NativeComponentProps<{
      state: { value: number };
      requests: { validateEmail: { payload: { email: string }; result: { error?: string } } };
    }>;
    expectTypeOf<Props["onValueChange"]>().toEqualTypeOf<((next: number) => void) | undefined>();
    expectTypeOf<Props["onValidateEmail"]>().toEqualTypeOf<
      ((payload: { email: string }) => { error?: string } | Promise<{ error?: string }>) | undefined
    >();
    expectTypeOf<Props>().not.toHaveProperty("requests");
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

  it("keeps the web version, with a console error, when a prop is not JSON", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const Rating = defineNativeComponent<{ props: { value: number } }>("custom", { version: 2 });
    const view = renderNative(
      <Rating value={Number.NaN}>
        <span data-rect={rectAttribute(0, 0, 10, 10)}>web</span>
      </Rating>,
    );
    await view.nextFrame();
    expect(view.batches()).toEqual([]);
    expect(error).toHaveBeenCalledWith("<custom> is showing its web version: value is not JSON.");
  });

  it("keeps the web version, without throwing, when a prop refers to itself", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const Card = defineNativeComponent<{ props: { data: NativeValue } }>("custom", { version: 2 });
    const data: Record<string, unknown> = { a: 1 };
    data.self = data;
    const view = renderNative(
      <Card data={data as unknown as NativeValue}>
        <span data-rect={rectAttribute(0, 0, 10, 10)}>web</span>
      </Card>,
    );
    await view.nextFrame();
    expect(view.getByText("web")).toBeTruthy();
    expect(view.batches()).toEqual([]);
    expect(error).toHaveBeenCalledWith("<custom> is showing its web version: data is not JSON.");
  });
});

describe("isNativeValue", () => {
  it.each([
    ["a string", "a"],
    ["a boolean", false],
    ["a finite number", 2],
    ["null", null],
    ["an array of values", [1, "a", null, [true]]],
    ["a plain object", { a: 1, b: undefined, c: { d: ["e"] } }],
    ["an object with no prototype", Object.assign(Object.create(null), { a: 1 })],
    [
      "the same object twice",
      (() => {
        const shared = { a: 1 };
        return [shared, { b: shared }];
      })(),
    ],
  ])("accepts %s", (_, value) => {
    expect(isNativeValue(value)).toBe(true);
  });

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["undefined", undefined],
    ["a function", () => {}],
    ["a symbol", Symbol("a")],
    ["a bigint", 1n],
    ["a date", new Date(0)],
    ["a map", new Map()],
    ["an array holding a function", [() => {}]],
    ["an object holding NaN", { a: Number.NaN }],
    [
      "an object that refers to itself",
      (() => {
        const cycle: Record<string, unknown> = {};
        cycle.self = cycle;
        return cycle;
      })(),
    ],
    [
      "an array that holds itself",
      (() => {
        const cycle: unknown[] = [];
        cycle.push([cycle]);
        return cycle;
      })(),
    ],
  ])("refuses %s", (_, value) => {
    expect(isNativeValue(value)).toBe(false);
  });
});

describe("default components", () => {
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
