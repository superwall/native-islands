/**
 * Messages for the Islands app itself rather than for an island: the
 * `showcase` handler in `examples/ios/Islands/AppBridge.swift`. In a browser
 * there is no handler and they go nowhere.
 */
export type HostMessage =
  | { type: "appearance"; value: "system" | "light" | "dark" }
  | { type: "outlines"; value: boolean };

type Handler = { postMessage: (message: unknown) => void };

declare global {
  interface Window {
    webkit?: { messageHandlers?: Record<string, Handler | undefined> };
  }
}

export const postToHost = (message: HostMessage): void => {
  window.webkit?.messageHandlers?.showcase?.postMessage(message);
};
