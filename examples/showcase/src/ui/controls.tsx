import {
  CloseButton as PackageCloseButton,
  GlassButton,
  SegmentedControl,
  SystemSymbol as PackageSymbol,
  Toggle as PackageToggle,
  type SymbolWeight,
} from "native-islands/components";
import { useAccent, useNativeEnabled } from "../app/preferences";
import { WebSymbol } from "./icons";

/**
 * The showcase's buttons and switches: the package's components with the
 * accent colour, the Native Islands setting and the showcase's symbol drawings.
 */

export const Toggle = ({
  label,
  isOn,
  onChange,
}: {
  label: string;
  isOn: boolean;
  onChange: (isOn: boolean) => void;
}) => <PackageToggle label={label} isOn={isOn} native={useNativeEnabled()} onChange={onChange} />;

export const Segmented = ({
  segments,
  selectedIndex,
  onChange,
}: {
  segments: readonly string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}) => (
  <SegmentedControl
    label={segments.join(", ")}
    segments={segments}
    selectedIndex={selectedIndex}
    native={useNativeEnabled()}
    onChange={onChange}
  />
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
    <PackageSymbol name={name} tint={tint ?? accent} weight={weight} native={useNativeEnabled()}>
      <span className={className}>
        <WebSymbol name={name} />
      </span>
    </PackageSymbol>
  );
};

/** The round glass close button of a sheet, with the system's cross. */
export const CloseButton = ({ onPress }: { onPress: () => void }) => (
  <PackageCloseButton native={useNativeEnabled()} onPress={onPress}>
    <button type="button" className="glass-circle" aria-label="Close" onClick={onPress}>
      <WebSymbol name="xmark" />
    </button>
  </PackageCloseButton>
);

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
  <GlassButton
    systemImage={symbol}
    icon={<WebSymbol name={symbol} />}
    label={label}
    glassGroup={glassGroup}
    native={useNativeEnabled()}
    onPress={onPress}
  />
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
    <GlassButton
      title={title}
      systemImage={symbol}
      icon={symbol && <WebSymbol name={symbol} />}
      label={label}
      prominence={prominent ? "prominent" : "regular"}
      tint={prominent ? accent : undefined}
      disabled={disabled}
      glassGroup={glassGroup}
      native={useNativeEnabled()}
      onPress={onPress}
    />
  );
};
