import { afterEach, describe, expect, it, vi } from "vitest";
import {
  animatesGeometry,
  createLayoutWatcher,
  HOT_MS,
  isGeometric,
  layoutWatcherFor,
  LIVE_LAYOUT_EVERY,
  PRUNE_EVERY,
  type LayoutPass,
} from "../../src/layout/watcher";
import { remember } from "../../src/layout/pass";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const transition = (type: string, target: Element, propertyName: string) => {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { propertyName });
  target.dispatchEvent(event);
};

const animation = (type: string, target: Element, animationName: string) => {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { animationName });
  target.dispatchEvent(event);
};

describe("isGeometric", () => {
  it("knows what moves an element and what only repaints it", () => {
    for (const property of [
      "all",
      "transform",
      "opacity",
      "top",
      "margin-top",
      "padding",
      "inset-inline",
      "max-height",
      "width",
      "font-size",
      "gap",
      "border-left-width",
      "flex-basis",
      "grid-template-columns",
    ]) {
      expect(isGeometric(property)).toBe(true);
    }
    for (const property of [
      "color",
      "background-color",
      "box-shadow",
      "border-color",
      "border-left-color",
    ]) {
      expect(isGeometric(property)).toBe(false);
    }
  });
});

describe("animatesGeometry", () => {
  const withAnimations = (animations: unknown[]) =>
    Object.assign(document.createElement("div"), { getAnimations: () => animations });

  it("reads the keyframes of the named animation", () => {
    const keyframes = (frames: object[]) => ({ getKeyframes: () => frames });
    const element = withAnimations([
      { animationName: "pulse", effect: keyframes([{ offset: 0, backgroundColor: "red" }]) },
      {
        animationName: "slide",
        effect: keyframes([{ offset: 0, easing: "linear", transform: "x" }]),
      },
    ]);
    expect(animatesGeometry(element, "pulse")).toBe(false);
    expect(animatesGeometry(element, "slide")).toBe(true);
  });

  it("assumes movement when it cannot tell", () => {
    expect(animatesGeometry(withAnimations([]), "x")).toBe(true);
    expect(animatesGeometry(withAnimations([{ animationName: "x", effect: null }]), "x")).toBe(
      true,
    );
    expect(animatesGeometry(withAnimations([{ animationName: "x", effect: {} }]), "x")).toBe(true);
    const bare = document.createElement("div");
    Object.assign(bare, { getAnimations: undefined });
    expect(animatesGeometry(bare, "x")).toBe(true);
  });
});

describe("createLayoutWatcher", () => {
  let clock = 0;

  const setup = () => {
    clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      queue.push(callback),
    );
    const passes: LayoutPass[] = [];
    const watcher = createLayoutWatcher(document);
    const stop = watcher.subscribe((pass) => passes.push(pass));
    const frame = (ms = 16) => {
      clock += ms;
      queue.splice(0).forEach((callback) => callback(clock));
    };
    return { watcher, stop, passes, frame, queue };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tracks geometric transitions on an element until they end or cancel", () => {
    const { watcher, stop } = setup();
    const card = document.createElement("div");
    document.body.appendChild(card);
    transition("transitionrun", card, "background-color");
    expect(watcher.isMoving(card)).toBe(false);
    transition("transitionrun", card, "transform");
    transition("transitionrun", card, "opacity");
    expect(watcher.isMoving(card)).toBe(true);
    transition("transitionend", card, "transform");
    expect(watcher.isMoving(card)).toBe(true);
    transition("transitioncancel", card, "opacity");
    expect(watcher.isMoving(card)).toBe(false);
    transition("transitionrun", document as unknown as Element, "transform");
    transition("transitionend", document as unknown as Element, "transform");
    stop();
  });

  it("runs a layout pass after a change, then frame passes until it cools down", () => {
    const { stop, passes, frame, queue } = setup();
    document.dispatchEvent(new Event("scroll"));
    frame();
    expect(passes).toEqual(["layout"]);
    while (clock < HOT_MS + 16) frame();
    expect(passes.slice(1).every((pass) => pass === "frame")).toBe(true);
    expect(passes.length).toBeGreaterThan(10);
    frame();
    expect(queue).toHaveLength(0);
    const count = passes.length;
    frame();
    expect(passes).toHaveLength(count);
    stop();
  });

  it("writes nothing to the document on a pass, so frame passes restyle nothing", () => {
    const { watcher, stop, frame } = setup();
    const root = document.documentElement;
    const set = vi.spyOn(root, "setAttribute");
    const removed = vi.spyOn(root, "removeAttribute");
    const seen: number[] = [];
    const stopSecond = watcher.subscribe(() => seen.push(1));
    document.dispatchEvent(new Event("scroll"));
    frame();
    frame();
    expect(seen.length).toBeGreaterThan(1);
    expect(set).not.toHaveBeenCalled();
    expect(removed).not.toHaveBeenCalled();
    stopSecond();
    stop();
  });

  it("runs every listener of a pass in one layout pass, sharing what they read", () => {
    const { watcher, stop, frame } = setup();
    const scroller = document.createElement("div");
    const read = vi.fn(() => ({ x: 0, y: 0 }));
    const stopOne = watcher.subscribe(() => remember(scroller, "offset", read));
    const stopTwo = watcher.subscribe(() => remember(scroller, "offset", read));
    document.dispatchEvent(new Event("scroll"));
    frame();
    expect(read).toHaveBeenCalledTimes(1);
    frame();
    expect(read).toHaveBeenCalledTimes(2);
    stopOne();
    stopTwo();
    stop();
  });

  it("heats up on a tap or key without a layout pass", () => {
    const { stop, passes, frame } = setup();
    document.dispatchEvent(new Event("pointerdown"));
    frame();
    document.dispatchEvent(new Event("keydown"));
    frame();
    expect(passes).toEqual(["frame", "frame"]);
    stop();
  });

  it("re-lays out on resize, DOM changes, image loads and errors", async () => {
    const { stop, passes, frame } = setup();
    window.dispatchEvent(new Event("resize"));
    frame();
    document.body.appendChild(document.createElement("p"));
    await Promise.resolve();
    frame();
    const image = document.createElement("img");
    document.body.appendChild(image);
    await Promise.resolve();
    frame();
    image.dispatchEvent(new Event("load"));
    frame();
    image.dispatchEvent(new Event("error"));
    frame();
    expect(passes.filter((pass) => pass === "layout")).toHaveLength(5);
    stop();
  });

  it("ignores attributes it does not watch and the simulator's own layer", async () => {
    const { stop, passes, frame } = setup();
    const island = document.createElement("span");
    const layer = document.createElement("div");
    layer.dataset.islandSimulatorLayer = "screen";
    document.body.append(island, layer);
    await Promise.resolve();
    frame();
    while (clock < HOT_MS * 2) frame();
    passes.length = 0;
    island.setAttribute("data-island-probe", "");
    layer.style.left = "4px";
    await Promise.resolve();
    frame();
    expect(passes).toEqual([]);
    island.setAttribute("inert", "");
    await Promise.resolve();
    frame();
    expect(passes).toEqual(["layout"]);
    stop();
  });

  it("keeps running while a geometric animation is live, with a layout pass every few frames", () => {
    const { stop, passes, frame } = setup();
    const pulse = document.createElement("div");
    Object.assign(pulse, { getAnimations: () => [{ playState: "running" }] });
    document.body.appendChild(pulse);
    animation("animationstart", pulse, "pulse");
    for (let index = 0; index < 120; index += 1) frame();
    expect(passes).toHaveLength(120);
    const layouts = passes.filter((pass) => pass === "layout").length;
    expect(layouts).toBeGreaterThanOrEqual(Math.floor(120 / LIVE_LAYOUT_EVERY) - 1);
    animation("animationend", pulse, "pulse");
    while (clock < 120 * 16 + HOT_MS + 32) frame();
    const count = passes.length;
    frame();
    expect(passes).toHaveLength(count);
    stop();
  });

  it("forgets animations that were paused or removed without an end event", () => {
    const { stop, passes, frame } = setup();
    const paused = document.createElement("div");
    let state = "running";
    Object.assign(paused, { getAnimations: () => [{ playState: state }] });
    const removed = document.createElement("div");
    const bare = document.createElement("div");
    Object.assign(bare, { getAnimations: undefined });
    document.body.append(paused, removed, bare);
    animation("animationstart", paused, "a");
    animation("animationstart", removed, "b");
    animation("animationstart", bare, "c");
    removed.remove();
    bare.remove();
    state = "paused";
    for (let index = 0; index < PRUNE_EVERY; index += 1) frame();
    while (clock < PRUNE_EVERY * 16 + HOT_MS + 32) frame();
    const count = passes.length;
    frame();
    expect(passes).toHaveLength(count);
    stop();
  });

  it("ignores colour-only animations and end events it never saw start", () => {
    const { stop, frame, queue } = setup();
    const glow = document.createElement("div");
    Object.assign(glow, {
      getAnimations: () => [
        { animationName: "glow", effect: { getKeyframes: () => [{ color: "red" }] } },
      ],
    });
    document.body.appendChild(glow);
    animation("animationstart", glow, "glow");
    expect(queue).toHaveLength(0);
    animation("animationend", glow, "other");
    animation("animationstart", document as unknown as Element, "x");
    animation("animationend", document as unknown as Element, "x");
    frame();
    stop();
  });

  it("ignores animations in the hidden web version of a shown island", () => {
    const { stop, passes, frame, queue } = setup();
    const container = document.createElement("div");
    const wrapper = container.appendChild(document.createElement("div"));
    wrapper.setAttribute("data-island", "Button");
    wrapper.setAttribute("data-island-shown", "");
    const box = wrapper.appendChild(document.createElement("div"));
    const spinner = box.appendChild(document.createElement("span"));
    for (const element of [container, box, spinner]) {
      Object.assign(element, { getAnimations: () => [{ playState: "running" }] });
    }
    document.body.appendChild(container);
    // The box the native view follows and everything in it are the hidden
    // web version: the island styles stop their animations.
    animation("animationstart", spinner, "spin");
    animation("animationstart", box, "spin");
    expect(queue).toHaveLength(0);
    // An ancestor's animation still moves the island.
    animation("animationstart", container, "slide");
    for (let index = 0; index < 60; index += 1) frame();
    expect(passes).toHaveLength(60);
    animation("animationend", container, "slide");
    while (clock < 60 * 16 + HOT_MS + 32) frame();
    const count = passes.length;
    frame();
    expect(passes).toHaveLength(count);
    stop();
  });

  it("lets go of an animation once its island's native view shows", () => {
    const { stop, passes, frame } = setup();
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-island", "Button");
    const spinner = document.createElement("span");
    Object.assign(spinner, { getAnimations: () => [{ playState: "running" }] });
    wrapper.appendChild(spinner);
    document.body.appendChild(wrapper);
    animation("animationstart", spinner, "spin");
    for (let index = 0; index < PRUNE_EVERY - 1; index += 1) frame();
    wrapper.setAttribute("data-island-shown", "");
    frame();
    while (clock < PRUNE_EVERY * 16 + HOT_MS + 32) frame();
    const count = passes.length;
    frame();
    expect(passes).toHaveLength(count);
    stop();
  });

  it("keeps a second animation on the same element live after the first ends", () => {
    const { stop, passes, frame } = setup();
    const element = document.createElement("div");
    Object.assign(element, { getAnimations: () => [{ playState: "running" }] });
    document.body.appendChild(element);
    animation("animationstart", element, "a");
    animation("animationstart", element, "b");
    animation("animationend", element, "a");
    for (let index = 0; index < 100; index += 1) frame();
    expect(passes).toHaveLength(100);
    stop();
  });

  it("notifies once fonts are ready", async () => {
    let ready: () => void = () => undefined;
    Object.defineProperty(document, "fonts", {
      value: { ready: new Promise<void>((resolve) => (ready = resolve)) },
      configurable: true,
    });
    const { stop, passes, frame } = setup();
    ready();
    await Promise.resolve();
    await Promise.resolve();
    frame();
    expect(passes).toEqual(["layout"]);
    stop();
    Reflect.deleteProperty(document, "fonts");
  });

  it("stops when the last listener leaves, mid-loop too, and starts again for a new one", () => {
    const { watcher, stop, passes, frame } = setup();
    const second: LayoutPass[] = [];
    const stopSecond = watcher.subscribe((pass) => second.push(pass));
    stop();
    document.dispatchEvent(new Event("scroll"));
    frame();
    expect(passes).toEqual([]);
    expect(second).toEqual(["layout"]);
    stopSecond();
    frame();
    expect(second).toEqual(["layout"]);
    const third: LayoutPass[] = [];
    const stopThird = watcher.subscribe((pass) => third.push(pass));
    document.dispatchEvent(new Event("scroll"));
    frame();
    expect(third).toEqual(["layout"]);
    stopThird();
  });

  it("schedules by timer without animation frames, MutationObserver or performance", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("MutationObserver", undefined);
    vi.stubGlobal("performance", undefined);
    const watcher = createLayoutWatcher(document);
    const listener = vi.fn();
    const stop = watcher.subscribe(listener);
    document.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(16);
    expect(listener).toHaveBeenCalledWith("layout");
    stop();
  });

  it("works on a document without a window", () => {
    const detached = document.implementation.createHTMLDocument();
    const stop = createLayoutWatcher(detached).subscribe(() => undefined);
    stop();
  });
});

describe("layoutWatcherFor", () => {
  it("shares one watcher per document", () => {
    expect(layoutWatcherFor(document)).toBe(layoutWatcherFor(document));
    expect(layoutWatcherFor(document.implementation.createHTMLDocument())).not.toBe(
      layoutWatcherFor(document),
    );
  });
});
