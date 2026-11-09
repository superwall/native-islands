import * as React from "react";
import { demoScreens, type ScreenSpec } from "../../app/nav";
import { Button } from "../../ui/controls";
import { formatLocal } from "../../ui/dates";
import {
  ColorWell,
  DatePicker,
  MenuPicker,
  TextField,
  WheelPicker,
  type TextFieldHandle,
} from "../../ui/inputs";
import { Readout, Row, Section, Stage } from "../../ui/List";

const SORTS = ["Recently Added", "Title", "Artist", "Plays"] as const;
const REPEATS = ["Never", "Daily", "Weekdays", "Weekly", "Monthly"] as const;
const FLAVOURS = ["Vanilla", "Chocolate", "Pistachio", "Strawberry", "Salted Caramel", "Mango"];

const Pickers = () => {
  const [sort, setSort] = React.useState(0);
  const [repeat, setRepeat] = React.useState(2);
  const [flavour, setFlavour] = React.useState(2);
  const [colour, setColour] = React.useState("#ff9500");
  return (
    <>
      <div className="nav-gap" />
      <Section header="Menu" footer="Tap the value for a system menu of the options.">
        <Row
          title="Sort By"
          accessory={
            <MenuPicker label="Sort By" options={SORTS} selectedIndex={sort} onChange={setSort} />
          }
        />
        <Row
          title="Repeat"
          accessory={
            <MenuPicker
              label="Repeat"
              options={REPEATS}
              selectedIndex={repeat}
              onChange={setRepeat}
            />
          }
        />
      </Section>
      <Section header="Wheel" footer="The wheel spins with momentum and clicks into place.">
        <WheelPicker
          label="Flavour"
          options={FLAVOURS}
          selectedIndex={flavour}
          onChange={setFlavour}
        />
      </Section>
      <Section
        header="Colour"
        footer="The well opens the system colour picker, eyedropper included."
      >
        <Row
          title="Highlight"
          leading={<span className="swatch" style={{ background: colour }} />}
          accessory={<ColorWell label="Highlight" color={colour} onChange={setColour} />}
        />
      </Section>
      <Section header="State">
        <Readout title="Sort By" value={SORTS[sort] ?? ""} />
        <Readout title="Repeat" value={REPEATS[repeat] ?? ""} />
        <Readout title="Flavour" value={FLAVOURS[flavour] ?? ""} />
        <Readout title="Highlight" value={colour} />
      </Section>
    </>
  );
};

const nextHalfHour = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() < 30 ? 30 : 60, 0, 0);
  return formatLocal(date);
};

const Dates = () => {
  const [date, setDate] = React.useState(nextHalfHour);
  return (
    <>
      <div className="nav-gap" />
      <Section
        header="Compact"
        footer="Tap the date or the time for a calendar or a wheel over the page."
      >
        <Row
          title="Date"
          accessory={<DatePicker label="Date" date={date} components="date" onChange={setDate} />}
        />
        <Row
          title="Time"
          accessory={<DatePicker label="Time" date={date} components="time" onChange={setDate} />}
        />
      </Section>
      <Section header="Graphical">
        <div className="calendar-cell">
          <DatePicker label="Calendar" date={date} style="graphical" onChange={setDate} />
        </div>
      </Section>
      <Section header="Wheel">
        <DatePicker label="Alarm" date={date} components="time" style="wheel" onChange={setDate} />
      </Section>
      <Section header="State" footer="Four pickers, one value: each follows the others.">
        <Readout value={date} />
      </Section>
    </>
  );
};

const TextFields = () => {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [focused, setFocused] = React.useState<string>();
  const [submitted, setSubmitted] = React.useState("nothing yet");
  const fields = {
    name: React.useRef<TextFieldHandle>(null),
    email: React.useRef<TextFieldHandle>(null),
    password: React.useRef<TextFieldHandle>(null),
    amount: React.useRef<TextFieldHandle>(null),
  };
  const nameField = fields.name;
  const focus = (field: string) => (on: boolean) =>
    setFocused((current) => (on ? field : current === field ? undefined : current));
  return (
    <>
      <div className="nav-gap" />
      <Section footer="Native fields: the system keyboard, autofill, the caret and text selection as in any app.">
        <Row
          title="Name"
          accessory={
            <TextField
              label="Name"
              text={name}
              placeholder="Appleseed"
              handle={nameField}
              onChange={setName}
              onFocusChange={focus("name")}
              onSubmit={(text) => setSubmitted(`name: ${text}`)}
            />
          }
        />
        <Row
          title="Email"
          accessory={
            <TextField
              label="Email"
              kind="email"
              text={email}
              placeholder="you@example.com"
              onChange={setEmail}
              handle={fields.email}
              onFocusChange={focus("email")}
              onSubmit={(text) => setSubmitted(`email: ${text}`)}
            />
          }
        />
        <Row
          title="Password"
          accessory={
            <TextField
              label="Password"
              kind="secure"
              text={password}
              placeholder="Required"
              onChange={setPassword}
              handle={fields.password}
              onFocusChange={focus("password")}
              onSubmit={() => setSubmitted("password")}
            />
          }
        />
        <Row
          title="Amount"
          accessory={
            <TextField
              label="Amount"
              kind="number"
              text={amount}
              placeholder="0.00"
              onChange={setAmount}
              handle={fields.amount}
              onFocusChange={focus("amount")}
            />
          }
        />
      </Section>
      <Stage caption="The page sends commands to a field: focus brings up the keyboard, done puts it away.">
        <div className="stage-row">
          <Button title="Focus Name" onPress={() => nameField.current?.focus()} />
          <Button
            title="Done"
            prominent
            disabled={!focused}
            onPress={() => {
              const field = Object.entries(fields).find(([key]) => key === focused)?.[1];
              field?.current?.blur();
            }}
          />
        </div>
      </Stage>
      <Section header="State">
        <Readout title="Focused" value={focused ?? "none"} />
        <Readout title="Name" value={name || "—"} />
        <Readout title="Email" value={email || "—"} />
        <Readout title="Password" value={"•".repeat(password.length) || "—"} />
        <Readout title="Submitted" value={submitted} />
      </Section>
    </>
  );
};

export const pickerScreens: readonly ScreenSpec[] = demoScreens("components", "Pickers & Input", [
  {
    id: "pickers",
    keywords: ["wheel", "select", "list", "colour", "color"],
    title: "Pickers",
    symbol: "list.bullet",
    Component: Pickers,
  },
  {
    id: "dates",
    keywords: ["calendar", "time", "date picker"],
    title: "Date & Time",
    symbol: "calendar",
    Component: Dates,
  },
  {
    id: "text-fields",
    keywords: ["input", "keyboard", "email", "password"],
    title: "Text Fields",
    symbol: "character.cursor.ibeam",
    Component: TextFields,
  },
]);
