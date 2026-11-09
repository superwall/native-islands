import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { HapticButton, Permission, ShareButton, Tip, type TipHandle } from "../../src/components";
import { askBrowser, fromBrowser, vibrationOf } from "../../src/components/system";
import { removeCapability, renderNative } from "../support/react";
import { installComponents, mountComponent, replyTo } from "./support";

beforeEach(installComponents);

afterEach(() => {
  removeCapability();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const renderWeb = (ui: React.ReactElement) => {
  removeCapability();
  return renderNative(ui);
};

describe("HapticButton", () => {
  it("plays natively and reports the press", async () => {
    const onPress = vi.fn();
    const view = await mountComponent(
      <HapticButton title="Tap" feedback="success" prominence="prominent" onPress={onPress} />,
    );
    expect(view.mount).toMatchObject({
      component: "hapticButton",
      props: { title: "Tap", feedback: "success", prominence: "prominent" },
      accessibility: { label: "Tap" },
    });
    view.event("press");
    expect(onPress).toHaveBeenCalled();
  });

  it("vibrates where a browser can, in its web version", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, vibrate });
    const onPress = vi.fn();
    renderWeb(<HapticButton title="Heavy" feedback="heavy" icon={<i />} onPress={onPress} />);
    fireEvent.click(screen.getByRole("button", { name: "Heavy" }));
    expect(vibrate).toHaveBeenCalledWith(30);
    expect(onPress).toHaveBeenCalled();
    vi.stubGlobal("navigator", { ...navigator, vibrate: undefined });
    renderWeb(<HapticButton title="Light" feedback="light" />);
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
  });

  it("vibrates longer for heavy feedback, and takes its own web version", () => {
    expect([vibrationOf("light"), vibrationOf("rigid"), vibrationOf("error")]).toEqual([
      10, 30, 30,
    ]);
    const view = renderWeb(
      <HapticButton feedback="soft">
        <p>Soft</p>
      </HapticButton>,
    );
    expect(view.container.textContent).toBe("Soft");
  });
});

describe("ShareButton", () => {
  it("shares natively and reports the activity", async () => {
    const onComplete = vi.fn();
    const view = await mountComponent(
      <ShareButton text="Hi" url="https://a.test" onComplete={onComplete} />,
    );
    expect(view.mount).toMatchObject({
      component: "shareButton",
      props: { text: "Hi", url: "https://a.test", systemImage: "square.and.arrow.up" },
      accessibility: { label: "Share" },
    });
    view.event("complete", { activity: null });
    expect(onComplete).toHaveBeenCalledWith(null);
  });

  it("uses the Web Share API in its web version", async () => {
    const share = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("No."));
    vi.stubGlobal("navigator", { ...navigator, share });
    const onComplete = vi.fn();
    renderWeb(<ShareButton title="Send" text="Hi" url="u" onComplete={onComplete} />);
    const button = screen.getByRole("button", { name: "Send" });
    fireEvent.click(button);
    await waitFor(() => expect(onComplete).toHaveBeenLastCalledWith("done"));
    fireEvent.click(button);
    await waitFor(() => expect(onComplete).toHaveBeenLastCalledWith(null));
    expect(share).toHaveBeenCalledWith({ text: "Hi", url: "u" });
  });

  it("copies to the clipboard without the Web Share API", async () => {
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("No."));
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });
    const onComplete = vi.fn();
    renderWeb(<ShareButton title="Send" url="u" onComplete={onComplete} />);
    const button = screen.getByRole("button", { name: "Send" });
    fireEvent.click(button);
    await waitFor(() => expect(onComplete).toHaveBeenLastCalledWith("CopyToPasteboard"));
    expect(writeText).toHaveBeenCalledWith("u");
    fireEvent.click(button);
    await waitFor(() => expect(onComplete).toHaveBeenLastCalledWith(null));
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: undefined });
    fireEvent.click(button);
  });

  it("takes its own web version", () => {
    const view = renderWeb(
      <ShareButton>
        <p>Share</p>
      </ShareButton>,
    );
    expect(view.container.textContent).toBe("Share");
  });
});

describe("Permission", () => {
  it("reports the status iOS holds", async () => {
    const onStatus = vi.fn();
    const view = await mountComponent(
      <Permission kind="camera" label="Camera" tint="red" onStatus={onStatus} />,
    );
    expect(view.mount).toMatchObject({
      component: "permission",
      sizing: "native",
      props: { kind: "camera", tint: "rgb(255, 0, 0)" },
      accessibility: { label: "Camera" },
    });
    await view.state({ other: 1 });
    expect(onStatus).not.toHaveBeenCalled();
    await view.state({ status: "granted" });
    expect(onStatus).toHaveBeenCalledWith("granted");
  });

  it("asks the browser in its web version and shows the answer", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error("No.")) },
    });
    const onStatus = vi.fn();
    const view = renderWeb(<Permission kind="microphone" label="Microphone" onStatus={onStatus} />);
    fireEvent.click(screen.getByRole("button", { name: "Allow Microphone" }));
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("denied"));
    expect(view.container.querySelector(".ni-permission-status")?.textContent).toBe("Denied");
    renderWeb(<Permission kind="photos" label="Photos" />);
    fireEvent.click(screen.getByRole("button", { name: "Allow Photos" }));
    await waitFor(() => expect(screen.getByText("Allowed")).toBeTruthy());
  });

  it("takes its own web version", () => {
    const view = renderWeb(
      <Permission kind="location" label="Location">
        <p>Ask</p>
      </Permission>,
    );
    expect(view.container.textContent).toBe("Ask");
  });

  it("reads browser states and asks for each kind", async () => {
    expect(["granted", "denied", "prompt", "default"].map(fromBrowser)).toEqual([
      "granted",
      "denied",
      "notDetermined",
      "notDetermined",
    ]);
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
    let answer: "granted" | "denied" | "unavailable" = "granted";
    const getCurrentPosition = vi.fn(
      (resolve: () => void, reject: (error: { code: number; PERMISSION_DENIED: number }) => void) =>
        answer === "granted"
          ? resolve()
          : reject({ code: answer === "denied" ? 1 : 2, PERMISSION_DENIED: 1 }),
    );
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: { getUserMedia },
      geolocation: { getCurrentPosition },
    });
    vi.stubGlobal("Notification", { requestPermission: vi.fn().mockResolvedValue("granted") });
    await expect(askBrowser("camera")).resolves.toBe("granted");
    expect(getUserMedia).toHaveBeenLastCalledWith({ video: true });
    await expect(askBrowser("microphone")).resolves.toBe("granted");
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: true });
    expect(stop).toHaveBeenCalledTimes(2);
    await expect(askBrowser("location")).resolves.toBe("granted");
    answer = "denied";
    await expect(askBrowser("location")).resolves.toBe("denied");
    answer = "unavailable";
    await expect(askBrowser("location")).resolves.toBe("notDetermined");
    await expect(askBrowser("notifications")).resolves.toBe("granted");
  });
});

describe("Tip", () => {
  it("shows TipKit's tip natively and reports its buttons and closing", async () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    const handle = React.createRef<TipHandle>();
    const actions = [{ id: "learn", title: "Learn More" }];
    const view = await mountComponent(
      <Tip
        id="favorites"
        title="Save it"
        message="Tap the star."
        systemImage="star"
        actions={actions}
        arrowEdge="top"
        handle={handle}
        onAction={onAction}
        onDismiss={onDismiss}
      />,
    );
    expect(view.mount).toMatchObject({
      component: "tip",
      sizing: "web",
      props: {
        id: "favorites",
        title: "Save it",
        message: "Tap the star.",
        actions,
        arrowEdge: "top",
      },
      accessibility: { label: "Save it" },
    });
    view.event("action", { id: "learn" });
    view.event("dismiss");
    expect(onAction).toHaveBeenCalledWith("learn");
    expect(onDismiss).toHaveBeenCalled();
    expect(view.container.querySelector(".ni-tip")).not.toBeNull();
    await view.state({ shown: false });
    expect(view.container.querySelector(".ni-tip")).toBeNull();
    await view.state({ shown: true });
    expect(view.container.querySelector(".ni-tip")).not.toBeNull();
    await act(async () => handle.current?.invalidate());
    await replyTo(view, "invalidate", { ok: false, error: "Gone." });
  });

  it("is a card in its web version until closed", () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    const view = renderWeb(
      <Tip
        id="t"
        title="Save it"
        message="Tap the star."
        icon={<i data-testid="star" />}
        actions={[{ id: "learn", title: "Learn More" }]}
        arrowEdge="bottom"
        onAction={onAction}
        onDismiss={onDismiss}
      />,
    );
    expect(view.container.querySelector(".ni-tip")?.getAttribute("data-arrow")).toBe("bottom");
    expect(screen.getByTestId("star")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Learn More" }));
    expect(onAction).toHaveBeenCalledWith("learn");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onDismiss).toHaveBeenCalled();
    expect(view.container.querySelector(".ni-tip")).toBeNull();
  });

  it("closes for good from its handle, and works without handlers or extras", async () => {
    const handle = React.createRef<TipHandle>();
    const view = renderWeb(<Tip id="t" title="Plain" actions={[]} handle={handle} />);
    expect(view.container.querySelector(".ni-tip-actions")).toBeNull();
    expect(view.container.querySelector(".ni-tip-message")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    const again = renderWeb(<Tip id="u" title="Other" handle={handle} />);
    await act(async () => handle.current?.invalidate());
    expect(again.container.querySelector(".ni-tip")).toBeNull();
    const own = renderWeb(
      <Tip id="v" title="Own" onAction={vi.fn()}>
        <p>Own tip</p>
      </Tip>,
    );
    expect(own.container.textContent).toBe("Own tip");
  });
});
