import {
  describeNativeCapability,
  nativeCapabilityFromGlobal,
  readNativeCapability,
} from "../protocol/capability";
import {
  createNativeIslands,
  type NativeIslands,
  type NativeScheduler,
} from "../islands/controller";
import { createWebKitTransport, type NativeIslandsTransport } from "./transport";

export type ConnectNativeIslandsOptions = {
  transport?: NativeIslandsTransport;
  capability?: unknown;
  schedule?: NativeScheduler;
  ackTimeoutMs?: number;
  report?: (message: string, error?: unknown) => void;
};

export type NativeIslandsConnection = {
  islands: NativeIslands;
  disconnect: () => void;
  reconnect: () => void;
};

const warn = (message: string, error?: unknown) => {
  if (error === undefined) console.warn(message);
  else console.error(message, error);
};

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
  const listen = () =>
    transport.listen((message) => {
      islands.handle(message);
    });
  let stop: (() => void) | undefined = listen();
  return {
    islands,
    disconnect: () => {
      stop?.();
      stop = undefined;
    },
    reconnect: () => {
      stop ??= listen();
    },
  };
};
