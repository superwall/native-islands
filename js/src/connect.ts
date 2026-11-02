import {
  describeNativeCapability,
  nativeCapabilityFromGlobal,
  readNativeCapability,
} from "./capability";
import { createNativeIslands, type NativeIslands, type NativeScheduler } from "./islands";
import { createWebKitTransport, type NativeIslandsTransport } from "./transport";

/** Options for `connectNativeIslands`. */
export type ConnectNativeIslandsOptions = {
  /** How messages reach the host and come back. Default: the WebKit transport. */
  transport?: NativeIslandsTransport;
  /** The capability the host offers. Default: `window.__NATIVE_ISLANDS__`. */
  capability?: unknown;
  /** When batched operations are sent. Default: the next animation frame, or 50 ms. */
  schedule?: NativeScheduler;
  /** How long a mount waits for the host's ack before it stalls. Default: `500` ms. */
  ackTimeoutMs?: number;
  /** Where warnings and errors go. Default: the console. */
  report?: (message: string, error?: unknown) => void;
};

/** A controller wired to its host. */
export type NativeIslandsConnection = {
  /** The island controller. */
  islands: NativeIslands;
  /** Stops listening to the host. Islands already drawn stay until the host clears them. */
  disconnect: () => void;
};

const warn = (message: string, error?: unknown) => {
  if (error === undefined) console.warn(message);
  else console.error(message, error);
};

/**
 * Reads the host's capability, creates the island controller and wires it to
 * the host, so its batches reach the host and the host's answers reach it.
 */
export const connectNativeIslands = (
  options: ConnectNativeIslandsOptions = {},
): NativeIslandsConnection => {
  const report = options.report ?? warn;
  const transport = options.transport ?? createWebKitTransport({ report });
  const capability = readNativeCapability(
    "capability" in options ? options.capability : nativeCapabilityFromGlobal(),
  );
  const problem = describeNativeCapability(capability);
  if (problem) report(problem);
  const islands = createNativeIslands({
    capability,
    post: (message) => {
      if (!transport.post(message)) report(`No host received ${message.event_name}.`);
    },
    schedule: options.schedule,
    ackTimeoutMs: options.ackTimeoutMs,
    report,
  });
  const stop = transport.listen((message) => {
    islands.handle(message);
  });
  return { islands, disconnect: stop };
};
