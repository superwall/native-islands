import * as React from "react";
import type { NativeCommonProps, NativeHandle } from "../react/components/Native";
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
import { clamp, cssVariables, fractionOf, stepped } from "./geometry";
import { Glyph } from "./glyphs";
import {
  NativeColorPicker,
  NativeDatePicker,
  NativeMenuPicker,
  NativeSegmentedControl,
  NativeSlider,
  NativeStepper,
  NativeTextField,
  NativeToggle,
  NativeWheelPicker,
  type DateComponents,
  type DatePickerStyle,
  type PickerStyle,
  type TextFieldCommands,
  type TextFieldKind,
} from "./specs";

/**
 * The controls whose value a person changes. Each takes its value as a prop
 * and reports a change through `onChange`, from the native view or from its
 * web version, so the page keeps the value in one place.
 */

type Labelled = NativeCommonProps & {
  /** The accessibility label, for both versions. */
  label: string;
};

const accessibilityOf = (common: Labelled, value?: string) =>
  common.accessibility ?? { label: common.label, value };

/** A switch, sized by the native one. */
export const Toggle = ({
  isOn,
  tint,
  disabled,
  onChange,
  children,
  label,
  accessibility,
  ...common
}: Labelled & {
  isOn: boolean;
  tint?: string;
  disabled?: boolean;
  onChange: (isOn: boolean) => void;
}) => (
  <NativeToggle
    isOn={isOn}
    tint={tint}
    disabled={disabled}
    accessibility={accessibilityOf({ label, accessibility })}
    onIsOnChange={onChange}
    {...common}
  >
    {children ?? (
      <button
        type="button"
        role="switch"
        className="ni-toggle"
        style={cssVariables({ "--ni-tint": tint })}
        aria-label={label}
        aria-checked={isOn}
        disabled={disabled}
        onClick={() => onChange(!isOn)}
      />
    )}
  </NativeToggle>
);

/** A segmented control; it fills the width its web version is given. */
export const SegmentedControl = ({
  segments,
  selectedIndex,
  disabled,
  glassGroup,
  onChange,
  children,
  label,
  accessibility,
  ...common
}: Labelled & {
  segments: readonly string[];
  selectedIndex: number;
  disabled?: boolean;
  glassGroup?: string;
  onChange: (index: number) => void;
}) => (
  <NativeSegmentedControl
    segments={segments}
    selectedIndex={selectedIndex}
    disabled={disabled}
    glassGroup={glassGroup}
    accessibility={accessibilityOf({ label, accessibility }, segments[selectedIndex])}
    onSelectedIndexChange={onChange}
    {...common}
  >
    {children ?? (
      <div className="ni-segmented" role="group" aria-label={label}>
        {segments.map((segment, index) => (
          <button
            key={segment}
            type="button"
            aria-pressed={index === selectedIndex}
            disabled={disabled}
            onClick={() => onChange(index)}
          >
            {segment}
          </button>
        ))}
      </div>
    )}
  </NativeSegmentedControl>
);

/** A slider; it fills the width its web version is given. */
export const Slider = ({
  value,
  minimum = 0,
  maximum = 1,
  step,
  minimumSymbol,
  maximumSymbol,
  minimumIcon,
  maximumIcon,
  tint,
  disabled,
  onChange,
  children,
  label,
  accessibility,
  ...common
}: Labelled & {
  value: number;
  minimum?: number;
  maximum?: number;
  step?: number;
  /** SF Symbols drawn natively at either end. */
  minimumSymbol?: string;
  maximumSymbol?: string;
  /** The web version's drawings of the symbols. */
  minimumIcon?: React.ReactNode;
  maximumIcon?: React.ReactNode;
  tint?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) => (
  <NativeSlider
    value={value}
    minimum={minimum}
    maximum={maximum}
    step={step}
    minimumSymbol={minimumSymbol}
    maximumSymbol={maximumSymbol}
    tint={tint}
    disabled={disabled}
    accessibility={accessibilityOf({ label, accessibility })}
    onValueChange={onChange}
    {...common}
  >
    {children ?? (
      <div className="ni-slider">
        {minimumIcon && <span className="ni-slider-icon">{minimumIcon}</span>}
        <input
          type="range"
          aria-label={label}
          min={minimum}
          max={maximum}
          step={step ?? "any"}
          value={value}
          disabled={disabled}
          style={cssVariables({
            "--ni-fill": `${fractionOf(value, minimum, maximum) * 100}%`,
            "--ni-tint": tint,
          })}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {maximumIcon && <span className="ni-slider-icon">{maximumIcon}</span>}
      </div>
    )}
  </NativeSlider>
);

/** A minus and plus stepper. */
export const Stepper = ({
  value,
  minimum,
  maximum,
  step = 1,
  disabled,
  onChange,
  children,
  label,
  accessibility,
  ...common
}: Labelled & {
  value: number;
  minimum: number;
  maximum: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) => (
  <NativeStepper
    value={value}
    minimum={minimum}
    maximum={maximum}
    step={step}
    disabled={disabled}
    accessibility={accessibilityOf({ label, accessibility }, String(value))}
    onValueChange={onChange}
    {...common}
  >
    {children ?? (
      <div className="ni-stepper" role="group" aria-label={label}>
        <button
          type="button"
          aria-label="Decrement"
          disabled={disabled || value <= minimum}
          onClick={() => onChange(stepped(value, -step, minimum, maximum))}
        >
          <Glyph name="minus" />
        </button>
        <button
          type="button"
          aria-label="Increment"
          disabled={disabled || value >= maximum}
          onClick={() => onChange(stepped(value, step, minimum, maximum))}
        >
          <Glyph name="plus" />
        </button>
      </div>
    )}
  </NativeStepper>
);

export const WHEEL_ROW = 34;
export const WHEEL_HEIGHT = 216;
const WHEEL_SETTLE_MS = 120;

/** A list that snaps a row to the band in its middle, as a picker wheel does. */
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
  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const index = clamp(Math.round(element.scrollTop / WHEEL_ROW), 0, options.length - 1);
      if (index !== selectedIndex) onChange(index);
    }, WHEEL_SETTLE_MS);
  };
  return (
    <div
      ref={list}
      className="ni-wheel"
      role="listbox"
      aria-label={label}
      style={{ height: WHEEL_HEIGHT, paddingBlock: (WHEEL_HEIGHT - WHEEL_ROW) / 2 }}
      onScroll={onScroll}
    >
      {options.map((option, index) => (
        <div
          key={option}
          className="ni-wheel-row"
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

/**
 * A picker of options: `menu` shows the current option and opens a menu,
 * `wheel` is the spinning wheel.
 */
export const Picker = ({
  options,
  selectedIndex,
  style = "menu",
  tint,
  onChange,
  children,
  label,
  accessibility,
  ...common
}: Labelled & {
  options: readonly string[];
  selectedIndex: number;
  style?: PickerStyle;
  tint?: string;
  onChange: (index: number) => void;
}) => {
  const Island = style === "wheel" ? NativeWheelPicker : NativeMenuPicker;
  const web =
    style === "wheel" ? (
      <div className="ni-wheel-frame">
        <WebWheel
          label={label}
          options={options}
          selectedIndex={selectedIndex}
          onChange={onChange}
        />
      </div>
    ) : (
      <label className="ni-menu-picker" style={cssVariables({ "--ni-tint": tint })}>
        <span>{options[selectedIndex]}</span>
        <Glyph name="chevron.up.chevron.down" />
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
    );
  return (
    <Island
      options={options}
      selectedIndex={selectedIndex}
      style={style}
      tint={tint}
      accessibility={accessibilityOf({ label, accessibility }, options[selectedIndex])}
      onSelectedIndexChange={onChange}
      {...common}
    >
      {children ?? web}
    </Island>
  );
};

const FALLBACK_DATE: LocalDate = { year: 2026, month: 1, day: 1, hour: 9, minute: 0 };

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));

/** The month shown starts at `date`'s; key it by the date so a new date shows its month. */
const WebCalendar = ({
  date,
  tint,
  onChange,
}: {
  date: LocalDate;
  tint?: string;
  onChange: (date: LocalDate) => void;
}) => {
  const [shown, setShown] = React.useState(date);
  const selected = shown.year === date.year && shown.month === date.month ? date.day : undefined;
  return (
    <div className="ni-calendar" style={cssVariables({ "--ni-tint": tint })}>
      <div className="ni-calendar-head">
        <span className="ni-calendar-month">{describeMonth(shown)}</span>
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setShown(shiftMonth(shown, -1))}
        >
          <Glyph name="chevron.left" />
        </button>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setShown(shiftMonth(shown, 1))}
        >
          <Glyph name="chevron.right" />
        </button>
      </div>
      <div className="ni-calendar-grid" role="grid">
        {WEEKDAYS.map((day, index) => (
          <span key={index} className="ni-calendar-weekday">
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
                className="ni-calendar-day"
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
  date,
  components = "date",
  style = "compact",
  tint,
  onChange,
  children,
  label,
  accessibility,
  ...common
}: Labelled & {
  /** Local time as `yyyy-MM-ddTHH:mm`. */
  date: string;
  components?: DateComponents;
  style?: DatePickerStyle;
  tint?: string;
  onChange: (date: string) => void;
}) => {
  const parsed = parseLocal(date) ?? FALLBACK_DATE;
  const value = formatLocal(parsed);
  const change = (next: LocalDate) => onChange(formatLocal(next));
  let web: React.ReactNode;
  if (style === "graphical") {
    web = <WebCalendar key={value} date={parsed} tint={tint} onChange={change} />;
  } else if (style === "wheel") {
    web = (
      <div
        className="ni-wheel-frame ni-wheel-frame--split"
        style={cssVariables({ "--ni-tint": tint })}
      >
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
      <label className="ni-date-pill" style={cssVariables({ "--ni-tint": tint })}>
        <span>{time ? describeTime(parsed) : describeDate(parsed)}</span>
        <input
          type={time ? "time" : "date"}
          aria-label={label}
          value={time ? value.slice(11, 16) : value.slice(0, 10)}
          onChange={(event) => {
            const next = time
              ? `${value.slice(0, 10)}T${event.target.value}`
              : `${event.target.value}${value.slice(10)}`;
            if (parseLocal(next)) onChange(next);
          }}
        />
      </label>
    );
  }
  return (
    <NativeDatePicker
      date={value}
      components={components}
      style={style}
      tint={tint}
      accessibility={accessibilityOf({ label, accessibility })}
      onDateChange={onChange}
      {...common}
    >
      {children ?? web}
    </NativeDatePicker>
  );
};

/** The system colour well, which opens the colour picker. */
export const ColorPicker = ({
  color,
  onChange,
  children,
  label,
  accessibility,
  ...common
}: Labelled & {
  /** `#rrggbb` */
  color: string;
  onChange: (color: string) => void;
}) => (
  <NativeColorPicker
    color={color}
    accessibility={accessibilityOf({ label, accessibility })}
    onColorChange={onChange}
    {...common}
  >
    {children ?? (
      <label className="ni-color-well" style={cssVariables({ "--ni-well": color })}>
        <input
          type="color"
          aria-label={label}
          value={color}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    )}
  </NativeColorPicker>
);

/** Moves the keyboard to a text field, or puts it away, in whichever version shows. */
export type TextFieldHandle = { focus: () => void; blur: () => void };

/** A text field with the system keyboard. */
export const TextField = ({
  text,
  placeholder,
  kind = "plain",
  submitLabel,
  tint,
  onChange,
  onSubmit,
  onFocusChange,
  handle,
  children,
  label,
  accessibility,
  ...common
}: Labelled & {
  text: string;
  placeholder?: string;
  kind?: TextFieldKind;
  submitLabel?: "done" | "search";
  tint?: string;
  onChange: (text: string) => void;
  onSubmit?: (text: string) => void;
  onFocusChange?: (focused: boolean) => void;
  handle?: React.Ref<TextFieldHandle>;
}) => {
  const input = React.useRef<HTMLInputElement>(null);
  const island = React.useRef<NativeHandle<TextFieldCommands>>(null);
  React.useImperativeHandle(handle, () => {
    const web = { focus: () => input.current?.focus(), blur: () => input.current?.blur() };
    const send = (name: keyof TextFieldCommands) =>
      void island.current?.command(name).catch(() => web[name]());
    return { focus: () => send("focus"), blur: () => send("blur") };
  }, []);
  return (
    <NativeTextField
      ref={island}
      text={text}
      placeholder={placeholder}
      kind={kind}
      submitLabel={submitLabel}
      tint={tint}
      accessibility={accessibilityOf({ label, accessibility })}
      onTextChange={onChange}
      onSubmit={({ text: submitted }) => onSubmit?.(submitted)}
      onFocusChange={({ focused }) => onFocusChange?.(focused)}
      {...common}
    >
      {children ?? (
        <input
          ref={input}
          className="ni-field"
          style={cssVariables({ "--ni-tint": tint })}
          aria-label={label}
          type={kind === "secure" ? "password" : kind === "email" ? "email" : "text"}
          inputMode={kind === "number" ? "decimal" : undefined}
          enterKeyHint={submitLabel}
          placeholder={placeholder}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit?.(text);
          }}
        />
      )}
    </NativeTextField>
  );
};
