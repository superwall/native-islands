import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, fireEvent, renderHook, screen } from "@testing-library/react";
import {
  Alert,
  ConfirmationDialog,
  FullScreenCover,
  Inspector,
  Popover,
  Sheet,
  usePresentation,
  usePresentedPage,
  type PresentationHandle,
} from "../../src/components";
import { removeCapability, renderNative } from "../support/react";
import { installComponents, mountComponent, replyTo } from "./support";

beforeEach(installComponents);

afterEach(() => {
  removeCapability();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "__NATIVE_ISLANDS_PRESENTED__");
  Reflect.deleteProperty(window, "webkit");
});

const renderWeb = (ui: React.ReactElement) => {
  removeCapability();
  return renderNative(ui);
};

const stubDialog = () => {
  const showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  Object.assign(HTMLDialogElement.prototype, { showModal });
  return { showModal };
};

afterEach(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
});

describe("Sheet", () => {
  it("presents natively, reports dismissals and messages, and posts down", async () => {
    const onOpenChange = vi.fn();
    const onDismiss = vi.fn();
    const onMessage = vi.fn();
    const onDetentChange = vi.fn();
    const handle = React.createRef<PresentationHandle>();
    const view = await mountComponent(
      <Sheet
        open
        url="?page=sheet"
        detents={["medium", "large"]}
        grabber
        undimmed
        cornerRadius={20}
        handle={handle}
        onOpenChange={onOpenChange}
        onDismiss={onDismiss}
        onMessage={onMessage}
        onDetentChange={onDetentChange}
      />,
    );
    expect(view.mount).toMatchObject({
      component: "presentation",
      props: {
        open: true,
        url: "?page=sheet",
        style: "sheet",
        detents: ["medium", "large"],
        grabber: true,
      },
    });
    expect(view.container.querySelector("dialog")).toBeNull();
    view.event("dismiss", { reason: "user", result: null });
    expect(onDismiss).toHaveBeenCalledWith({ reason: "user", result: null });
    view.event("message", { data: { count: 1 } });
    expect(onMessage).toHaveBeenCalledWith({ count: 1 });
    await view.state({ selectedDetent: "large" });
    expect(onDetentChange).toHaveBeenCalledWith("large");
    await view.state({ open: true });
    expect(onOpenChange).not.toHaveBeenCalled();
    await view.state({ open: false });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await act(async () => handle.current?.post({ hello: true }));
    await replyTo(view, "post", { ok: false, error: "gone" });
  });

  it("is a dialog with the page in a frame on the web, closed by Done, Escape or the page", () => {
    const { showModal } = stubDialog();
    const onOpenChange = vi.fn();
    const onDismiss = vi.fn();
    const onMessage = vi.fn();
    const handle = React.createRef<PresentationHandle>();
    const view = renderWeb(
      <Sheet
        open
        url="/sheet"
        title="Settings"
        handle={handle}
        onOpenChange={onOpenChange}
        onDismiss={onDismiss}
        onMessage={onMessage}
      />,
    );
    expect(showModal).toHaveBeenCalled();
    const frame = view.container.querySelector("iframe");
    if (!frame?.contentWindow) throw new Error("No frame.");
    const post = vi.spyOn(frame.contentWindow, "postMessage");
    handle.current?.post({ to: "page" });
    expect(post).toHaveBeenCalledWith(
      { type: "nativeIslandsPresentation", data: { to: "page" } },
      "*",
    );
    const send = (data: unknown, source: unknown = frame.contentWindow) =>
      act(() => {
        window.dispatchEvent(new MessageEvent("message", { data, source: source as Window }));
      });
    send({ type: "other" });
    send({ type: "nativeIslandsPresentation", action: "dismiss" }, window);
    expect(onDismiss).not.toHaveBeenCalled();
    send({ type: "nativeIslandsPresentation", action: "message", data: 3 });
    send({ type: "nativeIslandsPresentation", action: "message" });
    expect(onMessage.mock.calls).toEqual([[3], [null]]);
    send({ type: "nativeIslandsPresentation", action: "noop" });
    send({ type: "nativeIslandsPresentation", action: "dismiss", result: { ok: 1 } });
    send({ type: "nativeIslandsPresentation", action: "dismiss" });
    expect(onDismiss.mock.calls).toEqual([
      [{ reason: "page", result: { ok: 1 } }],
      [{ reason: "page", result: null }],
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    const dialog = view.container.querySelector("dialog");
    if (!dialog) throw new Error("No dialog.");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(onDismiss).toHaveBeenLastCalledWith({ reason: "user", result: null });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    view.rerender(<Sheet open={false} url="/sheet" onOpenChange={onOpenChange} />);
    expect(view.container.querySelector("dialog")).toBeNull();
  });

  it("keeps a dialog that can't be dismissed, and shows one only once", () => {
    const { showModal } = stubDialog();
    const onDismiss = vi.fn();
    const view = renderWeb(
      <Sheet open url="/p" dismissible={false} onOpenChange={() => {}} onDismiss={onDismiss} />,
    );
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    const dialog = view.container.querySelector("dialog");
    if (!dialog) throw new Error("No dialog.");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(onDismiss).not.toHaveBeenCalled();
    view.rerender(<Sheet open url="/q" dismissible={false} onOpenChange={() => {}} />);
    expect(showModal).toHaveBeenCalledTimes(1);
  });

  it("draws no dialog where the browser has none to show", () => {
    const view = renderWeb(<Sheet open url="/p" onOpenChange={() => {}} />);
    expect(view.container.querySelector("dialog")?.hasAttribute("open")).toBe(false);
  });

  it("presents with no native host when native is off", async () => {
    stubDialog();
    const handle = React.createRef<PresentationHandle>();
    const view = renderNative(
      <Sheet open native={false} url="/p" handle={handle} onOpenChange={() => {}} />,
    );
    await view.nextFrame();
    expect(view.container.querySelector("dialog")).not.toBeNull();
    handle.current?.post(1);
  });
});

describe("the other presentations", () => {
  it("are covers, popovers around their anchor, and inspectors", async () => {
    const cover = await mountComponent(
      <FullScreenCover
        open
        url="/c"
        title="Cover"
        header={false}
        background="#123456"
        onOpenChange={() => {}}
      />,
    );
    expect(cover.mount.props).toMatchObject({
      style: "fullScreenCover",
      title: "Cover",
      header: false,
      // Resolved to a colour the host reads, as every colour prop is.
      background: "rgb(18, 52, 86)",
    });
    cover.unmount();
    const popover = await mountComponent(
      <Popover open url="/p" width={300} height={200} compact="sheet" onOpenChange={() => {}}>
        <button type="button">Anchor</button>
      </Popover>,
    );
    expect(popover.mount.props).toMatchObject({
      style: "popover",
      width: 300,
      height: 200,
      compact: "sheet",
    });
    expect(screen.getByRole("button", { name: "Anchor" })).toBeTruthy();
    // The anchor comes first, so the islands of the children stay above it and take the taps.
    const anchored = screen.getByRole("button", { name: "Anchor" }).closest(".ni-anchored");
    expect(anchored?.lastElementChild?.textContent).toBe("Anchor");
    popover.unmount();
    const inspector = await mountComponent(
      <Inspector open url="/i" detents={["large"]} onOpenChange={() => {}} />,
    );
    expect(inspector.mount.props).toMatchObject({ style: "inspector", detents: ["large"] });
  });

  it("sizes a popover's web version", () => {
    stubDialog();
    const view = renderWeb(
      <Popover open url="/p" width={300} height={200} onOpenChange={() => {}} />,
    );
    expect(view.container.querySelector("dialog")?.getAttribute("style")).toContain("300px");
    const bare = renderWeb(<Popover open url="/p" onOpenChange={() => {}} />);
    expect(bare.container.querySelector("dialog")?.getAttribute("style") ?? "").not.toContain("px");
  });
});

describe("usePresentation", () => {
  it("holds open state and the props to spread", () => {
    const { result } = renderHook(() => usePresentation());
    expect(result.current.open).toBe(false);
    act(() => result.current.present());
    expect(result.current.props.open).toBe(true);
    act(() => result.current.dismiss());
    expect(result.current.open).toBe(false);
    act(() => result.current.props.onOpenChange(true));
    expect(result.current.open).toBe(true);
  });
});

describe("usePresentedPage", () => {
  it("knows it is not presented on its own, and sends nothing then", () => {
    const post = vi.spyOn(window, "postMessage");
    const { result } = renderHook(() => usePresentedPage());
    expect(result.current).toMatchObject({ presented: false, style: undefined });
    result.current.dismiss();
    result.current.send(1);
    expect(post).not.toHaveBeenCalled();
  });

  it("talks to the app when the app presented it", () => {
    const postMessage = vi.fn();
    const onMessage = vi.fn();
    const { result } = renderHook(() => usePresentedPage(onMessage));
    act(() => {
      Object.assign(window, {
        __NATIVE_ISLANDS_PRESENTED__: { style: "popover" },
        webkit: { messageHandlers: { nativeIslandsPresentation: { postMessage } } },
      });
      window.dispatchEvent(new Event("nativeislandspresented"));
    });
    expect(result.current).toMatchObject({ presented: true, style: "popover" });
    result.current.dismiss({ ok: true });
    result.current.dismiss();
    result.current.send([1]);
    expect(postMessage.mock.calls).toEqual([
      [{ type: "dismiss", result: { ok: true }, data: null }],
      [{ type: "dismiss", result: null, data: null }],
      [{ type: "message", result: null, data: [1] }],
    ]);
    act(() => {
      window.dispatchEvent(
        new CustomEvent("nativeislandspresentation", { detail: { data: "down" } }),
      );
      window.dispatchEvent(new CustomEvent("nativeislandspresentation", { detail: {} }));
      window.dispatchEvent(new Event("nativeislandspresentation"));
    });
    expect(onMessage.mock.calls).toEqual([["down"], [null], [null]]);
    act(() => {
      Object.assign(window, { __NATIVE_ISLANDS_PRESENTED__: {} });
      window.dispatchEvent(new Event("nativeislandspresented"));
    });
    expect(result.current.style).toBe("sheet");
  });

  it("knows the detent its sheet rests at, hears it change, and asks for another", () => {
    const postMessage = vi.fn();
    Object.assign(window, {
      __NATIVE_ISLANDS_PRESENTED__: { style: "sheet", detent: "medium" },
      webkit: { messageHandlers: { nativeIslandsPresentation: { postMessage } } },
    });
    const onMessage = vi.fn();
    const { result } = renderHook(() => usePresentedPage(onMessage));
    expect(result.current.detent).toBe("medium");
    act(() => {
      window.dispatchEvent(
        new CustomEvent("nativeislandspresentation", {
          detail: { type: "detent", detent: "large" },
        }),
      );
      // Not a detent: a number, or no detent at all, is a message.
      window.dispatchEvent(
        new CustomEvent("nativeislandspresentation", { detail: { type: "detent", detent: 3 } }),
      );
      window.dispatchEvent(
        new CustomEvent("nativeislandspresentation", { detail: { type: "detent" } }),
      );
    });
    expect(result.current.detent).toBe("large");
    expect(onMessage.mock.calls).toEqual([[null], [null]]);
    result.current.setDetent("medium");
    expect(postMessage).toHaveBeenCalledWith({
      type: "detent",
      result: null,
      data: null,
      detent: "medium",
    });
  });

  it("talks to the page around its frame on the web", () => {
    const parent = { postMessage: vi.fn() };
    vi.spyOn(window, "parent", "get").mockReturnValue(parent as unknown as Window);
    const onMessage = vi.fn();
    const { result, unmount } = renderHook(() => usePresentedPage(onMessage));
    expect(result.current.style).toBe("sheet");
    result.current.dismiss(2);
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: "nativeIslandsPresentation", action: "dismiss", result: 2 },
      "*",
    );
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "nativeIslandsPresentation", data: 5 },
          source: parent as unknown as Window,
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "nativeIslandsPresentation" },
          source: parent as unknown as Window,
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", { data: { type: "nativeIslandsPresentation", data: 6 } }),
      );
    });
    expect(onMessage.mock.calls).toEqual([[5], [null]]);
    unmount();
  });
});

describe("Alert", () => {
  it("shows natively and reports the button and what was typed", async () => {
    const onAction = vi.fn();
    const onOpenChange = vi.fn();
    const view = await mountComponent(
      <Alert
        open
        title="Rename"
        message="A name"
        textFields={[{ id: "name", placeholder: "Name" }]}
        onAction={onAction}
        onOpenChange={onOpenChange}
      />,
    );
    expect(view.mount).toMatchObject({
      component: "alert",
      props: {
        style: "alert",
        title: "Rename",
        buttons: [{ id: "ok", title: "OK", role: "cancel" }],
      },
    });
    view.event("action", { id: "ok", values: { name: "A" } });
    expect(onAction).toHaveBeenCalledWith("ok", { name: "A" });
    await view.state({ open: true });
    await view.state({ open: false });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("is a dialog of buttons and fields on the web", () => {
    const { showModal } = stubDialog();
    const onAction = vi.fn();
    const onOpenChange = vi.fn();
    const view = renderWeb(
      <Alert
        open
        title="Rename"
        message="Pick a name"
        tint="#f00"
        textFields={[
          { id: "name", placeholder: "Name", text: "Old" },
          { id: "secret", secure: true },
        ]}
        buttons={[
          { id: "cancel", title: "Cancel", role: "cancel" },
          { id: "save", title: "Save", preferred: true },
        ]}
        onAction={onAction}
        onOpenChange={onOpenChange}
      />,
    );
    expect(showModal).toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "New" } });
    expect(view.container.querySelector("input[type=password]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onAction).toHaveBeenCalledWith("save", { name: "New", secret: "" });
    const dialog = view.container.querySelector("dialog");
    if (!dialog) throw new Error("No dialog.");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(onAction).toHaveBeenLastCalledWith("cancel", { name: "New", secret: "" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("can't be cancelled without a cancel button, and draws nothing closed", () => {
    stubDialog();
    const onAction = vi.fn();
    const view = renderWeb(
      <Alert
        open
        buttons={[{ id: "a", title: "A" }]}
        onAction={onAction}
        onOpenChange={() => {}}
      />,
    );
    const dialog = view.container.querySelector("dialog");
    if (!dialog) throw new Error("No dialog.");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    expect(onAction).toHaveBeenCalledWith("a", {});
    const closed = renderWeb(<Alert open={false} onOpenChange={() => {}} />);
    expect(closed.container.querySelector("dialog")).toBeNull();
    const plain = renderNative(<Alert open native={false} onOpenChange={() => {}} />);
    expect(plain.container.querySelector("dialog")).not.toBeNull();
  });
});

describe("ConfirmationDialog", () => {
  it("anchors to its children", async () => {
    const view = await mountComponent(
      <ConfirmationDialog open title="Sure?" onOpenChange={() => {}}>
        <button type="button">Sign Out</button>
      </ConfirmationDialog>,
    );
    expect(view.mount.props).toMatchObject({ style: "confirmationDialog", title: "Sure?" });
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeTruthy();
  });
});
