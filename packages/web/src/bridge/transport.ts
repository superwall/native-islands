import { type NATIVE_CAPABILITY_GLOBAL, NATIVE_MESSAGE_HANDLER } from "../protocol/schemas";
import type { TToHostMessage } from "../protocol/messages";

export const NATIVE_RECEIVER_GLOBAL = "__nativeIslands";

export type NativeIslandsTransport = {
  post: (message: TToHostMessage) => boolean;
  listen: (listener: (message: unknown) => void) => () => void;
};

export type NativeIslandsReceiver = {
  accept64: (encoded: string) => void;
  accept: (messages: unknown) => void;
};

type MessageHandler = { postMessage: (message: unknown) => void };

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

export type WebKitTransportOptions = {
  window?: Window;
  report?: (message: string, error?: unknown) => void;
};

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
