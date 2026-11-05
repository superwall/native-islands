import { CloseButton, GlassButton, SegmentedControl, Toggle } from "native-islands/components";

/** The package's components, each with this gallery's own web version as children. */

type GlassProps = {
  title: string;
  prominence?: "regular" | "prominent";
  tint?: string;
  glassGroup?: string;
  disabled?: boolean;
  block?: boolean;
  islandId?: string;
  native?: boolean;
  onPress?: () => void;
};

export const Glass = ({
  title,
  prominence = "regular",
  tint,
  block,
  onPress,
  ...rest
}: GlassProps) => (
  <GlassButton title={title} prominence={prominence} tint={tint} onPress={onPress} {...rest}>
    <button
      type="button"
      className={block ? "glass glass--block" : "glass"}
      data-prominence={prominence}
      style={tint ? { "--tint": tint } : undefined}
      disabled={rest.disabled}
      onClick={onPress}
    >
      {title}
    </button>
  </GlassButton>
);

const Cross = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="m5.5 5.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

export const Close = ({ onPress, islandId }: { onPress: () => void; islandId?: string }) => (
  <CloseButton onPress={onPress} islandId={islandId}>
    <button type="button" className="glass glass--icon" aria-label="Close" onClick={onPress}>
      <Cross />
    </button>
  </CloseButton>
);

export const Switch = ({
  label,
  isOn,
  onChange,
}: {
  label: string;
  isOn: boolean;
  onChange: (isOn: boolean) => void;
}) => {
  return (
    <Toggle label={label} isOn={isOn} tint="var(--accent)" onChange={onChange}>
      <button
        type="button"
        role="switch"
        className="switch"
        aria-label={label}
        aria-checked={isOn}
        onClick={() => onChange(!isOn)}
      />
    </Toggle>
  );
};

export const Segments = ({
  segments,
  selectedIndex,
  onChange,
}: {
  segments: readonly string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}) => {
  return (
    <SegmentedControl
      label={segments.join(", ")}
      segments={segments}
      selectedIndex={selectedIndex}
      onChange={onChange}
    >
      <div className="segments" role="group">
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
    </SegmentedControl>
  );
};
