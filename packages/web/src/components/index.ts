/**
 * Ready-made native islands for the controls a page needs, each with a web
 * version. Register them in the app with `NativeIslandsComponents.register()`
 * (and `NativeIslandsMaps` or `NativeIslandsCharts` for the map and the chart)
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
export { Chart } from "./chart";
export { Camera, MapView, PhotoPicker, Video, type CameraHandle, type VideoHandle } from "./media";
export { HapticButton, Permission, ShareButton, Tip, type TipHandle } from "./system";
export {
  NativeCamera,
  NativeChart,
  NativeHapticButton,
  NativeMap,
  NativePermission,
  NativePhotoPicker,
  NativeShareButton,
  NativeTip,
  NativeVideo,
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
  type CameraState,
  type ChartKind,
  type ChartSelection,
  type ChartSeries,
  type ChartX,
  type ChartXAxis,
  type ChartYAxis,
  type HapticFeedback,
  type MapPlace,
  type MapRegion,
  type MapStyle,
  type PermissionKind,
  type PermissionStatus,
  type TipAction,
  type TipArrowEdge,
  type VideoCommands,
  type VideoStatus,
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
