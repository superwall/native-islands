import { GlassButton, SystemSymbol } from "./defaults";
import type { ReactNode } from "react";

const PATHS: Record<string, ReactNode> = {
  "backward.fill": <path d="M11 6 3 12l8 6V6Zm10 0-8 6 8 6V6Z" fill="currentColor" />,
  "forward.fill": <path d="m13 6 8 6-8 6V6ZM3 6l8 6-8 6V6Z" fill="currentColor" />,
  "play.fill": <path d="M7 4.5v15l13-7.5-13-7.5Z" fill="currentColor" />,
  "pause.fill": <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" />,
  magnifyingglass: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </g>
  ),
  "location.fill": <path d="M21 3 3 10.5l7.5 3 3 7.5L21 3Z" fill="currentColor" />,
  "square.3.layers.3d": (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </g>
  ),
  bookmark: <path d="M6 3h12v18l-6-4-6 4V3Z" fill="none" stroke="currentColor" strokeWidth="1.8" />,
  airplayaudio: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M6 15a8 8 0 1 1 12 0" />
      <path d="M9 13a4 4 0 1 1 6 0" />
      <path d="m12 15-4 6h8l-4-6Z" fill="currentColor" />
    </g>
  ),
  "list.bullet": (
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth="3" />
    </g>
  ),
  "quote.bubble": (
    <path
      d="M4 5h16v11H9l-5 4V5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  ),
  "heart.fill": (
    <path d="M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9Z" fill="currentColor" />
  ),
  ellipsis: (
    <g fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </g>
  ),
  sparkles: (
    <path
      d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Zm7 12 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"
      fill="currentColor"
    />
  ),
  "icloud.fill": (
    <path d="M7 19a5 5 0 0 1-.5-10A7 7 0 0 1 20 11a4 4 0 0 1-1 8H7Z" fill="currentColor" />
  ),
  "bolt.fill": <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor" />,
  "lock.shield.fill": (
    <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3Z" fill="currentColor" />
  ),
  "bell.fill": (
    <path
      d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6Zm-2 15a2 2 0 0 0 4 0h-4Z"
      fill="currentColor"
    />
  ),
  "moon.fill": <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" fill="currentColor" />,
  wifi: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 9a13 13 0 0 1 18 0M6 12.5a8 8 0 0 1 12 0M9 16a3.5 3.5 0 0 1 6 0" />
    </g>
  ),
  "figure.walk": (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="13" cy="4" r="1.5" fill="currentColor" />
      <path d="m10 21 2-6 3 3v3M9 10l3-3 3 3 3 1M12 7l-1 5" />
    </g>
  ),
  checkmark: (
    <path
      d="m5 12 4.5 4.5L19 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  ),
};

/** The web version of an SF Symbol: an inline icon drawn the same size. */
export const Icon = ({ name, size = 20 }: { name: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    {PATHS[name]}
  </svg>
);

/** An SF Symbol, native where the host offers it and an inline icon everywhere else. */
export const SFSymbol = ({
  name,
  tint,
  size = 20,
  weight,
}: {
  name: string;
  tint?: string;
  size?: number;
  weight?: "regular" | "medium" | "semibold" | "bold";
}) => (
  <SystemSymbol name={name} tint={tint} weight={weight} pointSize={size}>
    <span className="symbol" style={{ color: tint, width: size, height: size }}>
      <Icon name={name} size={size} />
    </span>
  </SystemSymbol>
);

/** A round glass button with an SF Symbol in it. */
export const IconGlass = ({
  symbol,
  label,
  onPress,
  glassGroup,
  prominent,
  tint,
  islandId,
  size = 44,
}: {
  symbol: string;
  label: string;
  onPress?: () => void;
  glassGroup?: string;
  prominent?: boolean;
  tint?: string;
  islandId?: string;
  size?: number;
}) => (
  <GlassButton
    systemImage={symbol}
    prominence={prominent ? "prominent" : "regular"}
    tint={tint}
    glassGroup={glassGroup}
    islandId={islandId}
    accessibility={{ label }}
    onPress={onPress}
  >
    <button
      type="button"
      className="glass glass--icon"
      data-prominence={prominent ? "prominent" : "regular"}
      aria-label={label}
      style={{
        width: size,
        minHeight: size,
        ...(tint ? { "--tint": tint } : {}),
      }}
      onClick={onPress}
    >
      <Icon name={symbol} size={Math.round(size * 0.45)} />
    </button>
  </GlassButton>
);
