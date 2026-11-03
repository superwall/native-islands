import * as React from "react";
import { useAccent, useNativeEnabled } from "../app/preferences";
import {
  NativeChart,
  NativeGauge,
  NativeSymbolEffect,
  type ChartKind,
  type ChartPoint,
  type GaugeStyle,
  type SymbolEffect,
} from "../islands/definitions";
import { arcPath, niceMaximum, slotAt } from "./geometry";
import { WebSymbol } from "./icons";

const RING = { cx: 40, cy: 40, radius: 32 };

const WebGauge = ({
  value,
  style,
  label,
  minimumLabel,
  maximumLabel,
}: {
  value: number;
  style: GaugeStyle;
  label?: string;
  minimumLabel?: string;
  maximumLabel?: string;
}) => {
  switch (style) {
    case "spinner":
      return <div className="web-spinner" role="progressbar" aria-busy />;
    case "bar":
    case "linear":
      return (
        <div className="web-gauge-linear" data-style={style}>
          {style === "linear" && <span>{minimumLabel}</span>}
          <div className="web-gauge-track">
            <div
              className="web-gauge-fill"
              style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%` }}
            />
          </div>
          {style === "linear" && <span>{maximumLabel}</span>}
        </div>
      );
    default: {
      const arc = style === "capacity" ? { start: 0, sweep: 360 } : { start: -135, sweep: 270 };
      return (
        <div className="web-gauge-circular">
          <svg viewBox="0 0 80 80" aria-hidden>
            <path className="web-gauge-ring" d={arcPath(1, { ...RING, ...arc })} />
            <path className="web-gauge-value" d={arcPath(value, { ...RING, ...arc })} />
          </svg>
          <span className="web-gauge-label">{label}</span>
          {style === "circular" && (
            <span className="web-gauge-ends">
              <span>{minimumLabel}</span>
              <span>{maximumLabel}</span>
            </span>
          )}
        </div>
      );
    }
  }
};

/** A gauge or progress view, from SwiftUI's `Gauge` and `ProgressView`. */
export const Gauge = ({
  label,
  value,
  style,
  valueLabel,
  minimumLabel,
  maximumLabel,
  tint,
}: {
  label: string;
  value: number;
  style: GaugeStyle;
  valueLabel?: string;
  minimumLabel?: string;
  maximumLabel?: string;
  tint?: string;
}) => {
  const accent = useAccent();
  return (
    <NativeGauge
      value={value}
      style={style}
      label={valueLabel}
      minimumLabel={minimumLabel}
      maximumLabel={maximumLabel}
      tint={tint ?? accent}
      native={useNativeEnabled()}
      accessibility={{ label, value: valueLabel }}
    >
      <div
        className="web-gauge"
        style={{ "--tint": tint ?? "var(--accent)" } as React.CSSProperties}
      >
        <WebGauge
          value={value}
          style={style}
          label={valueLabel}
          minimumLabel={minimumLabel}
          maximumLabel={maximumLabel}
        />
      </div>
    </NativeGauge>
  );
};

/**
 * An SF Symbol playing an effect. Discrete effects play once each time
 * `trigger` changes; indefinite ones run while `active`.
 */
export const AnimatedSymbol = ({
  name,
  effect,
  trigger,
  active,
  tint,
}: {
  name: string;
  effect: SymbolEffect;
  trigger: number;
  active: boolean;
  tint?: string;
}) => {
  const accent = useAccent();
  return (
    <NativeSymbolEffect
      name={name}
      effect={effect}
      trigger={trigger}
      active={active}
      tint={tint ?? accent}
      pointSize={56}
      native={useNativeEnabled()}
    >
      <div className="web-symbol-effect" style={{ color: tint ?? "var(--accent)" }}>
        <span
          key={`${name}-${trigger}`}
          className="web-symbol-effect-image"
          data-effect={effect}
          data-active={active ? "" : undefined}
        >
          <WebSymbol name={name} />
        </span>
      </div>
    </NativeSymbolEffect>
  );
};

const CHART = { width: 320, height: 180, gap: 10 };

const WebChart = ({
  kind,
  points,
  selected,
  onSelect,
}: {
  kind: ChartKind;
  points: readonly ChartPoint[];
  selected: string | null;
  onSelect: (label: string | null) => void;
}) => {
  const maximum = niceMaximum(points.map((point) => point.value));
  const slot = CHART.width / Math.max(points.length, 1);
  const y = (value: number) => CHART.height - (value / maximum) * CHART.height;
  const centers = points.map((point, index) => ({
    ...point,
    x: slot * index + slot / 2,
    y: y(point.value),
  }));
  const line = centers
    .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
    .join(" ");
  const scrub = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const index = slotAt(event.clientX - box.left, box.width, points.length);
    onSelect(index === undefined ? null : (points[index]?.label ?? null));
  };
  return (
    <div className="web-chart">
      <svg
        viewBox={`0 0 ${CHART.width} ${CHART.height + 20}`}
        preserveAspectRatio="none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          scrub(event);
        }}
        onPointerMove={(event) => event.buttons && scrub(event)}
        onPointerUp={() => onSelect(null)}
        onPointerCancel={() => onSelect(null)}
      >
        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            className="web-chart-grid"
            x1={0}
            x2={CHART.width}
            y1={CHART.height * fraction}
            y2={CHART.height * fraction}
          />
        ))}
        {kind === "bar" &&
          centers.map((point) => (
            <rect
              key={point.label}
              className="web-chart-bar"
              data-dimmed={selected && selected !== point.label ? "" : undefined}
              x={point.x - slot / 2 + CHART.gap / 2}
              width={slot - CHART.gap}
              y={point.y}
              height={CHART.height - point.y}
              rx={6}
            />
          ))}
        {kind === "area" && (
          <path
            className="web-chart-area"
            d={`${line} L ${centers.at(-1)?.x ?? 0} ${CHART.height} L ${centers[0]?.x ?? 0} ${CHART.height} Z`}
          />
        )}
        {kind !== "bar" && <path className="web-chart-line" d={line} />}
        {kind === "line" &&
          centers.map((point) => (
            <circle key={point.label} className="web-chart-dot" cx={point.x} cy={point.y} r={4} />
          ))}
        {centers.map((point) => (
          <text key={point.label} className="web-chart-label" x={point.x} y={CHART.height + 15}>
            {point.label}
          </text>
        ))}
      </svg>
    </div>
  );
};

/** A Swift Charts chart; scrubbing it reports the point under the finger. */
export const Chart = ({
  kind,
  points,
  selected,
  onSelect,
}: {
  kind: ChartKind;
  points: readonly ChartPoint[];
  selected: string | null;
  onSelect: (label: string | null) => void;
}) => (
  <NativeChart
    kind={kind}
    points={points}
    tint={useAccent()}
    native={useNativeEnabled()}
    accessibility={{ label: "Chart" }}
    onSelect={({ label }) => onSelect(label)}
  >
    <WebChart kind={kind} points={points} selected={selected} onSelect={onSelect} />
  </NativeChart>
);
