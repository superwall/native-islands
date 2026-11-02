import * as React from "react";
import { connectNativeIslands, type ConnectNativeIslandsOptions } from "../connect";
import type { NativeIslands } from "../islands";
import { ensureIslandStyles } from "./styles";

/**
 * Counts the islands still on their way to native: waiting for their element
 * to settle, or mounted and waiting for the host's ack.
 */
export type NativeReadiness = {
  /** Marks an island as on its way. Calling it twice for one id counts once. */
  begin: (id: string) => void;
  /** Marks an island as settled: drawn natively, or showing its web version for good. */
  end: (id: string) => void;
  /** Whether no island is on its way. */
  ready: () => boolean;
  /** Calls `listener` whenever `ready()` may have changed. Returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
};

export const createReadiness = (): NativeReadiness => {
  const waiting = new Set<string>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of Array.from(listeners)) listener();
  };
  return {
    begin: (id) => {
      if (waiting.has(id)) return;
      waiting.add(id);
      if (waiting.size === 1) notify();
    },
    end: (id) => {
      if (!waiting.delete(id)) return;
      if (waiting.size === 0) notify();
    },
    ready: () => waiting.size === 0,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

type NativeIslandsContextValue = { islands: NativeIslands; readiness: NativeReadiness };

const NativeIslandsContext = React.createContext<NativeIslandsContextValue | undefined>(undefined);

export type NativeIslandsProviderProps = {
  /** The island controller to use. Default: one made by `connectNativeIslands`, kept for the provider's life. */
  islands?: NativeIslands;
  /** Options for the controller the provider makes, read once. Ignored with `islands`. Default: `{}`. */
  connect?: ConnectNativeIslandsOptions;
  /**
   * Tells the host once every island rendered on the first frame is settled,
   * so a host holding the web view hidden reveals it with the islands already
   * drawn. Turn it off to call `announceReady()` on the controller yourself.
   * Default: `true`.
   */
  announceReady?: boolean;
  children?: React.ReactNode;
};

/** Gives every `<Native>` below it the island controller that talks to the host. */
export const NativeIslandsProvider = ({
  islands,
  connect,
  announceReady = true,
  children,
}: NativeIslandsProviderProps) => {
  const [owned] = React.useState(() => (islands ? undefined : connectNativeIslands(connect)));
  React.useEffect(() => {
    if (!owned) return;
    owned.reconnect();
    return owned.disconnect;
  }, [owned]);
  const [readiness] = React.useState(createReadiness);
  const controller = islands ?? (owned as { islands: NativeIslands }).islands;
  const value = React.useMemo(() => ({ islands: controller, readiness }), [controller, readiness]);
  React.useEffect(() => {
    if (!announceReady) return;
    let unsubscribe: (() => void) | undefined;
    const check = () => {
      if (!readiness.ready()) return;
      unsubscribe?.();
      unsubscribe = undefined;
      controller.announceReady();
    };
    const frame = requestAnimationFrame(() => {
      unsubscribe = readiness.subscribe(check);
      check();
    });
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe?.();
    };
  }, [announceReady, controller, readiness]);
  React.useInsertionEffect(() => {
    ensureIslandStyles(document);
  }, []);
  return <NativeIslandsContext.Provider value={value}>{children}</NativeIslandsContext.Provider>;
};

export const useNativeIslandsContext = (): NativeIslandsContextValue => {
  const value = React.useContext(NativeIslandsContext);
  if (!value) throw new Error("Native islands must be used within a NativeIslandsProvider.");
  return value;
};

/** The island controller of the nearest `NativeIslandsProvider`. */
export const useNativeIslands = (): NativeIslands => useNativeIslandsContext().islands;

/**
 * `true` once every island below the provider is drawn natively or settled on
 * its web version, `false` while any is still on its way.
 */
export const useNativeIslandsReady = (): boolean => {
  const { readiness } = useNativeIslandsContext();
  return React.useSyncExternalStore(readiness.subscribe, readiness.ready, readiness.ready);
};
