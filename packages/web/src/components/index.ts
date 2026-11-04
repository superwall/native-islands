/**
 * Ready-made native islands for the controls a page needs, each with a web
 * version. Register them in the app with `NativeIslandsComponents.register()`
 * and import `native-islands/components.css` for the web versions.
 */
export { CloseButton, GlassButton, Menu } from "./buttons";
export {
  ColorPicker,
  DatePicker,
  Picker,
  SegmentedControl,
  Slider,
  Stepper,
  TextField,
  Toggle,
  type TextFieldHandle,
} from "./controls";
export { Gauge, SymbolEffect, SystemSymbol } from "./indicators";
export {
  NativeCloseButton,
  NativeColorPicker,
  NativeDatePicker,
  NativeGauge,
  NativeGlassButton,
  NativeMenu,
  NativeMenuPicker,
  NativeSegmentedControl,
  NativeSlider,
  NativeStepper,
  NativeSymbol,
  NativeSymbolEffect,
  NativeTextField,
  NativeToggle,
  NativeWheelPicker,
  type DateComponents,
  type DatePickerStyle,
  type GaugeStyle,
  type MenuItem,
  type PickerStyle,
  type Prominence,
  type SymbolEffectName,
  type SymbolWeight,
  type TextFieldCommands,
  type TextFieldKind,
} from "./specs";
