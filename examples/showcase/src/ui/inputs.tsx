import type * as React from "react";
import {
  ColorPicker,
  DatePicker as PackageDatePicker,
  Menu as PackageMenu,
  Picker,
  Slider as PackageSlider,
  Stepper as PackageStepper,
  TextField as PackageTextField,
  type DateComponents,
  type DatePickerStyle,
  type MenuItem,
  type TextFieldHandle,
  type TextFieldKind,
} from "native-islands/components";
import { useAccent, useNativeEnabled } from "../app/preferences";
import { WebSymbol } from "./icons";

export type { TextFieldHandle };

/**
 * The value controls of the Components tab: the package's components with the
 * accent colour, the Native Islands setting and the showcase's symbol drawings.
 */

export const Slider = ({
  label,
  value,
  minimum,
  maximum,
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
  <PackageSlider
    label={label}
    value={value}
    minimum={minimum}
    maximum={maximum}
    step={step}
    minimumSymbol={minimumSymbol}
    maximumSymbol={maximumSymbol}
    minimumIcon={minimumSymbol && <WebSymbol name={minimumSymbol} />}
    maximumIcon={maximumSymbol && <WebSymbol name={maximumSymbol} />}
    tint={useAccent()}
    native={useNativeEnabled()}
    onChange={onChange}
  />
);

export const Stepper = (props: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  step?: number;
  onChange: (value: number) => void;
}) => <PackageStepper {...props} native={useNativeEnabled()} />;

/** A picker that shows its value and opens a menu of the options. */
export const MenuPicker = (props: {
  label: string;
  options: readonly string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}) => <Picker {...props} style="menu" tint={useAccent()} native={useNativeEnabled()} />;

/** A spinning wheel of options, as UIPickerView draws it. */
export const WheelPicker = (props: {
  label: string;
  options: readonly string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}) => <Picker {...props} style="wheel" native={useNativeEnabled()} />;

/**
 * A date or time picker: `compact` is the pill that opens a calendar,
 * `graphical` the calendar itself and `wheel` the spinning wheels.
 */
export const DatePicker = (props: {
  label: string;
  /** Local time as `yyyy-MM-ddTHH:mm`. */
  date: string;
  components?: DateComponents;
  style?: DatePickerStyle;
  onChange: (date: string) => void;
}) => <PackageDatePicker {...props} tint={useAccent()} native={useNativeEnabled()} />;

/** The system colour well, which opens the colour picker sheet. */
export const ColorWell = (props: {
  label: string;
  /** `#rrggbb` */
  color: string;
  onChange: (color: string) => void;
}) => <ColorPicker {...props} native={useNativeEnabled()} />;

type MenuProps = {
  label: string;
  title?: string;
  symbol?: string;
  prominent?: boolean;
  items: readonly MenuItem[];
  onSelect: (id: string) => void;
};

const MenuOf = ({
  label,
  title,
  symbol,
  prominent,
  items,
  onSelect,
  native,
}: MenuProps & { native: boolean }): React.ReactElement => {
  const accent = useAccent();
  return (
    <PackageMenu
      label={label}
      title={title}
      systemImage={symbol}
      icon={symbol && <WebSymbol name={symbol} />}
      prominence={prominent ? "prominent" : "regular"}
      tint={prominent ? accent : undefined}
      items={items}
      native={native}
      onSelect={onSelect}
    />
  );
};

/** A glass button that opens a menu: UIMenu natively, a popover on the web. */
export const Menu = (props: MenuProps) => <MenuOf {...props} native={useNativeEnabled()} />;

/** The web version of a menu alone, for inside another island's web version. */
export const WebMenu = (props: MenuProps) => <MenuOf {...props} native={false} />;

/** A text field with the system keyboard; its text lives natively as state. */
export const TextField = (props: {
  label: string;
  text: string;
  placeholder?: string;
  kind?: TextFieldKind;
  onChange: (text: string) => void;
  onSubmit?: (text: string) => void;
  onFocusChange?: (focused: boolean) => void;
  handle?: React.Ref<TextFieldHandle>;
}) => <PackageTextField {...props} tint={useAccent()} native={useNativeEnabled()} />;
