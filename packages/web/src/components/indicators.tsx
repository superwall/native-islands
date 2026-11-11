import type * as React from "react";
import type { NativeCommonProps } from "../react/components/Native";
import { arcPath, clamp, cssVariables } from "./geometry";
import {
  NativeGauge,
  NativeSymbol,
  NativeSymbolEffect,
  type GaugeStyle,
  type SymbolEffectName,
  type SymbolWeight,
} from "./specs";

/**
 * Views that show something rather than take input. The package ships no SF
 * Symbol drawings, so a symbol's web version is the page's own drawing,
 * passed as `children`.
 */

/** An SF Symbol drawn natively; `children` is the web version's drawing of it. */
export const SystemSymbol = ({
  name,
  tint,
  weight,
  pointSize,
  children,
  ...common
}: NativeCommonProps & {
  name: string;
  tint?: string;
  weight?: SymbolWeight;
  pointSize?: number;
  children: React.ReactNode;
}) => (
  <NativeSymbol name={name} tint={tint} weight={weight} pointSize={pointSize} {...common}>
    <span className="ni-symbol" style={cssVariables({ "--ni-tint": tint })}>
      {children}
    </span>
  </NativeSymbol>
);

/**
 * An SF Symbol playing an effect. Discrete effects (`bounce`, `wiggle`,
 * `replace`) play once each time `trigger` changes; the others run while
 * `active`.
 */
export const SymbolEffect = ({
  name,
  effect,
  trigger,
  active,
  tint,
  pointSize,
  children,
  ...common
}: NativeCommonProps & {
  name: string;
  effect: SymbolEffectName;
  trigger: number;
  active: boolean;
  tint?: string;
  pointSize?: number;
  children: React.ReactNode;
}) => (
  <NativeSymbolEffect
    name={name}
    effect={effect}
    trigger={trigger}
    active={active}
    tint={tint}
    pointSize={pointSize}
    {...common}
  >
    <span className="ni-symbol-effect" style={cssVariables({ "--ni-tint": tint })}>
      <span
        key={`${name}-${trigger}`}
        className="ni-symbol-effect-image"
        data-effect={effect}
        data-active={active ? "" : undefined}
      >
        {children}
      </span>
    </span>
  </NativeSymbolEffect>
);

const RING = { cx: 40, cy: 40, radius: 32 };

const WebGauge = ({
  value,
  style,
  valueLabel,
  minimumLabel,
  maximumLabel,
}: {
  value: number;
  style: GaugeStyle;
  valueLabel?: string;
  minimumLabel?: string;
  maximumLabel?: string;
}) => {
  switch (style) {
    case "spinner":
      return <div className="ni-spinner" />;
    case "bar":
    case "linear":
      return (
        <div className="ni-gauge-linear" data-style={style}>
          {style === "linear" && <span>{minimumLabel}</span>}
          <div className="ni-gauge-track">
            <div className="ni-gauge-fill" style={{ width: `${clamp(value, 0, 1) * 100}%` }} />
          </div>
          {style === "linear" && <span>{maximumLabel}</span>}
        </div>
      );
    default: {
      const arc = style === "capacity" ? { start: 0, sweep: 360 } : { start: -135, sweep: 270 };
      return (
        <div className="ni-gauge-circular">
          <svg viewBox="0 0 80 80" aria-hidden>
            <path className="ni-gauge-ring" d={arcPath(1, { ...RING, ...arc })} />
            <path className="ni-gauge-value" d={arcPath(value, { ...RING, ...arc })} />
          </svg>
          <span className="ni-gauge-label">{valueLabel}</span>
          {style === "circular" && (
            <span className="ni-gauge-ends">
              <span>{minimumLabel}</span>
              <span>{maximumLabel}</span>
            </span>
          )}
        </div>
      );
    }
  }
};

/**
 * A gauge or progress view, from SwiftUI's `Gauge` and `ProgressView`.
 * `value` runs from 0 to 1. Gauges need iOS 16; on iOS 15 the web version shows.
 */
export const Gauge = ({
  value,
  style,
  valueLabel,
  minimumLabel,
  maximumLabel,
  tint,
  children,
  label,
  accessibility,
  ...common
}: NativeCommonProps & {
  value: number;
  style: GaugeStyle;
  /** The text inside a circular gauge, such as `72%`. */
  valueLabel?: string;
  minimumLabel?: string;
  maximumLabel?: string;
  tint?: string;
  /** The accessibility label. */
  label: string;
}) => (
  <NativeGauge
    value={value}
    style={style}
    label={valueLabel}
    minimumLabel={minimumLabel}
    maximumLabel={maximumLabel}
    tint={tint}
    accessibility={accessibility ?? { label, value: valueLabel }}
    {...common}
  >
    {children ?? (
      <div
        className="ni-gauge"
        role="progressbar"
        aria-label={label}
        aria-busy={style === "spinner" || undefined}
        aria-valuenow={style === "spinner" ? undefined : Math.round(clamp(value, 0, 1) * 100)}
        aria-valuetext={style === "spinner" ? undefined : valueLabel}
        style={cssVariables({ "--ni-tint": tint })}
      >
        <WebGauge
          value={value}
          style={style}
          valueLabel={valueLabel}
          minimumLabel={minimumLabel}
          maximumLabel={maximumLabel}
        />
      </div>
    )}
  </NativeGauge>
);
