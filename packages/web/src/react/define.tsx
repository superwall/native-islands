import * as React from "react";
import { Native, type NativeCommonProps, type NativeHandle, type NativeValue } from "./Native";
import type { NativeSizing } from "./useNativeIsland";

/** The props a native component receives: plain values only. */
export type NativeComponentValues = { readonly [key: string]: NativeValue | undefined };

/** A request the native view can make of the page: what it sends and what it gets back. */
export type NativeRequest = { payload: unknown; result: unknown };

/** A command the page can send the native view: its arguments and what it answers. */
export type NativeCommand = { args: unknown; result: unknown };

/**
 * Everything a native component exchanges with the page, each part optional.
 * `props` go to native. `events` are fire-and-forget signals from native, such as
 * `press`. `state` is the values native owns and keeps in sync, such as what a
 * user typed. `requests` are questions native asks the page and waits on.
 * `commands` are what the page can ask native to do.
 */
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

/** Event handlers for a native component's events: `press` becomes `onPress`. */
export type NativeEventHandlers<TEvents> = {
  [K in keyof TEvents & string as `on${Capitalize<K>}`]?: (payload: TEvents[K]) => void;
};

/** Handlers for the requests a native component makes; each may answer at once or with a promise. */
export type NativeRequestHandlers<TRequests> = {
  [K in keyof TRequests]?: TRequests[K] extends NativeRequest
    ? (payload: TRequests[K]["payload"]) => TRequests[K]["result"] | Promise<TRequests[K]["result"]>
    : never;
};

export type NativeComponentProps<TSpec extends NativeComponentSpec> = PropsOf<TSpec> &
  NativeEventHandlers<EventsOf<TSpec>> &
  NativeCommonProps & {
    /** Called whenever native changes its state, with all of it and with what changed. Default: none. */
    onStateChange?: (
      state: Readonly<Partial<StateOf<TSpec>>>,
      changed: Readonly<Partial<StateOf<TSpec>>>,
    ) => void;
    /** Answers the requests native makes, by name. An unanswered request fails on the native side. Default: none. */
    requests?: NativeRequestHandlers<RequestsOf<TSpec>>;
    /** Receives a handle that sends commands to the native view and reads its state. Default: none. */
    ref?: React.Ref<NativeHandle<CommandsOf<TSpec>, StateOf<TSpec>>>;
  };

export type NativeComponentOptions<TSpec extends NativeComponentSpec> = {
  /** The lowest registered version this definition works with. Default: `1`. */
  version?: number;
  /** Who sets the size: the web children (`"web"`) or the native view (`"native"`). Default: `"web"`. */
  sizing?: NativeSizing;
  /** Props holding colours, sent as `rgb()`/`rgba()` so native can read them. Default: none. */
  colorProps?: readonly (keyof PropsOf<TSpec> & string)[];
};

/** A React component for a native component the app registered, made by `defineNativeComponent`. */
export type NativeComponent<TSpec extends NativeComponentSpec> = ((
  props: NativeComponentProps<TSpec>,
) => React.ReactElement) & {
  /** The name the app registered the component under. */
  readonly componentName: string;
  /** The lowest registered version it works with. */
  readonly version: number;
  /** `Native(<name>)`, shown in React DevTools. */
  displayName: string;
};

const RESERVED = new Set([
  "children",
  "islandId",
  "native",
  "accessibility",
  "onStateChange",
  "requests",
  "ref",
]);

const HANDLER = /^on[A-Z]/;

export const eventNameOf = (handler: string) => handler.charAt(2).toLowerCase() + handler.slice(3);

/**
 * Defines a typed React component for a component the app registered with the
 * host under `name`. It renders its children as the web version and swaps in the
 * native view where the host offers it.
 */
export const defineNativeComponent = <TSpec extends NativeComponentSpec = NativeComponentSpec>(
  name: string,
  options: NativeComponentOptions<TSpec> = {},
): NativeComponent<TSpec> => {
  const version = options.version ?? 1;
  const Component = (input: NativeComponentProps<TSpec>) => {
    const values: Record<string, unknown> = {};
    const handlers: Record<string, (payload: unknown) => void> = {};
    for (const [key, value] of Object.entries(input)) {
      if (RESERVED.has(key)) continue;
      if (HANDLER.test(key) && typeof value === "function") {
        handlers[eventNameOf(key)] = value as (payload: unknown) => void;
      } else {
        values[key] = value;
      }
    }
    const latest = React.useRef({ handlers, requests: input.requests });
    latest.current = { handlers, requests: input.requests };
    const onEvent = React.useCallback((event: string, payload: unknown) => {
      latest.current.handlers[event]?.(payload);
    }, []);
    const onRequest = React.useCallback((request: string, payload: unknown) => {
      const handler = (latest.current.requests as Record<string, unknown> | undefined)?.[request];
      if (typeof handler !== "function") {
        throw new Error(`<${name}> has no handler for the ${JSON.stringify(request)} request.`);
      }
      return (handler as (payload: unknown) => unknown)(payload);
    }, []);
    return (
      <Native
        component={name}
        version={version}
        props={values as NativeComponentValues}
        sizing={options.sizing}
        colorProps={options.colorProps}
        islandId={input.islandId}
        native={input.native}
        accessibility={input.accessibility}
        onEvent={onEvent}
        onStateChange={
          input.onStateChange as
            | ((
                state: Readonly<Record<string, unknown>>,
                changed: Readonly<Record<string, unknown>>,
              ) => void)
            | undefined
        }
        onRequest={onRequest}
        ref={input.ref as React.Ref<NativeHandle> | undefined}
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
};
