import * as React from "react";
import { demoScreens, type ScreenSpec } from "../../app/nav";
import type { MenuItem } from "native-islands/components";
import { Button, CloseButton, Segmented, Toggle } from "../../ui/controls";
import { Menu, Slider, Stepper } from "../../ui/inputs";
import { Readout, Row, Section, Stage } from "../../ui/List";

const Buttons = () => {
  const [taps, setTaps] = React.useState(0);
  const [last, setLast] = React.useState("none");
  const press = (name: string) => () => {
    setTaps((count) => count + 1);
    setLast(name);
  };
  return (
    <>
      <div className="nav-gap" />
      <Stage caption="Regular glass refracts what is under it; prominent glass takes the accent colour.">
        <div className="stage-row">
          <Button title="Regular" onPress={press("Regular")} />
          <Button title="Prominent" prominent onPress={press("Prominent")} />
        </div>
      </Stage>
      <Stage caption="Buttons in one glass group merge into a single shape, as in a toolbar.">
        <div className="stage-row">
          <Button symbol="plus" label="Add" onPress={press("Add")} />
          <div className="stage-group">
            <Button symbol="heart.fill" label="Like" glassGroup="toolbar" onPress={press("Like")} />
            <Button
              symbol="square.and.arrow.up"
              label="Share"
              glassGroup="toolbar"
              onPress={press("Share")}
            />
            <Button symbol="trash" label="Delete" glassGroup="toolbar" onPress={press("Delete")} />
          </div>
        </div>
      </Stage>
      <Stage caption="The close button of a sheet: round glass with the system's cross.">
        <div className="stage-row">
          <CloseButton onPress={press("Close")} />
        </div>
      </Stage>
      <Stage caption="A disabled button keeps its place and ignores taps.">
        <div className="stage-row">
          <Button title="Disabled" disabled onPress={press("Disabled")} />
          <Button title="Disabled" prominent disabled onPress={press("Disabled")} />
        </div>
      </Stage>
      <Section header="Events">
        <Readout title="Taps" value={String(taps)} />
        <Readout title="Last pressed" value={last} />
      </Section>
    </>
  );
};

const SORTS = ["Name", "Date", "Size"] as const;

const Menus = () => {
  const [sort, setSort] = React.useState<string>("Date");
  const [ascending, setAscending] = React.useState(false);
  const [last, setLast] = React.useState("none");
  const sortItems: readonly MenuItem[] = [
    ...SORTS.map((name) => ({ id: name, title: name, checked: name === sort })),
    {
      id: "order",
      title: "Order",
      systemImage: "arrow.up.arrow.down",
      children: [
        { id: "ascending", title: "Ascending", checked: ascending },
        { id: "descending", title: "Descending", checked: !ascending },
      ],
    },
  ];
  const actions: readonly MenuItem[] = [
    { id: "share", title: "Share", systemImage: "square.and.arrow.up" },
    { id: "duplicate", title: "Duplicate", systemImage: "plus" },
    { id: "favourite", title: "Favourite", systemImage: "heart.fill" },
    { id: "delete", title: "Delete", systemImage: "trash", destructive: true },
  ];
  return (
    <>
      <div className="nav-gap" />
      <Stage caption="Each opens UIKit's own menu: blurred, springy, with submenus, and it can leave the island's bounds.">
        <div className="stage-row">
          <Menu
            label="Sort"
            title="Sort"
            symbol="arrow.up.arrow.down"
            items={sortItems}
            onSelect={(id) => {
              setLast(id);
              if (id === "ascending" || id === "descending") setAscending(id === "ascending");
              else setSort(id);
            }}
          />
          <Menu label="More" symbol="ellipsis" items={actions} onSelect={setLast} />
          <Menu label="New" title="New" prominent items={actions.slice(0, 2)} onSelect={setLast} />
        </div>
      </Stage>
      <Section
        header="Events"
        footer="The page builds the items, checkmarks included, and hears which one was chosen."
      >
        <Readout title="Sorted by" value={`${sort}, ${ascending ? "ascending" : "descending"}`} />
        <Readout title="Last chosen" value={last} />
      </Section>
    </>
  );
};

const Toggles = () => {
  const [airplane, setAirplane] = React.useState(false);
  const [wifi, setWifi] = React.useState(true);
  const [bluetooth, setBluetooth] = React.useState(true);
  const setAirplaneMode = (next: boolean) => {
    setAirplane(next);
    if (next) {
      setWifi(false);
      setBluetooth(false);
    }
  };
  return (
    <>
      <div className="nav-gap" />
      <Section footer="Airplane Mode turns the others off: the page decides, and the native switches follow.">
        <Row
          title="Airplane Mode"
          accessory={<Toggle label="Airplane Mode" isOn={airplane} onChange={setAirplaneMode} />}
        />
        <Row title="Wi-Fi" accessory={<Toggle label="Wi-Fi" isOn={wifi} onChange={setWifi} />} />
        <Row
          title="Bluetooth"
          accessory={<Toggle label="Bluetooth" isOn={bluetooth} onChange={setBluetooth} />}
        />
      </Section>
      <Section header="State">
        <Readout value={[airplane, wifi, bluetooth].map((on) => (on ? "on" : "off")).join(" · ")} />
      </Section>
    </>
  );
};

const RANGES = ["Day", "Week", "Month", "Year"] as const;
const STEPS: Record<(typeof RANGES)[number], string> = {
  Day: "8,204 steps today",
  Week: "61,930 steps this week",
  Month: "248,112 steps this month",
  Year: "2.9 million steps this year",
};

const SegmentedControls = () => {
  const [range, setRange] = React.useState(1);
  const [unit, setUnit] = React.useState(0);
  const name = RANGES[range] ?? "Week";
  return (
    <>
      <div className="nav-gap" />
      <Stage caption="The selection slides natively; the page swaps what it shows below.">
        <Segmented segments={RANGES} selectedIndex={range} onChange={setRange} />
        <p className="stage-value">{STEPS[name]}</p>
      </Stage>
      <Section header="Units">
        <div className="row">
          <Segmented segments={["Kilometres", "Miles"]} selectedIndex={unit} onChange={setUnit} />
        </div>
      </Section>
      <Section header="State">
        <Readout value={`${name} · ${unit ? "mi" : "km"}`} />
      </Section>
    </>
  );
};

const Sliders = () => {
  const [brightness, setBrightness] = React.useState(0.6);
  const [volume, setVolume] = React.useState(4);
  return (
    <>
      <div className="nav-gap" />
      <Stage caption="Continuous: the page hears every movement and redraws the preview as you drag.">
        <div className="brightness-preview" style={{ opacity: 0.15 + brightness * 0.85 }} />
        <Slider
          label="Brightness"
          value={brightness}
          minimumSymbol="sun.min"
          maximumSymbol="sun.max.fill"
          onChange={setBrightness}
        />
      </Stage>
      <Section header="Volume" footer="Stepped from 0 to 10: the thumb snaps to whole numbers.">
        <div className="row">
          <Slider
            label="Volume"
            value={volume}
            minimum={0}
            maximum={10}
            step={1}
            minimumSymbol="speaker.fill"
            maximumSymbol="speaker.wave.3.fill"
            onChange={setVolume}
          />
        </div>
      </Section>
      <Section header="State">
        <Readout title="Brightness" value={brightness.toFixed(2)} />
        <Readout title="Volume" value={String(volume)} />
      </Section>
    </>
  );
};

const Steppers = () => {
  const [coffees, setCoffees] = React.useState(2);
  const [hours, setHours] = React.useState(7.5);
  return (
    <>
      <div className="nav-gap" />
      <Section footer="Hold a button to repeat, as UIStepper does.">
        <Row
          title="Coffees"
          detail={String(coffees)}
          accessory={
            <Stepper
              label="Coffees"
              value={coffees}
              minimum={0}
              maximum={10}
              onChange={setCoffees}
            />
          }
        />
        <Row
          title="Sleep goal"
          detail={`${hours} h`}
          accessory={
            <Stepper
              label="Sleep goal"
              value={hours}
              minimum={4}
              maximum={12}
              step={0.5}
              onChange={setHours}
            />
          }
        />
      </Section>
      <Section header="State">
        <Readout value={`$${(coffees * 4.5).toFixed(2)} on coffee, ${hours} h of sleep`} />
      </Section>
    </>
  );
};

export const controlScreens: readonly ScreenSpec[] = demoScreens("components", "Controls", [
  {
    id: "buttons",
    keywords: ["Liquid Glass", "glass", "tap"],
    title: "Buttons",
    symbol: "hand.tap.fill",
    Component: Buttons,
  },
  {
    id: "menus",
    keywords: ["context menu", "pull-down", "actions"],
    title: "Menus",
    symbol: "filemenu.and.selection",
    Component: Menus,
  },
  {
    id: "toggles",
    keywords: ["switch", "on off"],
    title: "Toggles",
    symbol: "switch.2",
    Component: Toggles,
  },
  {
    id: "segmented",
    keywords: ["tabs", "choice"],
    title: "Segmented Controls",
    symbol: "rectangle.split.3x1.fill",
    Component: SegmentedControls,
  },
  {
    id: "sliders",
    keywords: ["range", "volume", "brightness"],
    title: "Sliders",
    symbol: "slider.horizontal.3",
    Component: Sliders,
  },
  {
    id: "steppers",
    keywords: ["plus minus", "count"],
    title: "Steppers",
    symbol: "plusminus",
    Component: Steppers,
  },
]);
