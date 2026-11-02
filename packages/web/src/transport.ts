import { type NATIVE_CAPABILITY_GLOBAL, NATIVE_MESSAGE_HANDLER } from "./schemas";
import type { TToHostMessage } from "./messages";

/** The global the host calls to deliver its messages: `window.__nativeIslands.accept64(base64)`. */
export const NATIVE_RECEIVER_GLOBAL = "__nativeIslands";

/** How the page talks to the host. */
export type NativeIslandsTransport = {
  /** Sends a message to the host. Returns `false` when there is no host to send it to. */
  post: (message: TToHostMessage) => boolean;
  /** Calls `listener` with every message the host delivers. Returns a function that stops it. */
  listen: (listener: (message: unknown) => void) => () => void;
};

/** What the host calls in the page to deliver its messages. */
export type NativeIslandsReceiver = {
  /** Delivers a base64-encoded UTF-8 JSON array of messages. */
  accept64: (encoded: string) => void;
  /** Delivers an array of messages. */
  accept: (messages: unknown) => void;
};

type MessageHandler = { postMessage: (message: unknown) => void };

/** The globals a host and the page share on `window`. */
export type HostWindow = Window & {
  webkit?: { messageHandlers?: Record<string, MessageHandler | undefined> };
  [NATIVE_CAPABILITY_GLOBAL]?: unknown;
  [NATIVE_RECEIVER_GLOBAL]?: NativeIslandsReceiver;
};

export const hostWindow = (target: Window = window): HostWindow => target;

type Listeners = Set<(message: unknown) => void>;

const receivers = new WeakMap<Window, Listeners>();

export const decodeBase64Json = (encoded: string): unknown => {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

const defaultReport = (message: string, error?: unknown) => console.error(message, error);

const receiverFor = (
  target: HostWindow,
  report: (message: string, error?: unknown) => void,
): Listeners => {
  const existing = receivers.get(target);
  if (existing) return existing;
  const listeners: Listeners = new Set();
  receivers.set(target, listeners);
  const accept = (messages: unknown) => {
    if (!Array.isArray(messages)) {
      report("Ignored a delivery from the host that is not an array of messages.");
      return;
    }
    for (const message of messages) {
      for (const listener of listeners) {
        try {
          listener(message);
        } catch (error) {
          report("A native islands listener threw.", error);
        }
      }
    }
  };
  target[NATIVE_RECEIVER_GLOBAL] = {
    accept,
    accept64: (encoded) => {
      let messages: unknown;
      try {
        messages = decodeBase64Json(encoded);
      } catch (error) {
        report("Ignored a delivery from the host that is not base64 JSON.", error);
        return;
      }
      accept(messages);
    },
  };
  return listeners;
};

/** Options for `createWebKitTransport`. */
export type WebKitTransportOptions = {
  /** The window the page runs in. Default: the global `window`. */
  window?: Window;
  /** Where problems with deliveries are reported. Default: `console.error`. */
  report?: (message: string, error?: unknown) => void;
};

/**
 * Talks to a `WKWebView` host: posts to the `nativeIslands` script message
 * handler and receives through `window.__nativeIslands`.
 */
export const createWebKitTransport = (
  options: WebKitTransportOptions = {},
): NativeIslandsTransport => {
  const target = hostWindow(options.window);
  const report = options.report ?? defaultReport;
  return {
    post: (message) => {
      const handler = target.webkit?.messageHandlers?.[NATIVE_MESSAGE_HANDLER];
      if (!handler) return false;
      handler.postMessage(message);
      return true;
    },
    listen: (listener) => {
      const listeners = receiverFor(target, report);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
