import * as React from "react";
import type {
  ChartKind,
  ChartSelection,
  ChartSeries,
  SymbolEffectName,
} from "native-islands/components";
import { demoScreens, type ScreenSpec } from "../../app/nav";
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
const SPORTS = [
  { id: "run", name: "Running" },
  { id: "ride", name: "Cycling" },
] as const;

const randomWeek = (scale: number) =>
  DAYS.map((x) => ({ x, y: Math.round((2 + Math.random() * 10) * scale) }));

const FIRST_WEEK: readonly ChartSeries[] = [
  {
    ...SPORTS[0],
    points: [6, 8, 5, 9, 11, 4, 7].map((y, index) => ({ x: DAYS[index] ?? "", y })),
  },
  {
    ...SPORTS[1],
    points: [12, 0, 18, 9, 0, 30, 22].map((y, index) => ({ x: DAYS[index] ?? "", y })),
  },
];

const Charts = () => {
  const [kind, setKind] = React.useState(0);
  const [stacked, setStacked] = React.useState(false);
  const [series, setSeries] = React.useState(FIRST_WEEK);
  const [selection, setSelection] = React.useState<ChartSelection>({ x: null, values: [] });
  const total = series.flatMap((entry) => entry.points).reduce((sum, point) => sum + point.y, 0);
  const shown =
    selection.x === null ? total : selection.values.reduce((sum, value) => sum + value.y, 0);
  return (
    <>
      <div className="nav-gap" />
      <Stage caption="Swift Charts, fed by the page: two series on a day axis. Drag across it: the page hears the day under your finger and each series' value there.">
        <div className="chart-heading">
          <span className="chart-caption">{selection.x ?? "This week"}</span>
          <span className="chart-total">{shown} km</span>
        </div>
        <div className="chart-cell">
          <Chart
            kind={KINDS[kind] ?? "bar"}
            series={series}
            stacked={stacked}
            yAxis={{ title: "km" }}
            onSelect={setSelection}
          />
        </div>
      </Stage>
      <Section>
        <div className="row">
          <Segmented segments={["Bar", "Line", "Area"]} selectedIndex={kind} onChange={setKind} />
        </div>
        <Row
          title="Stacked"
          accessory={<Toggle label="Stacked" isOn={stacked} onChange={setStacked} />}
        />
        <div className="row row--centered">
          <Button
            title="New Week"
            onPress={() =>
              setSeries(SPORTS.map((sport, index) => ({ ...sport, points: randomWeek(index + 1) })))
            }
          />
        </div>
      </Section>
      <Section header="Page sees">
        <Readout title="Day" value={selection.x === null ? "none" : String(selection.x)} />
        {SPORTS.map((sport) => (
          <Readout
            key={sport.id}
            title={sport.name}
            value={String(selection.values.find((value) => value.series === sport.id)?.y ?? "–")}
          />
        ))}
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
