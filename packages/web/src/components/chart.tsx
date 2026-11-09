import * as React from "react";
import type { NativeCommonProps } from "../react/components/Native";
import { cssVariables, niceMaximum, slotAt } from "./geometry";
import {
  NativeChart,
  type ChartKind,
  type ChartSelection,
  type ChartSeries,
  type ChartX,
  type ChartXAxis,
  type ChartYAxis,
} from "./specs";

type ChartSpec = {
  series: readonly ChartSeries[];
  kind?: ChartKind;
  xAxis?: ChartXAxis;
  yAxis?: ChartYAxis;
  stacked?: boolean;
  smooth?: boolean;
  legend?: boolean;
  tint?: string;
};

const BOX = { width: 320, height: 180, gap: 10 };

/** The distinct x values of every series, in order: as written for categories, ascending otherwise. */
export const chartXs = (series: readonly ChartSeries[], type: ChartXAxis["type"]): ChartX[] => {
  const seen = new Map<string, ChartX>();
  for (const entry of series) for (const point of entry.points) seen.set(String(point.x), point.x);
  const xs = [...seen.values()];
  if (type === "number") return xs.toSorted((a, b) => Number(a) - Number(b));
  if (type === "date") return xs.toSorted((a, b) => Date.parse(String(a)) - Date.parse(String(b)));
  return xs;
};

/** An x value as its axis labels it: a short month and day for dates. */
export const describeX = (x: ChartX, type: ChartXAxis["type"], locale?: string): string => {
  if (type !== "date") return String(x);
  const date = new Date(`${String(x).slice(0, 10)}T00:00`);
  return Number.isNaN(date.getTime())
    ? String(x)
    : date.toLocaleDateString(locale, { month: "short", day: "numeric" });
};

/** What the page hears for the x at `index`: the x and each series' value there. */
export const selectionAt = (
  series: readonly ChartSeries[],
  xs: readonly ChartX[],
  index: number | undefined,
): ChartSelection => {
  const x = index === undefined ? undefined : xs[index];
  if (x === undefined) return { x: null, values: [] };
  return {
    x,
    values: series.flatMap((entry) =>
      entry.points
        .filter((point) => String(point.x) === String(x))
        .map((point) => ({ series: entry.id, y: point.y })),
    ),
  };
};

const colorOf = (entry: ChartSeries, index: number) =>
  entry.color ??
  (index % 6 === 0 ? "var(--ni-tint, var(--ni-accent))" : `var(--ni-chart-${index % 6})`);

/** A smooth path through `points` with Catmull-Rom curves, or straight lines. */
export const linePath = (points: readonly { x: number; y: number }[], smooth: boolean): string => {
  const [first, ...rest] = points;
  if (!first) return "";
  let path = `M ${first.x} ${first.y}`;
  let before = first;
  let previous = first;
  rest.forEach((point, index) => {
    if (smooth) {
      const next = rest[index + 1] ?? point;
      const c1 = {
        x: previous.x + (point.x - before.x) / 6,
        y: previous.y + (point.y - before.y) / 6,
      };
      const c2 = { x: point.x - (next.x - previous.x) / 6, y: point.y - (next.y - previous.y) / 6 };
      path += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${point.x} ${point.y}`;
    } else {
      path += ` L ${point.x} ${point.y}`;
    }
    before = previous;
    previous = point;
  });
  return path;
};

const valueAt = (entry: ChartSeries, x: ChartX) =>
  entry.points.find((point) => String(point.x) === String(x))?.y;

const WebChart = ({
  series,
  kind = "bar",
  xAxis,
  yAxis,
  stacked = false,
  smooth = true,
  legend,
  tint,
  onSelect,
}: ChartSpec & { onSelect?: (selection: ChartSelection) => void }) => {
  const [scrubbed, setScrubbed] = React.useState<number>();
  const xs = chartXs(series, xAxis?.type);
  const single = series.length <= 1;
  const slot = BOX.width / Math.max(xs.length, 1);
  const bars = series.filter((entry) => (entry.kind ?? kind) === "bar");
  const totals = xs.map((x) => bars.reduce((sum, entry) => sum + (valueAt(entry, x) ?? 0), 0));
  const tallest = stacked
    ? Math.max(0, ...totals, ...series.flatMap((entry) => entry.points.map((point) => point.y)))
    : Math.max(0, ...series.flatMap((entry) => entry.points.map((point) => point.y)));
  const minimum = yAxis?.min ?? 0;
  const maximum = yAxis?.max ?? niceMaximum([tallest]);
  const y = (value: number) =>
    BOX.height - ((value - minimum) / Math.max(maximum - minimum, 1e-9)) * BOX.height;
  const centre = (index: number) => slot * index + slot / 2;
  const select = (index: number | undefined) => {
    setScrubbed(index);
    onSelect?.(selectionAt(series, xs, index));
  };
  const scrub = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    select(slotAt(event.clientX - box.left, box.width, xs.length));
  };
  const showsLegend = legend ?? !single;
  const barWidth = (slot - BOX.gap) / (stacked ? 1 : Math.max(bars.length, 1));
  return (
    <div className="ni-chart" style={cssVariables({ "--ni-tint": tint })}>
      <svg
        viewBox={`0 0 ${BOX.width} ${BOX.height + 20}`}
        preserveAspectRatio="none"
        role="img"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          scrub(event);
        }}
        onPointerMove={(event) => event.buttons && scrub(event)}
        onPointerUp={() => select(undefined)}
        onPointerCancel={() => select(undefined)}
      >
        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            className="ni-chart-grid"
            x1={0}
            x2={BOX.width}
            y1={BOX.height * fraction}
            y2={BOX.height * fraction}
          />
        ))}
        {xs.map((x, index) => {
          let base = minimum;
          return bars.map((entry, order) => {
            const value = valueAt(entry, x);
            if (value === undefined) return null;
            const bottom = stacked ? base : minimum;
            if (stacked) base += value;
            const top = bottom + value;
            const left = centre(index) - slot / 2 + BOX.gap / 2 + (stacked ? 0 : order * barWidth);
            return (
              <rect
                key={`${entry.id}-${String(x)}`}
                className="ni-chart-bar"
                data-dimmed={scrubbed !== undefined && scrubbed !== index ? "" : undefined}
                fill={colorOf(entry, series.indexOf(entry))}
                x={left}
                width={barWidth}
                y={y(top)}
                height={Math.max(y(bottom) - y(top), 0)}
                rx={stacked ? 2 : 6}
              />
            );
          });
        })}
        {series.map((entry, index) => {
          const mark = entry.kind ?? kind;
          if (mark === "bar") return null;
          const color = colorOf(entry, index);
          const points = xs.flatMap((x, at) => {
            const value = valueAt(entry, x);
            return value === undefined ? [] : [{ x: centre(at), y: y(value) }];
          });
          const line = linePath(points, smooth);
          return (
            <g key={entry.id} data-series={entry.id}>
              {mark === "area" && points.length > 0 && (
                <path
                  className="ni-chart-area"
                  fill={color}
                  d={`${line} L ${points.at(-1)?.x} ${BOX.height} L ${points[0]?.x} ${BOX.height} Z`}
                />
              )}
              {mark !== "point" && <path className="ni-chart-line" stroke={color} d={line} />}
              {(mark === "line" || mark === "point") &&
                points.map((point) => (
                  <circle
                    key={point.x}
                    className="ni-chart-dot"
                    fill={color}
                    cx={point.x}
                    cy={point.y}
                    r={4}
                  />
                ))}
            </g>
          );
        })}
        {scrubbed !== undefined && (
          <line
            className="ni-chart-rule"
            x1={centre(scrubbed)}
            x2={centre(scrubbed)}
            y1={0}
            y2={BOX.height}
          />
        )}
        {xs.map((x, index) => (
          <text key={String(x)} className="ni-chart-label" x={centre(index)} y={BOX.height + 15}>
            {describeX(x, xAxis?.type)}
          </text>
        ))}
      </svg>
      {showsLegend && (
        <ul className="ni-chart-legend">
          {series.map((entry, index) => (
            <li key={entry.id}>
              <span className="ni-chart-swatch" style={{ background: colorOf(entry, index) }} />
              {entry.name ?? entry.id}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * A Swift Charts chart of the page's series: bars, lines, areas or points,
 * on a category, number or date axis. Dragging across it scrubs and reports
 * the x under the finger with each series' value there. Its web version is an
 * SVG drawing of the same data. Register it with `NativeIslandsCharts.register()`.
 */
export const Chart = ({
  series,
  kind,
  xAxis,
  yAxis,
  stacked,
  smooth,
  legend,
  tint,
  onSelect,
  children,
  accessibility,
  label = "Chart",
  ...common
}: ChartSpec &
  NativeCommonProps & {
    /** The accessibility label. */
    label?: string;
    onSelect?: (selection: ChartSelection) => void;
  }) => (
  <NativeChart
    series={series}
    kind={kind}
    xAxis={xAxis}
    yAxis={yAxis}
    stacked={stacked}
    smooth={smooth}
    legend={legend}
    tint={tint}
    accessibility={accessibility ?? { label }}
    onSelect={onSelect}
    {...common}
  >
    {children ?? (
      <WebChart
        series={series}
        kind={kind}
        xAxis={xAxis}
        yAxis={yAxis}
        stacked={stacked}
        smooth={smooth}
        legend={legend}
        tint={tint}
        onSelect={onSelect}
      />
    )}
  </NativeChart>
);
