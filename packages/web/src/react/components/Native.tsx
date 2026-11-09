import * as React from "react";
import {
  ISLAND_COMPONENT_ATTRIBUTE,
  ISLAND_CONCEALED_ATTRIBUTE,
  ISLAND_HANDOFF_ATTRIBUTE,
  ISLAND_ID_ATTRIBUTE,
  ISLAND_MODE_ATTRIBUTE,
  ISLAND_REUSING_ATTRIBUTE,
  ISLAND_SHOWN_ATTRIBUTE,
} from "../../layout/attributes";
import type { TNativeAccessibility, TNativeSize } from "../../protocol/schemas";
import { useNativeIsland, type NativeSizing } from "../hooks/useNativeIsland";

export type NativeValue =
  | string
  | number
  | boolean
  | null
  | readonly NativeValue[]
  | { readonly [key: string]: NativeValue | undefined };

export type NativeCommandOptions = {
  timeoutMs?: number;
};

export type NativeHandle<
  TCommands = Record<string, { args: unknown; result: unknown }>,
  TState = Record<string, unknown>,
> = {
  command: <K extends keyof TCommands & string>(
    name: K,
    args?: TCommands[K] extends { args: infer A } ? A : unknown,
    options?: NativeCommandOptions,
  ) => Promise<TCommands[K] extends { result: infer R } ? R : unknown>;
  state: () => Readonly<Partial<TState>> | undefined;
};

export type NativeAccessibility = TNativeAccessibility;

export type NativeCommonProps = {
  children?: React.ReactNode;
  islandId?: string;
  native?: boolean;
  accessibility?: NativeAccessibility;
};

export type NativeProps = NativeCommonProps & {
  component: string;
  version?: number;
  props?: Readonly<Record<string, NativeValue | undefined>>;
  sizing?: NativeSizing;
  colorProps?: readonly string[];
  onEvent?: (name: string, payload: unknown) => void;
  onStateChange?: (
    state: Readonly<Record<string, unknown>>,
    changed: Readonly<Record<string, unknown>>,
  ) => void;
  onRequest?: (name: string, payload: unknown) => unknown;
  ref?: React.Ref<NativeHandle>;
};

export const CONCEAL_AFTER_MS = 150;

const useConcealed = (shown: boolean): boolean => {
  const [concealed, setConcealed] = React.useState(false);
  React.useEffect(() => {
    if (!shown) {
      setConcealed(false);
      return;
    }
    const timer = setTimeout(() => setConcealed(true), CONCEAL_AFTER_MS);
    return () => clearTimeout(timer);
  }, [shown]);
  return shown && concealed;
};

const EMPTY: Readonly<Record<string, never>> = {};

const NONE: readonly string[] = [];

const styleFor = (sizing: NativeSizing, size: TNativeSize | undefined) => {
  const style: React.CSSProperties = { display: "contents" };
  // The page's box sets the width the host measures at, so it is a block from
  // the start; the web version sets its height until the host reports one.
  if (sizing === "nativeHeight") {
    style.display = "block";
    if (size) {
      style.height = size.height;
      style.overflow = "hidden";
    }
  } else if (sizing === "native" && size) {
    style.display = "inline-block";
    style.width = size.width;
    style.height = size.height;
    style.overflow = "hidden";
    style.verticalAlign = "middle";
  }
  return style;
};

export const Native = ({
  component,
  version = 1,
  props = EMPTY,
  sizing = "web",
  colorProps = NONE,
  islandId,
  native = true,
  accessibility,
  onEvent,
  onStateChange,
  onRequest,
  ref,
  children,
}: NativeProps) => {
  const wrapper = React.useRef<HTMLSpanElement>(null);
  const handleEvent = React.useCallback(
    (name: string, payload: unknown) => onEvent?.(name, payload),
    [onEvent],
  );
  const { id, mode, size, handoff, anchorType, reusing, command, state, ...sent } = useNativeIsland(
    wrapper,
    {
      component,
      version,
      props,
      sizing,
      colorProps,
      islandId,
      enabled: native,
      accessibility,
      onEvent: handleEvent,
      onState: onStateChange,
      onRequest,
    },
  );
  React.useImperativeHandle(ref, () => ({ command, state }), [command, state]);
  const nativeSizing = mode === "web" ? "web" : sent.sizing;
  const shown = mode === "native" && handoff === undefined;
  const concealed = useConcealed(shown);
  // A screen-anchored island sits in UIKit's own layer, where VoiceOver
  // reaches the native view; its web copy would be read a second time.
  const hidden = shown && anchorType === "screen";
  return (
    <span
      ref={wrapper}
      {...{
        [ISLAND_COMPONENT_ATTRIBUTE]: component,
        [ISLAND_ID_ATTRIBUTE]: native ? id : undefined,
        [ISLAND_MODE_ATTRIBUTE]: mode,
        [ISLAND_HANDOFF_ATTRIBUTE]: mode === "web" ? undefined : handoff,
        [ISLAND_SHOWN_ATTRIBUTE]: shown ? "" : undefined,
        [ISLAND_REUSING_ATTRIBUTE]:
          mode !== "web" && reusing && handoff === undefined ? "" : undefined,
        [ISLAND_CONCEALED_ATTRIBUTE]: concealed ? "" : undefined,
      }}
      aria-hidden={hidden ? true : undefined}
      style={styleFor(nativeSizing, nativeSizing === "web" ? undefined : size)}
    >
      {children}
    </span>
  );
};
