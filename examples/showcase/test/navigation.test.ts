import { describe, expect, it } from "bun:test";
import {
  canGoBack,
  initialState,
  navigate,
  placeOf,
  renderedScreens,
  topOf,
  type NavState,
  type TabId,
} from "../src/app/navigation";

const TAB_OF: Record<string, TabId> = {
  components: "components",
  buttons: "components",
  toggles: "components",
  settings: "settings",
  appearance: "settings",
};
const tabOf = (screen: string) => TAB_OF[screen];
const start = (search = "") => initialState(search, tabOf);

const pushed = (state: NavState, screen: string): NavState => {
  const mounting = navigate(state, { type: "push", screen });
  const key = mounting.transition?.key ?? -1;
  return navigate(navigate(mounting, { type: "move", key }), { type: "finish", key });
};

describe("initialState", () => {
  it("opens on Components with every tab at its root", () => {
    const state = start();
    expect(state.tab).toBe("components");
    expect(state.stacks).toEqual({
      components: ["components"],
      capabilities: ["capabilities"],
      settings: ["settings"],
    });
  });

  it("opens the tab the URL names", () => {
    expect(start("?tab=settings").tab).toBe("settings");
    expect(start("?tab=nowhere").tab).toBe("components");
  });

  it("opens a screen on its own tab with the root behind it", () => {
    const state = start("?tab=capabilities&screen=appearance");
    expect(state.tab).toBe("settings");
    expect(state.stacks.settings).toEqual(["settings", "appearance"]);
  });

  it("ignores a screen it does not know", () => {
    const state = start("?screen=nowhere");
    expect(state.stacks.components).toEqual(["components"]);
  });
});

describe("push", () => {
  it("mounts the screen first, then moves it, then settles", () => {
    const mounting = navigate(start(), { type: "push", screen: "buttons" });
    expect(mounting.transition).toMatchObject({
      kind: "push",
      screen: "buttons",
      stage: "mounting",
    });
    expect(placeOf(mounting, "components", "buttons")).toBe("away");
    expect(placeOf(mounting, "components", "components")).toBe("top");

    const key = mounting.transition?.key ?? -1;
    const moving = navigate(mounting, { type: "move", key });
    expect(moving.transition?.stage).toBe("moving");
    expect(placeOf(moving, "components", "buttons")).toBe("top");
    expect(placeOf(moving, "components", "components")).toBe("below");

    const settled = navigate(moving, { type: "finish", key });
    expect(settled.transition).toBeUndefined();
    expect(topOf(settled)).toBe("buttons");
    expect(canGoBack(settled)).toBe(true);
  });

  it("ignores a push while another transition runs, or of the screen on top", () => {
    const mounting = navigate(start(), { type: "push", screen: "buttons" });
    expect(navigate(mounting, { type: "push", screen: "toggles" })).toBe(mounting);
    const settled = pushed(start(), "buttons");
    expect(navigate(settled, { type: "push", screen: "buttons" })).toBe(settled);
  });

  it("moves a screen already in the stack to the top instead of adding it twice", () => {
    const state = pushed(pushed(pushed(start(), "buttons"), "toggles"), "buttons");
    expect(state.stacks.components).toEqual(["components", "toggles", "buttons"]);
  });

  it("ignores stale move and finish keys", () => {
    const mounting = navigate(start(), { type: "push", screen: "buttons" });
    expect(navigate(mounting, { type: "move", key: 99 })).toBe(mounting);
    expect(navigate(mounting, { type: "finish", key: 99 })).toBe(mounting);
  });
});

describe("pop", () => {
  it("keeps the leaving screen rendered on top until it finishes", () => {
    const state = navigate(pushed(start(), "buttons"), { type: "pop", animated: true });
    expect(state.stacks.components).toEqual(["components"]);
    expect(renderedScreens(state, "components")).toEqual(["components", "buttons"]);
    expect(placeOf(state, "components", "buttons")).toBe("top");
    expect(placeOf(state, "components", "components")).toBe("below");
    const done = navigate(state, { type: "finish", key: state.transition?.key ?? -1 });
    expect(renderedScreens(done, "components")).toEqual(["components"]);
  });

  it("pops at once after a swipe, which already moved the screens", () => {
    const state = navigate(pushed(start(), "buttons"), { type: "pop", animated: false });
    expect(state.transition).toBeUndefined();
    expect(topOf(state)).toBe("components");
  });

  it("never pops a root", () => {
    const state = start();
    expect(navigate(state, { type: "pop", animated: true })).toBe(state);
  });
});

describe("select", () => {
  it("switches tabs and keeps each tab's stack", () => {
    const deep = pushed(start(), "buttons");
    const settings = navigate(deep, { type: "select", tab: "settings" });
    expect(topOf(settings)).toBe("settings");
    expect(placeOf(settings, "components", "buttons")).toBe("away");
    const back = navigate(settings, { type: "select", tab: "components" });
    expect(topOf(back)).toBe("buttons");
  });

  it("pops to the root when the current tab is selected again", () => {
    const deep = pushed(pushed(start(), "buttons"), "toggles");
    const root = navigate(deep, { type: "select", tab: "components" });
    expect(root.stacks.components).toEqual(["components"]);
    const again = navigate(root, { type: "select", tab: "components" });
    expect(again).toBe(root);
  });
});

describe("placeOf", () => {
  it("parks screens deeper than the one below", () => {
    const state = pushed(pushed(start(), "buttons"), "toggles");
    expect(placeOf(state, "components", "toggles")).toBe("top");
    expect(placeOf(state, "components", "buttons")).toBe("below");
    expect(placeOf(state, "components", "components")).toBe("away");
  });
});
