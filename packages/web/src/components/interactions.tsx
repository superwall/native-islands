import * as React from "react";
import type { NativeCommonProps, NativeHandle } from "../react/components/Native";
import { useNativeSupport } from "../react/hooks/useNativeSupport";
import { cssVariables } from "./geometry";
import {
  NativeHaptics,
  NativeInteraction,
  NativeMaterial,
  NativeNotifications,
  type HapticFeedback,
  type HapticPattern,
  type LocalNotification,
  type MaterialName,
  type MenuItem,
  type NativeJSON,
  type NotificationStatus,
} from "./specs";

/**
 * System primitives a page calls: Core Haptics patterns, local
 * notifications, context menus and long presses over its own elements, and
 * system materials behind them.
 */

type HapticCommands = {
  play: { args: HapticPattern; result: { played: boolean } };
  impact: { args: { style: HapticFeedback; intensity?: number }; result: { played: boolean } };
  stop: { args: undefined; result: void };
};

export type HapticsHandle = {
  /** Plays a Core Haptics pattern; resolves false where nothing can play it. */
  play: (pattern: HapticPattern) => Promise<boolean>;
  /** Plays one simple feedback, at an intensity from 0 to 1 for impacts. */
  impact: (style: HapticFeedback, intensity?: number) => Promise<boolean>;
  stop: () => void;
};

/** How long a browser vibrates for a pattern: its events' lengths, a tap 10 ms. */
export const vibrationPattern = (pattern: HapticPattern): number[] => {
  const steps: number[] = [];
  let at = 0;
  for (const event of pattern.events.toSorted((a, b) => a.time - b.time)) {
    const start = Math.round(event.time * 1000);
    if (start > at) steps.push(start - at);
    else if (steps.length > 0) steps.push(0);
    const length = event.kind === "continuous" ? Math.round((event.duration ?? 0.2) * 1000) : 10;
    steps.push(length);
    at = Math.max(at, start) + length;
  }
  return steps;
};

const vibrate = (steps: number | number[]): boolean => {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  return navigator.vibrate(steps);
};

/**
 * Plays haptics through the island it renders, which draws nothing. Render
 * `<Haptics handle={ref} />` once and call `ref.current.play(...)`, or use
 * `useHaptics()`. A browser can only try to vibrate.
 */
export const Haptics = ({
  handle,
  ...common
}: NativeCommonProps & { handle?: React.Ref<HapticsHandle> }) => {
  const island = React.useRef<NativeHandle<HapticCommands>>(null);
  const supported = useNativeSupport("haptics") === "supported" && common.native !== false;
  React.useImperativeHandle(
    handle,
    () => ({
      play: async (pattern) => {
        if (!supported) return vibrate(vibrationPattern(pattern));
        const result = await island.current?.command("play", pattern).catch(() => undefined);
        return result?.played ?? false;
      },
      impact: async (style, intensity) => {
        if (!supported) return vibrate(style === "heavy" || style === "rigid" ? 30 : 10);
        const result = await island.current
          ?.command("impact", { style, intensity })
          .catch(() => undefined);
        return result?.played ?? false;
      },
      stop: () => {
        if (supported) void island.current?.command("stop").catch(() => {});
        else vibrate(0);
      },
    }),
    [supported],
  );
  return (
    <NativeHaptics ref={island} {...common}>
      <span className="ni-anchor" aria-hidden="true" />
    </NativeHaptics>
  );
};

/** A haptics handle and the element that holds it: render `element` once, then call `play`. */
export const useHaptics = (): HapticsHandle & { element: React.ReactElement } => {
  const handle = React.useRef<HapticsHandle>(null);
  return React.useMemo(
    () => ({
      element: <Haptics handle={handle} />,
      play: (pattern) => handle.current?.play(pattern) ?? Promise.resolve(false),
      impact: (style, intensity) =>
        handle.current?.impact(style, intensity) ?? Promise.resolve(false),
      stop: () => handle.current?.stop(),
    }),
    [],
  );
};

type NotificationCommands = {
  requestAuthorization: {
    args: { provisional?: boolean } | undefined;
    result: { status: NotificationStatus };
  };
  schedule: { args: LocalNotification; result: void };
  cancel: { args: { ids: readonly string[] }; result: void };
  cancelAll: { args: undefined; result: void };
  pending: { args: undefined; result: { ids: readonly string[] } };
  setBadge: { args: { count: number }; result: void };
};

export type NotificationsHandle = {
  requestAuthorization: (options?: { provisional?: boolean }) => Promise<NotificationStatus>;
  schedule: (notification: LocalNotification) => Promise<void>;
  cancel: (ids: readonly string[]) => Promise<void>;
  cancelAll: () => Promise<void>;
  pending: () => Promise<readonly string[]>;
  setBadge: (count: number) => Promise<void>;
};

const browserStatus = (): NotificationStatus => {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") return "granted";
  return Notification.permission === "denied" ? "denied" : "notDetermined";
};

/**
 * Local notifications through an island that draws nothing. Outside the
 * app it uses the browser's Notification API, and shows a scheduled one
 * after `after` seconds while the page stays open.
 */
export const Notifications = ({
  handle,
  onStatusChange,
  onOpen,
  onDeliver,
  ...common
}: NativeCommonProps & {
  handle?: React.Ref<NotificationsHandle>;
  onStatusChange?: (status: NotificationStatus) => void;
  /** The person tapped a notification. */
  onOpen?: (id: string, data: NativeJSON) => void;
  /** One arrived while the app was open. */
  onDeliver?: (id: string, data: NativeJSON) => void;
}) => {
  const island = React.useRef<NativeHandle<NotificationCommands>>(null);
  const supported = useNativeSupport("notifications") === "supported" && common.native !== false;
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());
  React.useEffect(() => {
    const scheduled = timers.current;
    return () => scheduled.forEach((timer) => clearTimeout(timer));
  }, []);
  React.useImperativeHandle(handle, () => {
    const showing = () => {
      const current = island.current;
      if (!current) throw new Error("Notifications aren't showing.");
      return current;
    };
    if (supported) {
      return {
        requestAuthorization: async (options) =>
          (await showing().command("requestAuthorization", options)).status,
        schedule: async (notification) => showing().command("schedule", notification),
        cancel: async (ids) => showing().command("cancel", { ids }),
        cancelAll: async () => showing().command("cancelAll"),
        pending: async () => (await showing().command("pending")).ids,
        setBadge: async (count) => showing().command("setBadge", { count }),
      };
    }
    const cancel = (ids: readonly string[]) => {
      for (const id of ids) {
        clearTimeout(timers.current.get(id));
        timers.current.delete(id);
      }
      return Promise.resolve();
    };
    return {
      requestAuthorization: async () => {
        if (typeof Notification === "undefined") return "denied";
        await Notification.requestPermission();
        const status = browserStatus();
        onStatusChange?.(status);
        return status;
      },
      schedule: (notification) => {
        void cancel([notification.id]);
        const timer = setTimeout(
          () => {
            timers.current.delete(notification.id);
            onDeliver?.(notification.id, notification.data ?? null);
            if (browserStatus() !== "granted") return;
            const shown = new Notification(notification.title, {
              body: notification.body,
              tag: notification.id,
            });
            shown.addEventListener("click", () =>
              onOpen?.(notification.id, notification.data ?? null),
            );
          },
          (notification.after ?? 1) * 1000,
        );
        timers.current.set(notification.id, timer);
        return Promise.resolve();
      },
      cancel,
      cancelAll: () => cancel([...timers.current.keys()]),
      pending: () => Promise.resolve([...timers.current.keys()]),
      setBadge: async (count) => {
        const badging: { setAppBadge?: (count: number) => Promise<void> } = navigator;
        await badging.setAppBadge?.(count);
      },
    };
  }, [supported, onStatusChange, onOpen, onDeliver]);
  return (
    <NativeNotifications
      ref={island}
      onStatusChange={onStatusChange}
      onOpen={({ id, data }) => onOpen?.(id, data)}
      onDeliver={({ id, data }) => onDeliver?.(id, data)}
      {...common}
    >
      <span className="ni-anchor" aria-hidden="true" />
    </NativeNotifications>
  );
};

const missing = () => Promise.reject(new Error("Render the notifications element first."));

/** A notifications handle and the element that holds it: render `element` once. */
export const useNotifications = (
  events: {
    onStatusChange?: (status: NotificationStatus) => void;
    onOpen?: (id: string, data: NativeJSON) => void;
    onDeliver?: (id: string, data: NativeJSON) => void;
  } = {},
) => {
  const handle = React.useRef<NotificationsHandle>(null);
  const latest = React.useRef(events);
  latest.current = events;
  const element = React.useMemo(
    () => (
      <Notifications
        handle={handle}
        onStatusChange={(status) => latest.current.onStatusChange?.(status)}
        onOpen={(id, data) => latest.current.onOpen?.(id, data)}
        onDeliver={(id, data) => latest.current.onDeliver?.(id, data)}
      />
    ),
    [],
  );
  return {
    element,
    requestAuthorization: (options?: { provisional?: boolean }) =>
      handle.current?.requestAuthorization(options) ?? missing(),
    schedule: (notification: LocalNotification) =>
      handle.current?.schedule(notification) ?? missing(),
    cancel: (ids: readonly string[]) => handle.current?.cancel(ids) ?? missing(),
    cancelAll: () => handle.current?.cancelAll() ?? missing(),
    pending: () => handle.current?.pending() ?? missing(),
    setBadge: (count: number) => handle.current?.setBadge(count) ?? missing(),
  };
};

/** Lays a clear native view over `children`, which stay this page's own elements. */
const Overlay = ({
  children,
  island,
}: {
  children: React.ReactNode;
  island: (anchor: React.ReactElement) => React.ReactElement;
}) => (
  <span className="ni-anchored">
    {children}
    {island(<span className="ni-anchor ni-anchor--fill" aria-hidden="true" />)}
  </span>
);

const useLongPress = (onLongPress: (() => void) | undefined, duration: number) => {
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const cancel = () => clearTimeout(timer.current);
  return {
    onPointerDown: () => {
      cancel();
      timer.current = setTimeout(() => onLongPress?.(), duration * 1000);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
  };
};

/**
 * A system context menu on a long press of `children`, lifting a snapshot of
 * them as the preview. Outside the app, a right click or a long press opens
 * the web version's menu.
 */
export const ContextMenu = ({
  items,
  title,
  cornerRadius,
  onSelect,
  onPress,
  children,
  ...common
}: NativeCommonProps & {
  items: readonly MenuItem[];
  title?: string;
  cornerRadius?: number;
  onSelect: (id: string) => void;
  /** A tap, which the native view takes from the element under it. */
  onPress?: () => void;
}) => {
  const [open, setOpen] = React.useState(false);
  const hold = useLongPress(() => setOpen(true), 0.5);
  const flat = (entries: readonly MenuItem[]): MenuItem[] =>
    entries.flatMap((item) => (item.children ? flat(item.children) : [item]));
  return (
    <span
      className="ni-context-menu"
      onContextMenu={(event) => {
        event.preventDefault();
        setOpen(true);
      }}
      {...hold}
    >
      <Overlay
        island={(anchor) => (
          <NativeInteraction
            items={items}
            title={title}
            cornerRadius={cornerRadius}
            onSelect={({ id }) => onSelect(id)}
            onPress={onPress}
            {...common}
          >
            {anchor}
          </NativeInteraction>
        )}
      >
        {children}
      </Overlay>
      {open && (
        <span className="ni-menu-list" role="menu" aria-label={title}>
          {flat(items).map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="ni-menu-item"
              data-destructive={item.destructive ? "" : undefined}
              onClick={() => {
                setOpen(false);
                onSelect(item.id);
              }}
            >
              {item.title}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className="ni-menu-item"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </span>
      )}
    </span>
  );
};

/**
 * A long press on `children`, held for `minimumDuration` seconds, with a
 * haptic natively. A tap still reaches `onPress`.
 */
export const LongPressGesture = ({
  minimumDuration = 0.5,
  haptic = "medium",
  onLongPress,
  onPress,
  children,
  ...common
}: NativeCommonProps & {
  minimumDuration?: number;
  haptic?: HapticFeedback | "none";
  onLongPress: () => void;
  onPress?: () => void;
}) => {
  const hold = useLongPress(onLongPress, minimumDuration);
  return (
    <span className="ni-long-press" {...hold}>
      <Overlay
        island={(anchor) => (
          <NativeInteraction
            longPress
            minimumDuration={minimumDuration}
            haptic={haptic}
            onLongPress={onLongPress}
            onPress={onPress}
            {...common}
          >
            {anchor}
          </NativeInteraction>
        )}
      >
        {children}
      </Overlay>
    </span>
  );
};

/**
 * A system material, or Liquid Glass (`glass`, `clearGlass`) on iOS 26,
 * filling its box, with an optional `title`, `subtitle` and symbol drawn
 * natively on it in vibrant colours. Islands sit above the page, so web
 * content can't draw on a native material: put text on it through these
 * props. `children` are the web version, a blurred translucent box by default.
 */
export const MaterialBackground = ({
  material = "regular",
  cornerRadius = 0,
  title,
  subtitle,
  systemImage,
  tint,
  glassTint,
  className,
  children,
  ...common
}: NativeCommonProps & {
  material?: MaterialName;
  cornerRadius?: number;
  title?: string;
  subtitle?: string;
  systemImage?: string;
  tint?: string;
  glassTint?: string;
  className?: string;
}) => (
  <NativeMaterial
    material={material}
    cornerRadius={cornerRadius}
    title={title}
    subtitle={subtitle}
    systemImage={systemImage}
    tint={tint}
    glassTint={glassTint}
    accessibility={
      title === undefined ? undefined : { label: subtitle ? `${title}, ${subtitle}` : title }
    }
    {...common}
  >
    {children ?? (
      <div
        className={className ? `ni-material ${className}` : "ni-material"}
        data-material={material}
        style={cssVariables({ "--ni-radius": `${cornerRadius}px`, "--ni-tint": tint })}
      >
        {title && <span className="ni-material-title">{title}</span>}
        {subtitle && <span className="ni-material-subtitle">{subtitle}</span>}
      </div>
    )}
  </NativeMaterial>
);
