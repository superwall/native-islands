import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, fireEvent, renderHook, screen } from "@testing-library/react";
import {
  ContextMenu,
  Haptics,
  LongPressGesture,
  MaterialBackground,
  Notifications,
  useHaptics,
  useNotifications,
  type HapticsHandle,
  type NotificationsHandle,
} from "../../src/components";
import { vibrationPattern } from "../../src/components/interactions";
import { removeCapability, renderNative } from "../support/react";
import { installComponents, mountComponent, replyTo } from "./support";

beforeEach(installComponents);

afterEach(() => {
  removeCapability();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const renderWeb = (ui: React.ReactElement) => {
  removeCapability();
  return renderNative(ui);
};

describe("Haptics", () => {
  it("plays patterns and impacts natively", async () => {
    const handle = React.createRef<HapticsHandle>();
    const view = await mountComponent(<Haptics handle={handle} />);
    expect(view.mount.component).toBe("haptics");
    let played: Promise<boolean> | undefined;
    await act(async () => {
      played = handle.current?.play({ events: [{ time: 0 }] });
    });
    await replyTo(view, "play", { ok: true, value: { played: true } });
    await expect(played).resolves.toBe(true);
    await act(async () => {
      played = handle.current?.play({ events: [] });
    });
    await replyTo(view, "play", { ok: false, error: "no" });
    await expect(played).resolves.toBe(false);
    await act(async () => {
      played = handle.current?.impact("rigid", 0.5);
    });
    await replyTo(view, "impact", { ok: true, value: { played: true } });
    await expect(played).resolves.toBe(true);
    await act(async () => {
      played = handle.current?.impact("light");
    });
    await replyTo(view, "impact", { ok: false, error: "no" });
    await expect(played).resolves.toBe(false);
    act(() => handle.current?.stop());
    await replyTo(view, "stop", { ok: false, error: "no" });
  });

  it("vibrates on the web where it can", async () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { ...navigator, vibrate });
    const handle = React.createRef<HapticsHandle>();
    renderWeb(<Haptics handle={handle} />);
    await expect(
      handle.current?.play({ events: [{ time: 0.1, kind: "continuous", duration: 0.3 }] }),
    ).resolves.toBe(true);
    await expect(handle.current?.impact("heavy")).resolves.toBe(true);
    await expect(handle.current?.impact("light")).resolves.toBe(true);
    handle.current?.stop();
    expect(vibrate.mock.calls).toEqual([[[100, 300]], [30], [10], [0]]);
    vi.stubGlobal("navigator", { ...navigator, vibrate: undefined });
    await expect(handle.current?.impact("rigid")).resolves.toBe(false);
  });

  it("turns patterns into vibration steps", () => {
    expect(
      vibrationPattern({
        events: [{ time: 0.2, intensity: 1 }, { time: 0, kind: "continuous" }, { time: 0.1 }],
      }),
    ).toEqual([200, 0, 10, 0, 10]);
    expect(vibrationPattern({ events: [] })).toEqual([]);
  });

  it("is held by useHaptics", async () => {
    const { result } = renderHook(() => useHaptics());
    await expect(result.current.play({ events: [] })).resolves.toBe(false);
    await expect(result.current.impact("soft")).resolves.toBe(false);
    result.current.stop();
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { ...navigator, vibrate });
    const Host = () => {
      const haptics = useHaptics();
      return (
        <>
          {haptics.element}
          <button type="button" onClick={() => void haptics.impact("soft", 1)}>
            Impact
          </button>
          <button type="button" onClick={() => void haptics.play({ events: [{ time: 0 }] })}>
            Play
          </button>
          <button type="button" onClick={() => haptics.stop()}>
            Stop
          </button>
        </>
      );
    };
    renderWeb(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Impact" }));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(vibrate).toHaveBeenCalledTimes(3);
  });
});

describe("Notifications", () => {
  it("schedules natively and hears status, taps and deliveries", async () => {
    const handle = React.createRef<NotificationsHandle>();
    const onStatusChange = vi.fn();
    const onOpen = vi.fn();
    const onDeliver = vi.fn();
    const view = await mountComponent(
      <Notifications
        handle={handle}
        onStatusChange={onStatusChange}
        onOpen={onOpen}
        onDeliver={onDeliver}
      />,
    );
    await view.state({ status: "granted" });
    expect(onStatusChange).toHaveBeenCalledWith("granted");
    view.event("open", { id: "a", data: 1 });
    view.event("deliver", { id: "b", data: null });
    expect(onOpen).toHaveBeenCalledWith("a", 1);
    expect(onDeliver).toHaveBeenCalledWith("b", null);
    const run = async <T,>(start: () => Promise<T> | undefined, name: string, value?: unknown) => {
      let result: Promise<T> | undefined;
      await act(async () => {
        result = start();
      });
      await replyTo(view, name, { ok: true, value });
      return result;
    };
    await expect(
      run(() => handle.current?.requestAuthorization(), "requestAuthorization", {
        status: "denied",
      }),
    ).resolves.toBe("denied");
    await run(() => handle.current?.schedule({ id: "a", title: "A" }), "schedule");
    await run(() => handle.current?.cancel(["a"]), "cancel");
    await run(() => handle.current?.cancelAll(), "cancelAll");
    await expect(run(() => handle.current?.pending(), "pending", { ids: ["x"] })).resolves.toEqual([
      "x",
    ]);
    await run(() => handle.current?.setBadge(2), "setBadge");
  });

  it("refuses commands once its island is gone", async () => {
    const handle = React.createRef<NotificationsHandle>();
    const Toggle = ({ shown }: { shown: boolean }) =>
      shown ? <Notifications handle={handle} /> : null;
    const view = await mountComponent(<Toggle shown />);
    const kept = handle.current;
    view.rerender(<Toggle shown={false} />);
    await expect(kept?.cancelAll()).rejects.toThrow("aren't showing");
  });

  it("uses the browser's notifications on the web", async () => {
    vi.useFakeTimers();
    const shown: { title: string; listeners: Array<() => void> }[] = [];
    class FakeNotification {
      static permission = "default";
      static requestPermission = vi.fn(async () => {
        if (FakeNotification.permission === "default") FakeNotification.permission = "granted";
        return FakeNotification.permission;
      });
      listeners: Array<() => void> = [];
      constructor(title: string) {
        shown.push({ title, listeners: this.listeners });
      }
      addEventListener(_: string, listener: () => void) {
        this.listeners.push(listener);
      }
    }
    vi.stubGlobal("Notification", FakeNotification);
    const setAppBadge = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, setAppBadge });
    const handle = React.createRef<NotificationsHandle>();
    const onStatusChange = vi.fn();
    const onOpen = vi.fn();
    const onDeliver = vi.fn();
    const view = renderWeb(
      <Notifications
        handle={handle}
        onStatusChange={onStatusChange}
        onOpen={onOpen}
        onDeliver={onDeliver}
      />,
    );
    await expect(
      handle.current?.schedule({ id: "early", title: "Early", after: 1 }),
    ).resolves.toBeUndefined();
    act(() => vi.advanceTimersByTime(1000));
    expect(onDeliver).toHaveBeenCalledWith("early", null);
    expect(shown).toHaveLength(0);
    await expect(handle.current?.requestAuthorization()).resolves.toBe("granted");
    expect(onStatusChange).toHaveBeenCalledWith("granted");
    await handle.current?.schedule({ id: "a", title: "A", body: "b", data: 1 });
    await handle.current?.schedule({ id: "a", title: "A again" });
    await handle.current?.schedule({ id: "b", title: "B", after: 5 });
    await expect(handle.current?.pending()).resolves.toEqual(["a", "b"]);
    act(() => vi.advanceTimersByTime(1000));
    expect(shown.map((entry) => entry.title)).toEqual(["A again"]);
    shown[0]?.listeners.forEach((listener) => listener());
    expect(onOpen).toHaveBeenCalledWith("a", null);
    await handle.current?.cancel(["b"]);
    await handle.current?.schedule({ id: "c", title: "C", after: 9 });
    await handle.current?.cancelAll();
    await expect(handle.current?.pending()).resolves.toEqual([]);
    await handle.current?.setBadge(4);
    expect(setAppBadge).toHaveBeenCalledWith(4);
    FakeNotification.permission = "denied";
    await expect(handle.current?.requestAuthorization()).resolves.toBe("denied");
    await handle.current?.schedule({ id: "d", title: "D" });
    view.unmount();
  });

  it("does without notifications or a badge where the browser has neither", async () => {
    vi.stubGlobal("Notification", undefined);
    const onDeliver = vi.fn();
    const bare = React.createRef<NotificationsHandle>();
    const view = renderWeb(<Notifications handle={bare} onDeliver={onDeliver} />);
    await expect(bare.current?.requestAuthorization()).resolves.toBe("denied");
    await bare.current?.schedule({ id: "e", title: "E", after: 0 });
    await act(() => new Promise((done) => setTimeout(done, 5)));
    expect(onDeliver).toHaveBeenCalledWith("e", null);
    await bare.current?.setBadge(1);
    view.unmount();
  });

  it("is held by useNotifications, which refuses calls before it renders", async () => {
    const { result } = renderHook(() => useNotifications());
    await expect(result.current.requestAuthorization()).rejects.toThrow("Render");
    await expect(result.current.schedule({ id: "a", title: "A" })).rejects.toThrow("Render");
    await expect(result.current.cancel([])).rejects.toThrow("Render");
    await expect(result.current.cancelAll()).rejects.toThrow("Render");
    await expect(result.current.pending()).rejects.toThrow("Render");
    await expect(result.current.setBadge(0)).rejects.toThrow("Render");
    const onDeliver = vi.fn();
    const onStatusChange = vi.fn();
    const onOpen = vi.fn();
    let api: ReturnType<typeof useNotifications> | undefined;
    const Host = () => {
      api = useNotifications({ onDeliver, onStatusChange, onOpen });
      return api.element;
    };
    const view = await mountComponent(<Host />);
    await view.state({ status: "limited" });
    view.event("open", { id: "o", data: null });
    view.event("deliver", { id: "d", data: null });
    expect([onStatusChange.mock.calls, onOpen.mock.calls, onDeliver.mock.calls]).toEqual([
      [["limited"]],
      [["o", null]],
      [["d", null]],
    ]);
    const calls: Array<[() => Promise<unknown> | undefined, string, unknown]> = [
      [
        () => api?.requestAuthorization({ provisional: true }),
        "requestAuthorization",
        { status: "limited" },
      ],
      [() => api?.schedule({ id: "a", title: "A" }), "schedule", undefined],
      [() => api?.cancel(["a"]), "cancel", undefined],
      [() => api?.cancelAll(), "cancelAll", undefined],
      [() => api?.pending(), "pending", { ids: [] }],
      [() => api?.setBadge(1), "setBadge", undefined],
    ];
    for (const [call, name, value] of calls) {
      let pending: Promise<unknown> | undefined;
      await act(async () => {
        pending = call();
      });
      await replyTo(view, name, { ok: true, value });
      await pending;
    }
    const plain = renderHook(() => useNotifications());
    expect(plain.result.current.element).toBeTruthy();
  });

  it("runs without handlers natively", async () => {
    const view = await mountComponent(<Notifications />);
    await view.state({ status: "denied" });
    view.event("open", { id: "o", data: null });
    view.event("deliver", { id: "d", data: null });
  });
});

describe("ContextMenu", () => {
  it("opens a native menu over its children and hears choices and taps", async () => {
    const onSelect = vi.fn();
    const onPress = vi.fn();
    const view = await mountComponent(
      <ContextMenu
        items={[{ id: "share", title: "Share" }]}
        title="Card"
        cornerRadius={12}
        onSelect={onSelect}
        onPress={onPress}
      >
        <div>Card</div>
      </ContextMenu>,
    );
    expect(view.mount).toMatchObject({
      component: "interaction",
      props: { title: "Card", cornerRadius: 12 },
    });
    view.event("select", { id: "share" });
    view.event("press");
    expect(onSelect).toHaveBeenCalledWith("share");
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByText("Card")).toBeTruthy();
  });

  it("opens a web menu on a right click or a long press", () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();
    const view = renderWeb(
      <ContextMenu
        items={[
          { id: "share", title: "Share" },
          {
            id: "more",
            title: "More",
            children: [{ id: "delete", title: "Delete", destructive: true }],
          },
        ]}
        onSelect={onSelect}
      >
        <div>Card</div>
      </ContextMenu>,
    );
    const card = view.container.querySelector(".ni-context-menu");
    if (!card) throw new Error("No card.");
    fireEvent.contextMenu(card);
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onSelect).toHaveBeenCalledWith("delete");
    fireEvent.pointerDown(card);
    act(() => vi.advanceTimersByTime(500));
    fireEvent.click(screen.getByRole("menuitem", { name: "Cancel" }));
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.pointerDown(card);
    fireEvent.pointerUp(card);
    fireEvent.pointerLeave(card);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("LongPressGesture", () => {
  it("hears a native long press and tap", async () => {
    const onLongPress = vi.fn();
    const onPress = vi.fn();
    const view = await mountComponent(
      <LongPressGesture onLongPress={onLongPress} onPress={onPress}>
        <div>Hold</div>
      </LongPressGesture>,
    );
    expect(view.mount.props).toMatchObject({
      longPress: true,
      minimumDuration: 0.5,
      haptic: "medium",
    });
    view.event("longPress");
    view.event("press");
    expect(onLongPress).toHaveBeenCalled();
    expect(onPress).toHaveBeenCalled();
  });

  it("times a pointer held on the web", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const view = renderWeb(
      <LongPressGesture minimumDuration={1} haptic="none" onLongPress={onLongPress}>
        <div>Hold</div>
      </LongPressGesture>,
    );
    const target = view.container.querySelector(".ni-long-press");
    if (!target) throw new Error("No target.");
    fireEvent.pointerDown(target);
    act(() => vi.advanceTimersByTime(1000));
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });
});

describe("MaterialBackground", () => {
  it("draws a material natively with its label on it", async () => {
    const view = await mountComponent(
      <MaterialBackground
        material="glass"
        cornerRadius={20}
        title="Glass"
        subtitle="Clear"
        systemImage="drop"
        tint="#fff"
        glassTint="#000"
      />,
    );
    expect(view.mount).toMatchObject({
      component: "material",
      props: {
        material: "glass",
        cornerRadius: 20,
        title: "Glass",
        subtitle: "Clear",
        systemImage: "drop",
      },
      accessibility: { label: "Glass, Clear" },
    });
    view.unmount();
    const titled = await mountComponent(<MaterialBackground title="Thin" />);
    expect(titled.mount.accessibility).toEqual({ label: "Thin" });
  });

  it("is a translucent box on the web, or the page's own version", () => {
    const view = renderWeb(
      <MaterialBackground material="thick" className="tile" title="T" subtitle="S" />,
    );
    expect(view.container.querySelector(".ni-material.tile")?.getAttribute("data-material")).toBe(
      "thick",
    );
    expect(view.container.textContent).toBe("TS");
    const plain = renderWeb(<MaterialBackground />);
    expect(plain.container.querySelector(".ni-material")?.getAttribute("data-material")).toBe(
      "regular",
    );
    expect(plain.container.querySelector(".ni-material")?.textContent).toBe("");
    const own = renderWeb(
      <MaterialBackground>
        <p>Mine</p>
      </MaterialBackground>,
    );
    expect(own.container.textContent).toBe("Mine");
  });
});
