import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { Gauge, SymbolEffect, SystemSymbol } from "../../src/components";
import { removeCapability } from "../support/react";
import { installComponents, mountComponent } from "./support";

beforeEach(installComponents);

afterEach(() => {
  removeCapability();
  vi.restoreAllMocks();
});

describe("SystemSymbol", () => {
  it("sends the symbol and shows the page's drawing on the web", async () => {
    const view = await mountComponent(
      <SystemSymbol name="star.fill" tint="red" weight="bold" pointSize={24}>
        <svg data-testid="star" />
      </SystemSymbol>,
    );
    expect(view.mount).toMatchObject({
      component: "symbol",
      props: { name: "star.fill", tint: "rgb(255, 0, 0)", weight: "bold", pointSize: 24 },
    });
    const web = screen.getByTestId("star").parentElement;
    expect(web?.className).toBe("ni-symbol");
    expect(web?.style.getPropertyValue("--ni-tint")).toBe("red");
  });
});

describe("SymbolEffect", () => {
  it("sends the effect and plays it again on the web when the trigger changes", async () => {
    const view = await mountComponent(
      <SymbolEffect name="bell" effect="bounce" trigger={1} active={false} pointSize={56}>
        <svg data-testid="bell" />
      </SymbolEffect>,
    );
    expect(view.mount).toMatchObject({
      component: "symbolEffect",
      props: { name: "bell", effect: "bounce", trigger: 1, active: false, pointSize: 56 },
    });
    const first = screen.getByTestId("bell").parentElement;
    expect(first?.dataset.effect).toBe("bounce");
    expect(first?.dataset.active).toBeUndefined();
    view.rerender(
      <SymbolEffect name="bell" effect="pulse" trigger={2} active>
        <svg data-testid="bell" />
      </SymbolEffect>,
    );
    const second = screen.getByTestId("bell").parentElement;
    expect(second).not.toBe(first);
    expect(second?.dataset.active).toBe("");
  });
});

describe("Gauge", () => {
  it("sends its value and labels, and draws a circular gauge on the web", async () => {
    const view = await mountComponent(
      <Gauge
        label="Battery"
        value={0.72}
        style="circular"
        valueLabel="72%"
        minimumLabel="0"
        maximumLabel="100"
        tint="green"
      />,
    );
    expect(view.mount).toMatchObject({
      component: "gauge",
      props: { value: 0.72, style: "circular", label: "72%", minimumLabel: "0" },
      accessibility: { label: "Battery", value: "72%" },
    });
    expect(screen.getByText("72%").className).toBe("ni-gauge-label");
    expect(view.container.querySelector(".ni-gauge-ends")?.textContent).toBe("0100");
    expect(view.container.querySelector(".ni-gauge-value")?.getAttribute("d")).toContain("A 32 32");
  });

  it("draws a capacity ring without end labels", async () => {
    const view = await mountComponent(<Gauge label="Storage" value={1} style="capacity" />);
    expect(view.container.querySelector(".ni-gauge-ends")).toBeNull();
    expect(
      view.container.querySelector(".ni-gauge-value")?.getAttribute("d")?.match(/A /g),
    ).toHaveLength(2);
  });

  it("draws a linear gauge with its end labels, and a bar without", async () => {
    const view = await mountComponent(
      <Gauge label="Progress" value={1.5} style="linear" minimumLabel="Start" maximumLabel="End" />,
    );
    const linear = view.container.querySelector(".ni-gauge-linear");
    expect(linear?.textContent).toBe("StartEnd");
    expect(view.container.querySelector<HTMLElement>(".ni-gauge-fill")?.style.width).toBe("100%");
    view.rerender(<Gauge label="Progress" value={0.25} style="bar" minimumLabel="Start" />);
    expect(view.container.querySelector(".ni-gauge-linear")?.textContent).toBe("");
    expect(view.container.querySelector<HTMLElement>(".ni-gauge-fill")?.style.width).toBe("25%");
  });

  it("is a spinner, takes its own web version and its own accessibility", async () => {
    await mountComponent(<Gauge label="Loading" value={0} style="spinner" />);
    expect(screen.getByRole("progressbar")).toBeTruthy();
    const own = await mountComponent(
      <Gauge label="Loading" value={0} style="spinner" accessibility={{ label: "Busy" }}>
        <span>Own</span>
      </Gauge>,
    );
    expect(own.mount.accessibility).toMatchObject({ label: "Busy" });
  });
});
