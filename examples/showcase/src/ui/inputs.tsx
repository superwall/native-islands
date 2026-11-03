import * as React from "react";
import type { NativeHandle } from "@superwall/native-islands/react";
import { useAccent, useNativeEnabled } from "../app/preferences";
import {
  NativeColorPicker,
  NativeDatePicker,
  NativeMenu,
  NativeMenuPicker,
  NativePicker,
  NativeSlider,
  NativeStepper,
  NativeTextField,
  type DateComponents,
  type MenuItem,
  type TextFieldKind,
} from "../islands/definitions";
import {
  describeDate,
  describeMonth,
  describeTime,
  formatLocal,
  monthGrid,
  parseLocal,
  shiftMonth,
  type LocalDate,
} from "./dates";
import { stepped } from "./geometry";
import { WebSymbol } from "./icons";

/**
 * The value controls of the Components tab. Each one is a native island whose
 * value lives natively as state and flows back here, with a web version that
 * behaves the same for a browser or with native islands off.
 */

export const Slider = ({
  label,
  value,
  minimum = 0,
  maximum = 1,
  step,
  minimumSymbol,
  maximumSymbol,
  onChange,
}: {
  label: string;
  value: number;
  minimum?: number;
  maximum?: number;
  step?: number;
  minimumSymbol?: string;
  maximumSymbol?: string;
  onChange: (value: number) => void;
}) => (
  <NativeSlider
    value={value}
    minimum={minimum}
    maximum={maximum}
    step={step}
    minimumSymbol={minimumSymbol}
    maximumSymbol={maximumSymbol}
    tint={useAccent()}
    native={useNativeEnabled()}
    accessibility={{ label }}
    onStateChange={({ value: next }) => next !== undefined && onChange(next)}
  >
    <div className="web-slider">
      {minimumSymbol && <WebSymbol name={minimumSymbol} className="web-slider-symbol" />}
      <input
        type="range"
        aria-label={label}
        min={minimum}
        max={maximum}
        step={step ?? "any"}
        value={value}
        style={{ "--fill": `${((value - minimum) / (maximum - minimum)) * 100}%` }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {maximumSymbol && <WebSymbol name={maximumSymbol} className="web-slider-symbol" />}
    </div>
  </NativeSlider>
);

export const Stepper = ({
  label,
  value,
  minimum,
  maximum,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  step?: number;
  onChange: (value: number) => void;
}) => (
  <NativeStepper
    value={value}
    minimum={minimum}
    maximum={maximum}
    step={step}
    native={useNativeEnabled()}
    accessibility={{ label, value: String(value) }}
    onStateChange={({ value: next }) => next !== undefined && onChange(next)}
  >
    <div className="web-stepper" role="group" aria-label={label}>
      <button
        type="button"
        aria-label="Decrement"
        disabled={value <= minimum}
        onClick={() => onChange(stepped(value, -step, minimum, maximum))}
      >
        <WebSymbol name="minus" />
      </button>
      <button
        type="button"
        aria-label="Increment"
        disabled={value >= maximum}
        onClick={() => onChange(stepped(value, step, minimum, maximum))}
      >
        <WebSymbol name="plus" />
      </button>
    </div>
  </NativeStepper>
);

/** A picker that shows its value and opens a menu of the options. */
export const MenuPicker = ({
  label,
  options,
  selectedIndex,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}) => (
  <NativeMenuPicker
    options={options}
    selectedIndex={selectedIndex}
    style="menu"
    tint={useAccent()}
    native={useNativeEnabled()}
    accessibility={{ label }}
    onStateChange={({ selectedIndex: next }) => next !== undefined && onChange(next)}
  >
    <label className="web-menu-picker">
      <span>{options[selectedIndex]}</span>
      <WebSymbol name="chevron.up.chevron.down" />
      <select
        aria-label={label}
        value={selectedIndex}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options.map((option, index) => (
          <option key={option} value={index}>
            {option}
          </option>
        ))}
      </select>
    </label>
  </NativeMenuPicker>
);

const WHEEL_ROW = 34;
const WHEEL_HEIGHT = 216;

/** The web version of a wheel: a list that snaps a row to the band in its middle. */
const WebWheel = ({
  label,
  options,
  selectedIndex,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}) => {
  const list = React.useRef<HTMLDivElement>(null);
  const settle = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  React.useLayoutEffect(() => {
    const element = list.current;
    if (element && Math.round(element.scrollTop / WHEEL_ROW) !== selectedIndex) {
      element.scrollTop = selectedIndex * WHEEL_ROW;
    }
  }, [selectedIndex]);
  React.useEffect(() => () => clearTimeout(settle.current), []);
  const onScroll = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const element = list.current;
      if (!element) return;
      const index = Math.min(
        options.length - 1,
        Math.max(0, Math.round(element.scrollTop / WHEEL_ROW)),
      );
      if (index !== selectedIndex) onChange(index);
    }, 120);
  };
  return (
    <div
      ref={list}
      className="web-wheel"
      role="listbox"
      aria-label={label}
      style={{ height: WHEEL_HEIGHT, paddingBlock: (WHEEL_HEIGHT - WHEEL_ROW) / 2 }}
      onScroll={onScroll}
    >
      {options.map((option, index) => (
        <div
          key={option}
          className="web-wheel-row"
          role="option"
          aria-selected={index === selectedIndex}
          style={{ height: WHEEL_ROW }}
          onClick={() => onChange(index)}
        >
          {option}
        </div>
      ))}
    </div>
  );
};

/** A spinning wheel of options, as UIPickerView draws it. */
export const WheelPicker = ({
  label,
  options,
  selectedIndex,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}) => (
  <NativePicker
    options={options}
    selectedIndex={selectedIndex}
    style="wheel"
    native={useNativeEnabled()}
    accessibility={{ label }}
    onStateChange={({ selectedIndex: next }) => next !== undefined && onChange(next)}
  >
    <div className="web-wheel-frame">
      <WebWheel label={label} options={options} selectedIndex={selectedIndex} onChange={onChange} />
    </div>
  </NativePicker>
);

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));

const WebCalendar = ({
  date,
  onChange,
}: {
  date: LocalDate;
  onChange: (date: LocalDate) => void;
}) => {
  const [shown, setShown] = React.useState(date);
  React.useEffect(() => setShown(date), [date]);
  const selected = shown.year === date.year && shown.month === date.month ? date.day : undefined;
  return (
    <div className="web-calendar">
      <div className="web-calendar-head">
        <span className="web-calendar-month">{describeMonth(shown)}</span>
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setShown(shiftMonth(shown, -1))}
        >
          <WebSymbol name="chevron.left" />
        </button>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setShown(shiftMonth(shown, 1))}
        >
          <WebSymbol name="chevron.right" />
        </button>
      </div>
      <div className="web-calendar-grid" role="grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span key={index} className="web-calendar-weekday">
            {day}
          </span>
        ))}
        {monthGrid(shown.year, shown.month)
          .flat()
          .map((day, index) =>
            day === null ? (
              <span key={index} />
            ) : (
              <button
                key={index}
                type="button"
                className="web-calendar-day"
                aria-pressed={day === selected}
                onClick={() => onChange({ ...shown, day })}
              >
                {day}
              </button>
            ),
          )}
      </div>
    </div>
  );
};

/**
 * A date or time picker: `compact` is the pill that opens a calendar,
 * `graphical` the calendar itself and `wheel` the spinning wheels.
 */
export const DatePicker = ({
  label,
  date,
  components = "date",
  style = "compact",
  onChange,
}: {
  label: string;
  /** Local time as `yyyy-MM-ddTHH:mm`. */
  date: string;
  components?: DateComponents;
  style?: "compact" | "graphical" | "wheel";
  onChange: (date: string) => void;
}) => {
  const parsed = parseLocal(date) ?? parseLocal("2026-01-01T09:00");
  if (!parsed) throw new Error("The fallback date must parse.");
  const change = (next: LocalDate) => onChange(formatLocal(next));
  let web: React.ReactElement;
  if (style === "graphical") {
    web = <WebCalendar date={parsed} onChange={change} />;
  } else if (style === "wheel") {
    web = (
      <div className="web-wheel-frame web-wheel-frame--split">
        <WebWheel
          label="Hour"
          options={HOURS}
          selectedIndex={parsed.hour}
          onChange={(hour) => change({ ...parsed, hour })}
        />
        <WebWheel
          label="Minute"
          options={MINUTES}
          selectedIndex={parsed.minute}
          onChange={(minute) => change({ ...parsed, minute })}
        />
      </div>
    );
  } else {
    const time = components === "time";
    web = (
      <label className="web-date-pill">
        <span>{time ? describeTime(parsed) : describeDate(parsed)}</span>
        <input
          type={time ? "time" : "date"}
          aria-label={label}
          value={time ? date.slice(11, 16) : date.slice(0, 10)}
          onChange={(event) => {
            const value = event.target.value;
            const next = time ? `${date.slice(0, 10)}T${value}` : `${value}${date.slice(10)}`;
            if (parseLocal(next)) onChange(next);
          }}
        />
      </label>
    );
  }
  return (
    <NativeDatePicker
      date={date}
      components={components}
      style={style}
      tint={useAccent()}
      native={useNativeEnabled()}
      accessibility={{ label }}
      onStateChange={({ date: next }) => next !== undefined && onChange(next)}
    >
      {web}
    </NativeDatePicker>
  );
};

/** The system colour well, which opens the colour picker sheet. */
export const ColorWell = ({
  label,
  color,
  onChange,
}: {
  label: string;
  /** `#rrggbb` */
  color: string;
  onChange: (color: string) => void;
}) => (
  <NativeColorPicker
    color={color}
    native={useNativeEnabled()}
    accessibility={{ label }}
    onStateChange={({ color: next }) => next !== undefined && onChange(next)}
  >
    <label className="web-color-well" style={{ "--well": color }}>
      <input
        type="color"
        aria-label={label}
        value={color}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  </NativeColorPicker>
);

const WebMenuItems = ({
  items,
  onSelect,
}: {
  items: readonly MenuItem[];
  onSelect: (id: string) => void;
}) => {
  const [opened, setOpened] = React.useState<string>();
  return (
    <>
      {items.map((item) => (
        <React.Fragment key={item.id}>
          <button
            type="button"
            role="menuitem"
            className="web-menu-item"
            data-destructive={item.destructive ? "" : undefined}
            aria-expanded={item.children ? opened === item.id : undefined}
            onClick={() =>
              item.children
                ? setOpened(opened === item.id ? undefined : item.id)
                : onSelect(item.id)
            }
          >
            <span className="web-menu-check">{item.checked && <WebSymbol name="checkmark" />}</span>
            <span className="web-menu-title">{item.title}</span>
            {item.children ? (
              <WebSymbol name="chevron.right" className="web-menu-chevron" />
            ) : (
              item.systemImage && <WebSymbol name={item.systemImage} className="web-menu-symbol" />
            )}
          </button>
          {item.children && opened === item.id && (
            <div className="web-menu-submenu">
              <WebMenuItems items={item.children} onSelect={onSelect} />
            </div>
          )}
        </React.Fragment>
      ))}
    </>
  );
};

/** A glass button that opens a menu: UIMenu natively, a popover on the web. */
/** The web version of a menu: a glass button that opens a popover of items. */
export const WebMenu = ({
  label,
  title,
  symbol,
  prominent,
  items,
  onSelect,
}: {
  label: string;
  title?: string;
  symbol?: string;
  prominent?: boolean;
  items: readonly MenuItem[];
  onSelect: (id: string) => void;
}) => {
  const [open, setOpen] = React.useState(false);
  const select = (id: string) => {
    setOpen(false);
    onSelect(id);
  };
  return (
    <div className="web-menu">
      <button
        type="button"
        className={title ? "glass-pill" : "glass-circle"}
        data-prominent={prominent ? "" : undefined}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {symbol && <WebSymbol name={symbol} className="bar-symbol" />}
        {title}
      </button>
      {open && (
        <>
          <div className="web-menu-backdrop" onClick={() => setOpen(false)} />
          <div className="web-menu-popover" role="menu">
            <WebMenuItems items={items} onSelect={select} />
          </div>
        </>
      )}
    </div>
  );
};

export const Menu = ({
  label,
  title,
  symbol,
  prominent,
  items,
  onSelect,
}: {
  label: string;
  title?: string;
  symbol?: string;
  prominent?: boolean;
  items: readonly MenuItem[];
  onSelect: (id: string) => void;
}) => {
  const accent = useAccent();
  return (
    <NativeMenu
      title={title}
      systemImage={symbol}
      prominence={prominent ? "prominent" : "regular"}
      tint={prominent ? accent : undefined}
      items={items}
      native={useNativeEnabled()}
      accessibility={{ label }}
      onSelect={({ id }) => onSelect(id)}
    >
      <WebMenu
        label={label}
        title={title}
        symbol={symbol}
        prominent={prominent}
        items={items}
        onSelect={onSelect}
      />
    </NativeMenu>
  );
};

type TextFieldCommands = {
  focus: { args: undefined; result: void };
  blur: { args: undefined; result: void };
};

/** Moves the keyboard to a field, or puts it away, in either version. */
export type TextFieldHandle = { focus: () => void; blur: () => void };

/** A text field with the system keyboard; its text lives natively as state. */
export const TextField = ({
  label,
  text,
  placeholder,
  kind = "plain",
  onChange,
  onSubmit,
  onFocusChange,
  handle,
}: {
  label: string;
  text: string;
  placeholder?: string;
  kind?: TextFieldKind;
  onChange: (text: string) => void;
  onSubmit?: (text: string) => void;
  onFocusChange?: (focused: boolean) => void;
  handle?: React.Ref<TextFieldHandle>;
}) => {
  const input = React.useRef<HTMLInputElement>(null);
  const island = React.useRef<NativeHandle<TextFieldCommands>>(null);
  const native = useNativeEnabled();
  React.useImperativeHandle(handle, () => {
    const send = (name: keyof TextFieldCommands) => {
      if (native && island.current) void island.current.command(name).catch(() => {});
      else if (name === "focus") input.current?.focus();
      else input.current?.blur();
    };
    return { focus: () => send("focus"), blur: () => send("blur") };
  }, [native]);
  return (
    <NativeTextField
      ref={island}
      text={text}
      placeholder={placeholder}
      kind={kind}
      tint={useAccent()}
      native={native}
      accessibility={{ label }}
      onStateChange={({ text: next }) => next !== undefined && onChange(next)}
      onSubmit={({ text: submitted }) => onSubmit?.(submitted)}
      onFocusChange={({ focused }) => onFocusChange?.(focused)}
    >
      <input
        ref={input}
        className="web-field"
        aria-label={label}
        type={kind === "secure" ? "password" : kind === "email" ? "email" : "text"}
        inputMode={kind === "number" ? "decimal" : undefined}
        placeholder={placeholder}
        value={text}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit?.(text);
        }}
      />
    </NativeTextField>
  );
};
