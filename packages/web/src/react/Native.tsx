import * as React from "react";
import {
  ISLAND_COMPONENT_ATTRIBUTE,
  ISLAND_CONCEALED_ATTRIBUTE,
  ISLAND_HANDOFF_ATTRIBUTE,
  ISLAND_ID_ATTRIBUTE,
  ISLAND_MODE_ATTRIBUTE,
  ISLAND_SHOWN_ATTRIBUTE,
} from "../attributes";
import type { TNativeAccessibility } from "../schemas";
import { useNativeIsland, type NativeSizing } from "./useNativeIsland";

/** A value a native component can receive: anything JSON can carry. */
export type NativeValue =
  | string
  | number
  | boolean
  | null
  | readonly NativeValue[]
  | { readonly [key: string]: NativeValue | undefined };

/** Options for one command. */
export type NativeCommandOptions = {
  /** How long to wait for the host's answer before rejecting. Default: `5000` ms. */
  timeoutMs?: number;
};

/**
 * Talks to a mounted native view. `command` resolves with the view's answer and
 * rejects with a `NativeCommandError` when the host takes no commands, the view
 * is not showing, the arguments are not JSON, the view refuses or does not
 * answer in time, or it unmounts first. `state` returns the last state native
 * reported, or `undefined` while there is none.
 */
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

/** The handle `<Native>` gives its `ref`: commands and state, untyped. */
export type NativeIslandHandle = {
  command: (name: string, args?: unknown, options?: NativeCommandOptions) => Promise<unknown>;
  state: () => Readonly<Record<string, unknown>> | undefined;
};

/** What VoiceOver reads for a native component. Default: derived from the web children (their `aria-label`, `alt` or text, and the role of the first one). */
export type NativeAccessibility = TNativeAccessibility;

export type NativeCommonProps = {
  /**
   * The web version: rendered first, kept in the layout, and shown wherever the
   * native component is not (hosts without islands, plain browsers, and any
   * moment the native view cannot follow it). Default: nothing.
   */
  children?: React.ReactNode;
  /** A stable id for the island, unique on the page. Default: generated per instance. */
  islandId?: string;
  /** `false` always renders the web version. Default: `true`. */
  native?: boolean;
  /** Overrides what VoiceOver reads for the native view. Default: derived from the children. */
  accessibility?: NativeAccessibility;
};

export type NativeProps = NativeCommonProps & {
  /** The name the app registered the component under. */
  component: string;
  /** The lowest registered version this page works with. Default: `1`. */
  version?: number;
  /** Plain values handed to the native component. Strings may use `var(--token)`. Default: `{}`. */
  props?: Readonly<Record<string, NativeValue | undefined>>;
  /** Who sets the size: the web children (`"web"`) or the native view (`"native"`). Default: `"web"`. */
  sizing?: NativeSizing;
  /** Prop names holding colours, sent as `rgb()`/`rgba()`. Default: none. */
  colorProps?: readonly string[];
  /** Called with every event the native component sends, such as `"press"`. Default: none. */
  onEvent?: (name: string, payload: unknown) => void;
  /** Called whenever native changes its state, with all of it and with what changed. Default: none. */
  onStateChange?: (
    state: Readonly<Record<string, unknown>>,
    changed: Readonly<Record<string, unknown>>,
  ) => void;
  /** Answers a request native makes; may return a promise. Throw to refuse it. Default: none, so every request fails. */
  onRequest?: (name: string, payload: unknown) => unknown;
  /** Receives a handle that sends commands to the native view and reads its state. Default: none. */
  ref?: React.Ref<NativeIslandHandle>;
};

/** How long the web version takes to fade out before it is hidden from taps, focus and VoiceOver. */
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

const styleFor = (size: { width: number; height: number } | undefined) => {
  const style: React.CSSProperties = { display: "contents" };
  if (size) {
    style.display = "inline-block";
    style.width = size.width;
    style.height = size.height;
    style.overflow = "hidden";
    style.verticalAlign = "middle";
  }
  return style;
};

/**
 * Renders a component the app registered natively in place of its web
 * children, on hosts that offer it, and the children everywhere else.
 */
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
  const { id, mode, size, handoff, anchorType, command, state } = useNativeIsland(wrapper, {
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
  });
  React.useImperativeHandle(ref, () => ({ command, state }), [command, state]);
  const nativeSize = sizing === "native" && mode !== "web" ? size : undefined;
  const shown = mode === "native" && handoff === undefined;
  const concealed = useConcealed(shown);
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
        [ISLAND_CONCEALED_ATTRIBUTE]: concealed ? "" : undefined,
      }}
      aria-hidden={hidden ? true : undefined}
      style={styleFor(nativeSize)}
    >
      {children}
    </span>
  );
};
