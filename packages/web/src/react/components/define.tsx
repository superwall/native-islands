import * as React from "react";
import {
  Native,
  type NativeCommonProps,
  type NativeHandle,
  type NativeProps,
  type NativeValue,
} from "./Native";
import type { NativeSizing } from "../hooks/useNativeIsland";

export type NativeComponentValues = { readonly [key: string]: NativeValue | undefined };

export type NativeRequest = { payload: unknown; result: unknown };

export type NativeCommand = { args: unknown; result: unknown };

export type NativeComponentSpec = {
  props?: NativeComponentValues;
  events?: Record<string, unknown>;
  state?: Record<string, unknown>;
  requests?: Record<string, NativeRequest>;
  commands?: Record<string, NativeCommand>;
};

type Part<TSpec, K extends keyof NativeComponentSpec, TDefault> = TSpec extends {
  [P in K]: infer T;
}
  ? T
  : TDefault;

type PropsOf<TSpec> = Part<TSpec, "props", Record<never, never>>;
type EventsOf<TSpec> = Part<TSpec, "events", Record<never, never>>;
type StateOf<TSpec> = Part<TSpec, "state", Record<never, never>>;
type RequestsOf<TSpec> = Part<TSpec, "requests", Record<never, never>>;
type CommandsOf<TSpec> = Part<TSpec, "commands", Record<never, never>>;

export type NativeEventHandlers<TEvents> = {
  [K in keyof TEvents & string as `on${Capitalize<K>}`]?: (payload: TEvents[K]) => void;
};

export type NativeRequestHandlers<TRequests> = {
  [K in keyof TRequests & string as `on${Capitalize<K>}`]?: TRequests[K] extends NativeRequest
    ? (payload: TRequests[K]["payload"]) => TRequests[K]["result"] | Promise<TRequests[K]["result"]>
    : never;
};

export type NativeStateHandlers<TState> = {
  [K in keyof TState & string as `on${Capitalize<K>}Change`]?: (next: TState[K]) => void;
};

export type NativeComponentProps<TSpec extends NativeComponentSpec> = PropsOf<TSpec> &
  NativeEventHandlers<EventsOf<TSpec>> &
  NativeStateHandlers<StateOf<TSpec>> &
  NativeRequestHandlers<RequestsOf<TSpec>> &
  NativeCommonProps & {
    onStateChange?: (
      state: Readonly<Partial<StateOf<TSpec>>>,
      changed: Readonly<Partial<StateOf<TSpec>>>,
    ) => void;
    ref?: React.Ref<NativeHandle<CommandsOf<TSpec>, StateOf<TSpec>>>;
  };

export type NativeComponentOptions<TSpec extends NativeComponentSpec> = {
  version?: number;
  sizing?: NativeSizing;
  colorProps?: readonly (keyof PropsOf<TSpec> & string)[];
};

export type NativeComponent<TSpec extends NativeComponentSpec> = ((
  props: NativeComponentProps<TSpec>,
) => React.ReactElement) & {
  readonly componentName: string;
  readonly version: number;
  displayName: string;
};

const RESERVED = new Set([
  "children",
  "islandId",
  "native",
  "accessibility",
  "onStateChange",
  "ref",
]);

const HANDLER = /^on[A-Z]/;

export const eventNameOf = (handler: string) => handler.charAt(2).toLowerCase() + handler.slice(3);

type UntypedProps = NativeCommonProps & {
  readonly [key: string]: unknown;
  onStateChange?: NativeProps["onStateChange"];
  ref?: React.Ref<NativeHandle>;
};

type UntypedOptions = {
  version?: number;
  sizing?: NativeSizing;
  colorProps?: readonly string[];
};

const isHandler = (value: unknown): value is (payload: unknown) => unknown =>
  typeof value === "function";

const isNativeValueWithin = (value: unknown, ancestors: Set<object>): boolean => {
  if (value === null) return true;
  switch (typeof value) {
    case "string":
    case "boolean":
      return true;
    case "number":
      return Number.isFinite(value);
    case "object": {
      if (ancestors.has(value)) return false;
      const prototype: unknown = Object.getPrototypeOf(value);
      if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
        return false;
      }
      ancestors.add(value);
      const entries: unknown[] = Array.isArray(value) ? value : Object.values(value);
      const valid = entries.every(
        (entry) =>
          (entry === undefined && !Array.isArray(value)) || isNativeValueWithin(entry, ancestors),
      );
      ancestors.delete(value);
      return valid;
    }
    default:
      return false;
  }
};

export const isNativeValue = (value: unknown): value is NativeValue =>
  isNativeValueWithin(value, new Set());

export function defineNativeComponent<TSpec extends NativeComponentSpec = NativeComponentSpec>(
  name: string,
  options?: NativeComponentOptions<TSpec>,
): NativeComponent<TSpec>;
export function defineNativeComponent(name: string, options: UntypedOptions = {}) {
  const version = options.version ?? 1;
  const Component = (input: UntypedProps) => {
    const values: Record<string, NativeValue | undefined> = {};
    const handlers: Record<string, (payload: unknown) => unknown> = {};
    const invalid: string[] = [];
    for (const [key, value] of Object.entries(input)) {
      if (RESERVED.has(key)) continue;
      if (HANDLER.test(key) && isHandler(value)) handlers[eventNameOf(key)] = value;
      else if (value === undefined || isNativeValue(value)) values[key] = value;
      else invalid.push(key);
    }
    const latest = React.useRef({ handlers, onStateChange: input.onStateChange });
    latest.current = { handlers, onStateChange: input.onStateChange };
    const onEvent = React.useCallback((event: string, payload: unknown) => {
      latest.current.handlers[event]?.(payload);
    }, []);
    const onStateChange = React.useCallback(
      (state: Readonly<Record<string, unknown>>, changed: Readonly<Record<string, unknown>>) => {
        latest.current.onStateChange?.(state, changed);
        for (const [key, next] of Object.entries(changed)) {
          latest.current.handlers[`${key}Change`]?.(next);
        }
      },
      [],
    );
    const onRequest = React.useCallback((request: string, payload: unknown) => {
      const handler = latest.current.handlers[request];
      if (!handler) {
        throw new Error(`<${name}> has no handler for the ${JSON.stringify(request)} request.`);
      }
      return handler(payload);
    }, []);
    const problem = invalid.join(", ");
    React.useEffect(() => {
      if (problem) console.error(`<${name}> is showing its web version: ${problem} is not JSON.`);
    }, [problem]);
    return (
      <Native
        component={name}
        version={version}
        props={values}
        sizing={options.sizing}
        colorProps={options.colorProps}
        islandId={input.islandId}
        native={input.native !== false && invalid.length === 0}
        accessibility={input.accessibility}
        onEvent={onEvent}
        onStateChange={onStateChange}
        onRequest={onRequest}
        ref={input.ref}
      >
        {input.children}
      </Native>
    );
  };
  return Object.assign(Component, {
    componentName: name,
    version,
    displayName: `Native(${name})`,
  });
}
