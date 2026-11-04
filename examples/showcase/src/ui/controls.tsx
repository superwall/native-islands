import { useAccent, useNativeEnabled } from "../app/preferences";
import {
  NativeGlassButton,
  NativeSegmentedControl,
  NativeSymbol,
  NativeToggle,
  type SymbolWeight,
} from "../islands/definitions";
import { WebSymbol } from "./icons";

/**
 * Each control is a native island with its web version as the children: the
 * web version sets the island's size and place, and is what a browser, or
 * Settings with native islands off, shows.
 */

export const Toggle = ({
  label,
  isOn,
  onChange,
}: {
  label: string;
  isOn: boolean;
  onChange: (isOn: boolean) => void;
}) => (
  <NativeToggle isOn={isOn} native={useNativeEnabled()} onIsOnChange={onChange}>
    <button
      type="button"
      role="switch"
      className="web-toggle"
      aria-label={label}
      aria-checked={isOn}
      onClick={() => onChange(!isOn)}
    />
  </NativeToggle>
);

export const Segmented = ({
  segments,
  selectedIndex,
  onChange,
}: {
  segments: readonly string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}) => (
  <NativeSegmentedControl
    segments={segments}
    selectedIndex={selectedIndex}
    native={useNativeEnabled()}
    onSelectedIndexChange={onChange}
  >
    <div className="web-segmented" role="group">
      {segments.map((segment, index) => (
        <button
          key={segment}
          type="button"
          aria-pressed={index === selectedIndex}
          onClick={() => onChange(index)}
        >
          {segment}
        </button>
      ))}
    </div>
  </NativeSegmentedControl>
);

export const SystemSymbol = ({
  name,
  tint,
  weight,
  className,
}: {
  name: string;
  tint?: string;
  weight?: SymbolWeight;
  className?: string;
}) => {
  const accent = useAccent();
  return (
    <NativeSymbol name={name} tint={tint ?? accent} weight={weight} native={useNativeEnabled()}>
      <span className={className} style={{ color: tint ?? "var(--accent)" }}>
        <WebSymbol name={name} />
      </span>
    </NativeSymbol>
  );
};

/** The round glass button iOS 26 puts in navigation bars, such as Back. */
export const BarButton = ({
  symbol,
  label,
  glassGroup,
  onPress,
}: {
  symbol: string;
  label: string;
  glassGroup?: string;
  onPress: () => void;
}) => (
  <NativeGlassButton
    systemImage={symbol}
    glassGroup={glassGroup}
    native={useNativeEnabled()}
    accessibility={{ label }}
    onPress={onPress}
  >
    <button type="button" className="glass-circle" aria-label={label} onClick={onPress}>
      <WebSymbol name={symbol} className="bar-symbol" />
    </button>
  </NativeGlassButton>
);

/** A Liquid Glass button: regular glass, or prominent in the accent colour. */
export const Button = ({
  title,
  symbol,
  label,
  prominent,
  disabled,
  glassGroup,
  onPress,
}: {
  title?: string;
  symbol?: string;
  label?: string;
  prominent?: boolean;
  disabled?: boolean;
  glassGroup?: string;
  onPress: () => void;
}) => {
  const accent = useAccent();
  return (
    <NativeGlassButton
      title={title}
      systemImage={symbol}
      prominence={prominent ? "prominent" : "regular"}
      tint={prominent ? accent : undefined}
      disabled={disabled}
      glassGroup={glassGroup}
      native={useNativeEnabled()}
      accessibility={{ label: label ?? title }}
      onPress={onPress}
    >
      <button
        type="button"
        className={title ? "glass-pill" : "glass-circle"}
        data-prominent={prominent ? "" : undefined}
        aria-label={label ?? title}
        disabled={disabled}
        onClick={onPress}
      >
        {symbol && <WebSymbol name={symbol} className="bar-symbol" />}
        {title}
      </button>
    </NativeGlassButton>
  );
};
