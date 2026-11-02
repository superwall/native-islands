import * as React from "react";
import { connectNativeIslands, type ConnectNativeIslandsOptions } from "../../bridge/connect";
import type { NativeIslands } from "../../islands/controller";
import { ensureIslandStyles } from "../dom/styles";

export type NativeReadiness = {
  begin: (id: string) => void;
  end: (id: string) => void;
  ready: () => boolean;
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
  islands?: NativeIslands;
  connect?: ConnectNativeIslandsOptions;
  announceReady?: boolean;
  children?: React.ReactNode;
};

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
  const controller = islands ?? owned?.islands;
  if (!controller) throw new Error("NativeIslandsProvider lost its `islands` prop after mounting.");
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

export const useNativeIslands = (): NativeIslands => useNativeIslandsContext().islands;

export const useNativeIslandsReady = (): boolean => {
  const { readiness } = useNativeIslandsContext();
  return React.useSyncExternalStore(readiness.subscribe, readiness.ready, readiness.ready);
};
