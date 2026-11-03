import { afterEach, describe, expect, it, vi } from "vitest";
import { handoffOf, type HandoffOptions } from "../../src/layout/handoff";
import { placementOf, type NativePlacement } from "../../src/layout/measure";
import { coversOf, easingOf, inStep, slideOf, translationOf } from "../../src/layout/motion";
import type { TNativeMotion } from "../../src/protocol/schemas";
import {
  mockLayout,
  overrideStyle,
  rectAttribute,
  resetStyleOverrides,
  setScrollGeometry,
} from "../support/dom";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  resetStyleOverrides();
});

const PUSH = "cubic-bezier(0.32, 0.72, 0, 1)";

type FakeAnimation = {
  playState: string;
  playbackRate: number;
  currentTime: number | null;
  effect: {
    target: Element;
    pseudoElement: string | null;
    getKeyframes: () => ComputedKeyframe[];
    getComputedTiming: () => ComputedEffectTiming;
  };
};

const animate = (
  element: HTMLElement,
  keyframes: Partial<ComputedKeyframe>[],
  timing: Partial<ComputedEffectTiming> = {},
  extra: Partial<Omit<FakeAnimation, "effect">> = {},
): FakeAnimation => {
  const animation: FakeAnimation = {
    playState: "running",
    playbackRate: 1,
    currentTime: 100,
    ...extra,
    effect: {
      target: element,
      pseudoElement: null,
      getKeyframes: () =>
        keyframes.map((frame) => ({
          composite: "auto",
          computedOffset: frame.offset ?? 0,
          easing: "linear",
          offset: frame.offset ?? null,
          ...frame,
        })) as ComputedKeyframe[],
      getComputedTiming: () =>
        ({
          duration: 500,
          delay: 0,
          iterations: 1,
          direction: "normal",
          easing: "linear",
          fill: "both",
          ...timing,
        }) as ComputedEffectTiming,
    },
  };
  const existing = element.getAnimations?.() ?? [];
  Object.defineProperty(element, "getAnimations", {
    configurable: true,
    value: () => [...existing, animation],
  });
  return animation;
};

const sized = (element: HTMLElement, width: number, height: number) => {
  Object.defineProperty(element, "offsetWidth", { configurable: true, value: width });
  Object.defineProperty(element, "offsetHeight", { configurable: true, value: height });
};

describe("easingOf", () => {
  it("reads keywords and cubic Béziers", () => {
    expect(easingOf("linear")).toEqual([0, 0, 1, 1]);
    expect(easingOf(undefined)).toEqual([0, 0, 1, 1]);
    expect(easingOf("ease-in-out")).toEqual([0.42, 0, 0.58, 1]);
    expect(easingOf(PUSH)).toEqual([0.32, 0.72, 0, 1]);
  });

  it("refuses steps and Béziers with time out of range", () => {
    expect(easingOf("steps(4, end)")).toBeUndefined();
    expect(easingOf("cubic-bezier(1.2, 0, 0, 1)")).toBeUndefined();
    expect(easingOf("cubic-bezier(0, 0, 1)")).toBeUndefined();
  });
});

describe("translationOf", () => {
  const box = { width: 400, height: 800 };

  it("adds up translations in px and percentages of the box", () => {
    expect(translationOf("none", box)).toEqual({ x: 0, y: 0 });
    expect(translationOf("translateX(100%)", box)).toEqual({ x: 400, y: 0 });
    expect(translationOf("translateX(-30%)", box)).toEqual({ x: -120, y: 0 });
    expect(translationOf("translate(10px, 50%)", box)).toEqual({ x: 10, y: 400 });
    expect(translationOf("translate3d(5px, 6px, 0px) translateY(4px)", box)).toEqual({
      x: 5,
      y: 10,
    });
    expect(translationOf("matrix(1, 0, 0, 1, 20, -4)", box)).toEqual({ x: 20, y: -4 });
    expect(translationOf("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 8, 0, 1)", box)).toEqual({
      x: 7,
      y: 8,
    });
  });

  it("refuses anything that does more than translate", () => {
    expect(translationOf("scale(2)", box)).toBeUndefined();
    expect(translationOf("matrix(2, 0, 0, 2, 0, 0)", box)).toBeUndefined();
    expect(translationOf("translate3d(0, 0, 10px)", box)).toBeUndefined();
    expect(translationOf("translateX(1em)", box)).toBeUndefined();
    expect(translationOf("translateX(12)", box)).toBeUndefined();
  });
});

describe("slideOf", () => {
  const screen = (transform = "matrix(1, 0, 0, 1, 400, 0)") => {
    const element = document.createElement("section");
    document.body.appendChild(element);
    sized(element, 400, 800);
    overrideStyle(element, { transform });
    return element;
  };

  it("reads a push from its keyframes, filling in the one CSS leaves out", () => {
    const element = screen();
    animate(element, [{ offset: 0, transform: "translateX(100%)", easing: PUSH }]);
    expect(slideOf(element)).toEqual({
      current: { x: 400, y: 0 },
      motion: {
        keyframes: [
          { offset: 0, x: 400, y: 0 },
          { offset: 1, x: 0, y: 0 },
        ],
        easings: [[0.32, 0.72, 0, 1]],
        duration: 500,
        elapsed: 100,
        fill: "both",
      },
    });
  });

  it("fills in a missing from keyframe and takes the delay out of the elapsed time", () => {
    const element = screen("none");
    animate(element, [{ offset: 1, transform: "translateX(-30%)" }], { delay: 40, fill: "auto" });
    expect(slideOf(element)?.motion).toEqual({
      keyframes: [
        { offset: 0, x: 0, y: 0 },
        { offset: 1, x: -120, y: 0 },
      ],
      duration: 500,
      elapsed: 60,
    });
  });

  it("takes the effect's own easing on a two-keyframe slide", () => {
    const element = screen();
    animate(
      element,
      [
        { offset: 0, transform: "translateX(100%)" },
        { offset: 1, transform: "none" },
      ],
      { easing: "ease-out" },
    );
    expect(slideOf(element)?.motion.easings).toEqual([[0, 0, 0.58, 1]]);
  });

  it("reads the motion once per animation, so measuring again sends the same one", () => {
    const element = screen();
    const animation = animate(element, [{ offset: 0, transform: "translateX(100%)" }]);
    const first = slideOf(element)?.motion;
    animation.currentTime = 300;
    expect(slideOf(element)?.motion).toBe(first);
  });

  it("refuses what Core Animation can't run in step", () => {
    const cases: [Partial<ComputedKeyframe>[], Partial<ComputedEffectTiming>, object?][] = [
      [[{ offset: 0, transform: "rotate(10deg)" }], {}],
      [[{ offset: 0, transform: "translateX(100%)", easing: "steps(2)" }], {}],
      [[{ offset: 0, transform: "translateX(100%)", opacity: "0" }], {}],
      [[{ offset: 0, transform: "translateX(100%)" }], { iterations: 2 }],
      [[{ offset: 0, transform: "translateX(100%)" }], { direction: "reverse" }],
      [[{ offset: 0, transform: "translateX(100%)" }], {}, { playbackRate: 2 }],
      [
        [
          { offset: 0, transform: "translateX(100%)" },
          { offset: 0.5, transform: "translateX(50%)" },
          { offset: 1, transform: "none" },
        ],
        { easing: "ease" },
      ],
    ];
    for (const [keyframes, timing, extra] of cases) {
      const element = screen();
      animate(element, keyframes, timing, extra);
      expect(slideOf(element)).toBeUndefined();
    }
  });

  it("refuses a second animation that moves the element's box", () => {
    const element = screen();
    animate(element, [{ offset: 0, transform: "translateX(100%)" }]);
    animate(element, [{ offset: 0, width: "10px" } as Partial<ComputedKeyframe>]);
    expect(slideOf(element)).toBeUndefined();
  });

  it("ignores a paused animation and an element that runs none", () => {
    const element = screen();
    expect(slideOf(element)).toBeUndefined();
    animate(element, [{ offset: 0, transform: "translateX(100%)" }], {}, { playState: "paused" });
    expect(slideOf(element)).toBeUndefined();
  });
});

const motion = (overrides: Partial<TNativeMotion> = {}): TNativeMotion => ({
  keyframes: [
    { offset: 0, x: 0, y: 0 },
    { offset: 1, x: -120, y: 0 },
  ],
  duration: 500,
  elapsed: 0,
  ...overrides,
});

describe("inStep", () => {
  it("matches slides on one timeline and refuses ones out of step", () => {
    expect(inStep(motion(), motion({ elapsed: 20 }))).toBe(true);
    expect(inStep(motion(), motion({ elapsed: 80 }))).toBe(false);
    expect(inStep(motion(), motion({ duration: 300 }))).toBe(false);
    expect(inStep(motion(), motion({ easings: [[0, 0, 0.58, 1]] }))).toBe(false);
    expect(
      inStep(
        motion(),
        motion({
          keyframes: [
            { offset: 0, x: 0, y: 0 },
            { offset: 0.5, x: 0, y: 0 },
            { offset: 1, x: 0, y: 0 },
          ],
        }),
      ),
    ).toBe(false);
  });
});

/**
 * Two screens as the showcase pushes them: the one going under (z-index 1)
 * and the one coming in over it (z-index 2), each with a back button in a
 * nav bar outside any scrolling area.
 */
const pushedScreens = () => {
  mockLayout();
  document.body.innerHTML = `
    <div id="screens">
      <section id="under" data-island-phase="push-under" data-rect="${rectAttribute(0, 0, 400, 800)}">
        <div data-island id="under-island" style="display: contents"><button data-rect="${rectAttribute(16, 62, 44, 44)}">Back</button></div>
      </section>
      <section id="over" data-island-phase="push-in" data-rect="${rectAttribute(400, 0, 400, 800)}">
        <div data-island id="over-island" style="display: contents"><button data-rect="${rectAttribute(416, 62, 44, 44)}">Back</button></div>
      </section>
    </div>`;
  const under = document.getElementById("under") as HTMLElement;
  const over = document.getElementById("over") as HTMLElement;
  for (const element of [under, over]) sized(element, 400, 800);
  overrideStyle(under, { zIndex: "1", transform: "none" });
  overrideStyle(over, { zIndex: "2", transform: "matrix(1, 0, 0, 1, 400, 0)" });
  animate(
    under,
    [{ offset: 1, transform: "translateX(-30%)", easing: PUSH }],
    {},
    { currentTime: 0 },
  );
  animate(
    over,
    [{ offset: 0, transform: "translateX(100%)", easing: PUSH }],
    {},
    { currentTime: 0 },
  );
  const island = (id: string) => document.getElementById(id) as HTMLElement;
  return { under, over, island };
};

const handoffWith = (wrapper: HTMLElement, options: HandoffOptions = {}) =>
  handoffOf(wrapper, placementOf(wrapper) as NativePlacement, () => false, false, options);

describe("islands on a sliding page outside its scrolling areas", () => {
  it("stay native and carry the slide, measured where they rest", () => {
    const { island } = pushedScreens();
    const out: NonNullable<HandoffOptions["out"]> = {};
    expect(handoffWith(island("over-island"), { motion: true, out })).toBeUndefined();
    expect(out.slid).toEqual({ x: 400, y: 0 });
    expect(out.motion).toEqual({
      keyframes: [
        { offset: 0, x: 400, y: 0 },
        { offset: 1, x: 0, y: 0 },
      ],
      easings: [[0.32, 0.72, 0, 1]],
      duration: 500,
      elapsed: 0,
      fill: "both",
    });
  });

  it("are checked against what clips the sliding page where they come to rest", () => {
    const { island } = pushedScreens();
    const screens = document.getElementById("screens") as HTMLElement;
    screens.dataset.rect = rectAttribute(0, 0, 400, 800);
    setScrollGeometry(screens, { clientWidth: 400, clientHeight: 800 });
    overrideStyle(screens, { overflowX: "hidden", overflowY: "hidden" });
    expect(handoffWith(island("over-island"), { motion: true, out: {} })).toBeUndefined();
    screens.dataset.rect = rectAttribute(100, 0, 300, 800);
    setScrollGeometry(screens, { clientWidth: 300 });
    expect(handoffWith(island("over-island"), { motion: true, out: {} })).toBe("clipped");
  });

  it("are cut where the page coming in over them covers them as it slides", () => {
    const { island } = pushedScreens();
    const out: NonNullable<HandoffOptions["out"]> = {};
    expect(handoffWith(island("under-island"), { motion: true, out })).toBeUndefined();
    expect(out.motion?.keyframes).toEqual([
      { offset: 0, x: 0, y: 0 },
      { offset: 1, x: -120, y: 0 },
    ]);
    expect(out.motion?.cover).toEqual({
      frame: { x: -16, y: -62, width: 400, height: 800 },
      keyframes: [
        { offset: 0, x: 400, y: 0 },
        { offset: 1, x: 120, y: 0 },
      ],
    });
  });

  it("hand off to web when the host can't run slides, or the cover slides out of step", () => {
    const { island, over } = pushedScreens();
    expect(handoffWith(island("over-island"))).toBe("inactive");
    animate(over, [{ offset: 0, transform: "translateX(100%)" }], { duration: 300 });
    expect(handoffWith(island("under-island"), { motion: true, out: {} })).toBe("inactive");
  });

  it("stay native on a page that is inert as it leaves, as long as it slides", () => {
    const { island, over } = pushedScreens();
    over.setAttribute("inert", "");
    expect(handoffWith(island("over-island"), { motion: true, out: {} })).toBeUndefined();
    Object.defineProperty(over, "getAnimations", { configurable: true, value: () => [] });
    expect(handoffWith(island("over-island"), { motion: true, out: {} })).toBe("inactive");
  });

  it("hand off to web when something still sits over an inert page, which can't be hit-tested", () => {
    const { island, under } = pushedScreens();
    under.setAttribute("inert", "");
    const sheet = document.createElement("div");
    sheet.dataset.rect = rectAttribute(0, 400, 400, 400);
    under.parentElement?.appendChild(sheet);
    overrideStyle(sheet, { zIndex: "5" });
    expect(handoffWith(island("under-island"), { motion: true, out: {} })).toBe("inactive");
    sheet.dataset.rect = rectAttribute(0, 900, 400, 100);
    expect(handoffWith(island("under-island"), { motion: true, out: {} })).toBeUndefined();
  });

  it("hand off to web on an inert page that isn't sliding", () => {
    const { island, under } = pushedScreens();
    under.removeAttribute("data-island-phase");
    under.setAttribute("inert", "");
    expect(handoffWith(island("under-island"), { motion: true, out: {} })).toBe("inactive");
  });
});

describe("coversOf", () => {
  it("ignores siblings below the sliding page and ones standing still", () => {
    const { under, over } = pushedScreens();
    const slide = slideOf(over);
    if (!slide) throw new Error("expected a slide");
    expect(coversOf(over, slide)).toEqual([]);
    const still = document.createElement("div");
    over.parentElement?.appendChild(still);
    expect(coversOf(under, slideOf(under) ?? slide)).toHaveLength(1);
  });
});
