import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { Chart, type ChartSeries } from "../../src/components";
import { chartXs, describeX, linePath, selectionAt } from "../../src/components/chart";
import type * as React from "react";
import { removeCapability, renderNative } from "../support/react";
import { installComponents, mountComponent } from "./support";

beforeEach(() => {
  installComponents();
  // jsdom has no PointerEvent; a MouseEvent carries the same position and buttons.
  vi.stubGlobal("PointerEvent", MouseEvent);
  Object.assign(SVGElement.prototype, { setPointerCapture: vi.fn() });
  vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(20, 40, 120, 200),
  );
});

afterEach(() => {
  removeCapability();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const WEEK: ChartSeries[] = [
  {
    id: "run",
    name: "Running",
    points: [
      { x: "Mon", y: 4 },
      { x: "Tue", y: 6 },
    ],
  },
  {
    id: "ride",
    name: "Cycling",
    color: "#ff9500",
    points: [
      { x: "Mon", y: 10 },
      { x: "Wed", y: 3 },
    ],
  },
];

const scrubTo = (svg: Element, clientX: number) => {
  fireEvent.pointerDown(svg, { clientX, pointerId: 1 });
  fireEvent.pointerMove(svg, { clientX, buttons: 1 });
  fireEvent.pointerMove(svg, { clientX, buttons: 0 });
};

describe("Chart", () => {
  it("sends its series, axes and look natively, and reports the scrubbed x", async () => {
    const onSelect = vi.fn();
    const view = await mountComponent(
      <Chart
        series={WEEK}
        kind="bar"
        xAxis={{ type: "category", title: "Day" }}
        yAxis={{ title: "km", format: "number" }}
        stacked
        tint="red"
        onSelect={onSelect}
      />,
    );
    expect(view.mount).toMatchObject({
      component: "chart",
      props: { series: WEEK, kind: "bar", stacked: true, tint: "rgb(255, 0, 0)" },
      accessibility: { label: "Chart" },
    });
    view.event("select", { x: "Mon", values: [{ series: "run", y: 4 }] });
    expect(onSelect).toHaveBeenCalledWith({ x: "Mon", values: [{ series: "run", y: 4 }] });
  });
});

describe("the chart's web version", () => {
  const renderWeb = (ui: React.ReactElement) => {
    removeCapability();
    return renderNative(ui);
  };

  it("draws grouped bars with a legend and scrubs to the x under the finger", async () => {
    const onSelect = vi.fn();
    const view = renderWeb(<Chart series={WEEK} tint="blue" onSelect={onSelect} />);
    const svg = view.container.querySelector("svg");
    if (!svg) throw new Error("No chart was drawn.");
    expect(view.container.querySelectorAll(".ni-chart-bar")).toHaveLength(4);
    expect(view.container.querySelector(".ni-chart-legend")?.textContent).toBe("RunningCycling");
    const bars = [...view.container.querySelectorAll(".ni-chart-bar")];
    expect(bars.map((bar) => bar.getAttribute("fill"))).toEqual([
      "var(--ni-tint, var(--ni-accent))",
      "#ff9500",
      "var(--ni-tint, var(--ni-accent))",
      "#ff9500",
    ]);
    scrubTo(svg, 30);
    expect(onSelect).toHaveBeenLastCalledWith({
      x: "Mon",
      values: [
        { series: "run", y: 4 },
        { series: "ride", y: 10 },
      ],
    });
    expect(view.container.querySelectorAll(".ni-chart-bar[data-dimmed]")).toHaveLength(2);
    expect(view.container.querySelector(".ni-chart-rule")).not.toBeNull();
    fireEvent.pointerUp(svg);
    expect(onSelect).toHaveBeenLastCalledWith({ x: null, values: [] });
    fireEvent.pointerDown(svg, { clientX: 30, pointerId: 1 });
    fireEvent.pointerCancel(svg);
    expect(onSelect).toHaveBeenLastCalledWith({ x: null, values: [] });
  });

  it("stacks bars and keeps to the y axis it is given", async () => {
    const view = renderWeb(
      <Chart series={WEEK} stacked legend={false} yAxis={{ min: 0, max: 20 }} />,
    );
    const heights = [...view.container.querySelectorAll(".ni-chart-bar")].map((bar) =>
      Math.round(Number(bar.getAttribute("height"))),
    );
    expect(heights).toEqual([36, 90, 54, 27]);
    expect(view.container.querySelector(".ni-chart-legend")).toBeNull();
  });

  it("draws lines, areas and points per series, smooth or straight", async () => {
    const view = renderWeb(
      <Chart
        kind="line"
        smooth={false}
        series={[
          {
            id: "a",
            points: [
              { x: 1, y: 1 },
              { x: 3, y: 2 },
            ],
          },
          { id: "b", kind: "area", points: [{ x: 2, y: 2 }] },
          { id: "c", kind: "point", points: [{ x: 3, y: 1 }] },
          { id: "d", kind: "area", points: [] },
        ]}
        xAxis={{ type: "number" }}
      />,
    );
    expect(view.container.querySelectorAll("[data-series]")).toHaveLength(4);
    expect(view.container.querySelectorAll(".ni-chart-area")).toHaveLength(1);
    expect(view.container.querySelectorAll(".ni-chart-dot")).toHaveLength(3);
    expect(
      view.container.querySelector('[data-series="a"] .ni-chart-line')?.getAttribute("d"),
    ).toMatch(/^M [\d.]+ [\d.]+ L/);
    expect(
      [...view.container.querySelectorAll(".ni-chart-label")].map((label) => label.textContent),
    ).toEqual(["1", "2", "3"]);
  });

  it("takes its own web version instead", async () => {
    const view = renderWeb(
      <Chart series={WEEK}>
        <p>Weekly totals</p>
      </Chart>,
    );
    expect(view.container.textContent).toBe("Weekly totals");
  });
});

describe("chart helpers", () => {
  it("orders x values by axis type", () => {
    const series: ChartSeries[] = [
      {
        id: "a",
        points: [
          { x: 3, y: 0 },
          { x: 1, y: 0 },
        ],
      },
      {
        id: "b",
        points: [
          { x: 2, y: 0 },
          { x: 1, y: 0 },
        ],
      },
    ];
    expect(chartXs(series, "category")).toEqual([3, 1, 2]);
    expect(chartXs(series, "number")).toEqual([1, 2, 3]);
    expect(
      chartXs(
        [
          {
            id: "d",
            points: [
              { x: "2026-11-05", y: 1 },
              { x: "2026-11-01", y: 1 },
            ],
          },
        ],
        "date",
      ),
    ).toEqual(["2026-11-01", "2026-11-05"]);
  });

  it("labels dates with a short month and day, and anything else as written", () => {
    expect(describeX("2026-11-04", "date", "en-US")).toBe("Nov 4");
    expect(describeX("someday", "date", "en-US")).toBe("someday");
    expect(describeX(7, "number")).toBe("7");
  });

  it("reports nothing for an x outside the chart", () => {
    expect(selectionAt(WEEK, ["Mon"], undefined)).toEqual({ x: null, values: [] });
    expect(selectionAt(WEEK, ["Mon"], 4)).toEqual({ x: null, values: [] });
  });

  it("curves through points, or draws nothing for none", () => {
    expect(linePath([], true)).toBe("");
    expect(linePath([{ x: 0, y: 0 }], true)).toBe("M 0 0");
    expect(
      linePath(
        [
          { x: 0, y: 0 },
          { x: 6, y: 6 },
        ],
        true,
      ),
    ).toBe("M 0 0 C 1 1 5 5 6 6");
    expect(
      linePath(
        [
          { x: 0, y: 0 },
          { x: 6, y: 6 },
          { x: 12, y: 0 },
        ],
        true,
      ),
    ).toBe("M 0 0 C 1 1 4 6 6 6 C 8 6 11 1 12 0");
  });
});
