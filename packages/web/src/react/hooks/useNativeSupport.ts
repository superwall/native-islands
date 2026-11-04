import * as React from "react";
import type { NativeSupport } from "../../protocol/capability";
import { useNativeIslands } from "../provider/context";

const subscribe = () => () => undefined;

const serverSupport = (): NativeSupport => "unavailable";

/**
 * Whether the host draws `component` at `version`. Server renders and hydration read
 * `unavailable`, as the server cannot see the host, then the real value follows.
 */
export const useNativeSupport = (component: string, version = 1): NativeSupport => {
  const islands = useNativeIslands();
  return React.useSyncExternalStore(
    subscribe,
    () => islands.supports(component, version),
    serverSupport,
  );
};
