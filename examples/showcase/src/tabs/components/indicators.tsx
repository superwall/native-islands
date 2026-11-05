import * as React from "react";
import type { SymbolEffectName } from "native-islands/components";
import { demoScreens, type ScreenSpec } from "../../app/nav";
import type { ChartKind, ChartPoint } from "../../islands/definitions";
import { Button, Segmented, Toggle } from "../../ui/controls";
import { AnimatedSymbol, Chart, Gauge } from "../../ui/indicators";
import { MenuPicker, Slider } from "../../ui/inputs";
import { Readout, Row, Section, Stage } from "../../ui/List";

const Gauges = () => {
  const [value, setValue] = React.useState(0.65);
  const percent = `${Math.round(value * 100)}%`;
  const celsius = Math.round(12 + value * 18);
  return (
    <>
      <div className="nav-gap" />
      <Stage caption="Every gauge here follows the one slider below.">
        <div className="stage-row stage-row--spread">
          <Gauge
            label="Temperature"
            style="circular"
            value={value}
            valueLabel={`${celsius}°`}
            minimumLabel="12"
            maximumLabel="30"
          />
          <Gauge
            label="Battery"
            style="capacity"
            value={value}
            valueLabel={percent}
            tint="#34c759"
          />
          <Gauge label="Loading" style="spinner" value={0} />
        </div>
      </Stage>
      <Section header="Linear">
        <div className="row">
          <Gauge
            label="Storage"
            style="linear"
            value={value}
            valueLabel={percent}
            minimumLabel="0"
            maximumLabel="256"
          />
        </div>
        <div className="row">
          <Gauge label="Download" style="bar" value={value} valueLabel={percent} />
        </div>
      </Section>
      <Section header="Value">
        <div className="row">
          <Slider label="Value" value={value} onChange={setValue} />
        </div>
        <Readout value={percent} />
      </Section>
    </>
  );
};

const EFFECTS: readonly {
  effect: SymbolEffectName;
  title: string;
  symbol: string;
  repeats: boolean;
}[] = [
  { effect: "bounce", title: "Bounce", symbol: "star.fill", repeats: false },
  { effect: "wiggle", title: "Wiggle", symbol: "bell.fill", repeats: false },
  { effect: "replace", title: "Replace", symbol: "play.fill", repeats: false },
  { effect: "pulse", title: "Pulse", symbol: "bolt.fill", repeats: true },
  { effect: "variableColor", title: "Variable Colour", symbol: "wifi", repeats: true },
  { effect: "breathe", title: "Breathe", symbol: "heart.fill", repeats: true },
  { effect: "rotate", title: "Rotate", symbol: "arrow.clockwise", repeats: true },
];

const Symbols = () => {
  const [index, setIndex] = React.useState(0);
  const [trigger, setTrigger] = React.useState(0);
  const [active, setActive] = React.useState(true);
  const current = EFFECTS[index] ?? EFFECTS[0];
  if (!current) return null;
  const name =
    current.effect === "replace" ? (trigger % 2 ? "pause.fill" : "play.fill") : current.symbol;
  return (
    <>
      <div className="nav-gap" />
      <Stage caption="SF Symbols animate natively, layer by layer, at the display's frame rate.">
        <div className="symbol-stage">
          <AnimatedSymbol
            name={name}
            effect={current.effect}
            trigger={trigger}
            active={current.repeats && active}
          />
        </div>
      </Stage>
      <Section>
        <Row
          title="Effect"
          accessory={
            <MenuPicker
              label="Effect"
              options={EFFECTS.map((entry) => entry.title)}
              selectedIndex={index}
              onChange={setIndex}
            />
          }
        />
        {current.repeats ? (
          <Row
            title="Running"
            accessory={<Toggle label="Running" isOn={active} onChange={setActive} />}
          />
        ) : (
          <div className="row row--centered">
            <Button title="Play" prominent onPress={() => setTrigger((count) => count + 1)} />
          </div>
        )}
      </Section>
    </>
  );
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const KINDS: readonly ChartKind[] = ["bar", "line", "area"];

const randomWeek = (): ChartPoint[] =>
  DAYS.map((label) => ({ label, value: Math.round(2 + Math.random() * 10) }));

const Charts = () => {
  const [kind, setKind] = React.useState(0);
  const [points, setPoints] = React.useState<ChartPoint[]>(() => [
    { label: "Mon", value: 6 },
    { label: "Tue", value: 8 },
    { label: "Wed", value: 5 },
    { label: "Thu", value: 9 },
    { label: "Fri", value: 11 },
    { label: "Sat", value: 4 },
    { label: "Sun", value: 7 },
  ]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const point = points.find((entry) => entry.label === selected);
  const total = points.reduce((sum, entry) => sum + entry.value, 0);
  return (
    <>
      <div className="nav-gap" />
      <Stage caption="Swift Charts, fed by the page. Drag across it: the page hears the day under your finger.">
        <div className="chart-heading">
          <span className="chart-caption">{point ? point.label : "This week"}</span>
          <span className="chart-total">{point ? point.value : total} km</span>
        </div>
        <div className="chart-cell">
          <Chart
            kind={KINDS[kind] ?? "bar"}
            points={points}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
      </Stage>
      <Section>
        <div className="row">
          <Segmented segments={["Bar", "Line", "Area"]} selectedIndex={kind} onChange={setKind} />
        </div>
        <div className="row row--centered">
          <Button title="New Week" onPress={() => setPoints(randomWeek())} />
        </div>
      </Section>
      <Section header="State">
        <Readout title="Scrubbing" value={selected ?? "none"} />
      </Section>
    </>
  );
};

export const indicatorScreens: readonly ScreenSpec[] = demoScreens("components", "Indicators", [
  {
    id: "gauges",
    keywords: ["progress", "spinner", "capacity"],
    title: "Gauges & Progress",
    symbol: "gauge.with.dots.needle.67percent",
    Component: Gauges,
  },
  {
    id: "symbols",
    keywords: ["SF Symbols", "icons", "animation", "effects"],
    title: "SF Symbols",
    symbol: "star.fill",
    Component: Symbols,
  },
  {
    id: "charts",
    keywords: ["Swift Charts", "graph", "bar", "line"],
    title: "Charts",
    symbol: "chart.bar.fill",
    Component: Charts,
  },
]);
