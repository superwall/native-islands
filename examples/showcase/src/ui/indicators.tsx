import {
  Chart as PackageChart,
  Gauge as PackageGauge,
  SymbolEffect,
  type ChartKind,
  type ChartSelection,
  type ChartSeries,
  type ChartYAxis,
  type GaugeStyle,
  type SymbolEffectName,
} from "native-islands/components";
import { useAccent, useNativeEnabled } from "../app/preferences";
import { WebSymbol } from "./icons";

/** A gauge or progress view, from SwiftUI's `Gauge` and `ProgressView`. */
export const Gauge = ({
  tint,
  ...props
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
  return <PackageGauge {...props} tint={tint ?? accent} native={useNativeEnabled()} />;
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
  effect: SymbolEffectName;
  trigger: number;
  active: boolean;
  tint?: string;
}) => {
  const accent = useAccent();
  return (
    <SymbolEffect
      name={name}
      effect={effect}
      trigger={trigger}
      active={active}
      tint={tint ?? accent}
      pointSize={56}
      native={useNativeEnabled()}
    >
      <WebSymbol name={name} />
    </SymbolEffect>
  );
};

/** A Swift Charts chart of the page's series, in the app's accent. */
export const Chart = (props: {
  kind: ChartKind;
  series: readonly ChartSeries[];
  stacked: boolean;
  yAxis?: ChartYAxis;
  onSelect: (selection: ChartSelection) => void;
}) => <PackageChart {...props} tint={useAccent()} native={useNativeEnabled()} />;
