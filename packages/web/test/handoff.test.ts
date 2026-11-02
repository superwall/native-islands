import { afterEach, describe, expect, it, vi } from "vitest";
import {
  contains,
  coveredAt,
  handoffOf,
  type HandoffOptions,
  inTransition,
  intersect,
  shadeOf,
  isCovered,
  isEvenScale,
  isTranslation,
  linearOf,
  MAX_HOLES,
  multiply,
  type NativeShade,
  samplePoints,
} from "../src/handoff";
import { placementOf, type NativePlacement } from "../src/measure";
import type { TNativeFrame } from "../src/schemas";
import {
  mockLayout,
  overrideStyle,
  rectAttribute,
  resetStyleOverrides,
  setScrollGeometry,
} from "./dom";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  resetStyleOverrides();
  Reflect.deleteProperty(document, "elementsFromPoint");
});

const still = () => false;

const setup = (
  markup = `<div id="card"><div data-island style="display: contents"><button data-rect="${rectAttribute(10, 10, 100, 40)}">Go</button></div></div>`,
) => {
  mockLayout();
  const host = document.createElement("div");
  host.innerHTML = markup;
  document.body.appendChild(host);
  const wrapper = host.querySelector("[data-island]") as HTMLElement;
  const card = host.querySelector("#card") as HTMLElement;
  const placement = () => placementOf(wrapper) as NativePlacement;
  return { host, wrapper, card, placement };
};

describe("isTranslation", () => {
  it("accepts no transform and pure translations", () => {
    expect(isTranslation("none")).toBe(true);
    expect(isTranslation("")).toBe(true);
    expect(isTranslation("matrix(1, 0, 0, 1, 20, -4)")).toBe(true);
    expect(isTranslation("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 6, 7, 1)")).toBe(true);
  });

  it("refuses scale, rotation, skew and perspective", () => {
    expect(isTranslation("matrix(2, 0, 0, 2, 0, 0)")).toBe(false);
    expect(isTranslation("matrix(0.7, 0.7, -0.7, 0.7, 0, 0)")).toBe(false);
    expect(isTranslation("matrix(1, 0, 0.5, 1, 0, 0)")).toBe(false);
    expect(isTranslation("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -0.002, 0, 0, 0, 1)")).toBe(
      false,
    );
    expect(isTranslation("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2)")).toBe(false);
    expect(isTranslation("matrix(1, 0)")).toBe(false);
    expect(isTranslation("matrix3d(1, 0)")).toBe(false);
    expect(isTranslation("rotate(4deg)")).toBe(false);
  });
});

describe("geometry helpers", () => {
  it("intersects frames", () => {
    expect(
      intersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }),
    ).toEqual({ x: 5, y: 5, width: 5, height: 5 });
    expect(
      intersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 0, width: 5, height: 5 }),
    ).toBeUndefined();
  });

  it("checks containment with half a point of slack", () => {
    const outer = { x: 0, y: 0, width: 100, height: 100 };
    expect(contains(outer, { x: -0.4, y: 0, width: 100.8, height: 100.4 })).toBe(true);
    expect(contains(outer, { x: -1, y: 0, width: 10, height: 10 })).toBe(false);
    expect(contains(outer, { x: 0, y: 95, width: 10, height: 10 })).toBe(false);
  });
});

describe("handoffOf", () => {
  it("keeps native when nothing interferes", () => {
    const { wrapper, placement } = setup();
    expect(handoffOf(wrapper, placement(), still)).toBeUndefined();
  });

  it("hands off a wrapper with no boxes left in it", () => {
    const { wrapper, placement } = setup(
      `<div data-island style="display: contents"><button data-rect="${rectAttribute(0, 0, 100, 10)}">x</button></div>`,
    );
    const measured = placement();
    wrapper.replaceChildren();
    expect(handoffOf(wrapper, measured, still)).toBe("hidden");
  });

  it("hands off an element with no size", () => {
    const { wrapper, placement } = setup(
      `<div data-island style="display: contents"><button data-rect="${rectAttribute(0, 0, 0, 10)}">x</button></div>`,
    );
    expect(handoffOf(wrapper, placement(), still)).toBe("hidden");
  });

  it("hands off inside an inert or transitioning route", () => {
    const { wrapper, card, placement } = setup();
    card.setAttribute("inert", "");
    expect(handoffOf(wrapper, placement(), still)).toBe("inactive");
    card.removeAttribute("inert");
    card.setAttribute("data-island-phase", "enter");
    expect(handoffOf(wrapper, placement(), still)).toBe("inactive");
  });

  it("keeps an island native while an ancestor moves, so it follows frame by frame", () => {
    const { wrapper, card, placement } = setup();
    expect(handoffOf(wrapper, placement(), (element) => element === card)).toBeUndefined();
  });

  it("hands off under hidden, faded, transformed, filtered or clip-pathed ancestors", () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{ visibility: "hidden" }, "hidden"],
      [{ display: "none" }, "hidden"],
      [{ opacity: "0.5" }, "faded"],
      [{ transform: "matrix(0.9, 0, 0, 0.9, 0, 0)" }, "transformed"],
      [{ scale: "1.1" }, "transformed"],
      [{ rotate: "3deg" }, "transformed"],
      [{ filter: "blur(2px)" }, "transformed"],
      [{ clipPath: "circle(40%)" }, "transformed"],
    ];
    for (const [style, reason] of cases) {
      const { wrapper, card, placement } = setup();
      overrideStyle(card, style);
      expect(handoffOf(wrapper, placement(), still)).toBe(reason);
      resetStyleOverrides();
      vi.restoreAllMocks();
      document.body.replaceChildren();
    }
  });

  it("keeps native under faded, rotated and scaled ancestors when the host turns islands", () => {
    const cases: Array<[Record<string, string>, { opacity?: number; rotated?: boolean }]> = [
      [{ opacity: "0.5" }, { opacity: 0.5 }],
      [{ rotate: "-4deg" }, { rotated: true }],
      [
        { transform: "matrix(0.996, -0.07, 0.07, 0.996, 0, 0)", opacity: "0.25" },
        { opacity: 0.25, rotated: true },
      ],
      [{ scale: "1.1" }, { rotated: true }],
    ];
    for (const [style, expected] of cases) {
      const { wrapper, card, placement } = setup();
      overrideStyle(card, style);
      const out: NonNullable<HandoffOptions["out"]> = {};
      expect(
        handoffOf(wrapper, placement(), still, false, { transform: true, out }),
      ).toBeUndefined();
      expect(out.opacity).toBe(expected.opacity);
      expect(out.transform !== undefined).toBe(expected.rotated === true);
      resetStyleOverrides();
      vi.restoreAllMocks();
      document.body.replaceChildren();
    }
  });

  it("turns the native view with a single box that turns itself", () => {
    const { wrapper, placement } = setup();
    const button = wrapper.querySelector("button") as HTMLElement;
    overrideStyle(button, { rotate: "5deg" });
    const out: NonNullable<HandoffOptions["out"]> = {};
    expect(handoffOf(wrapper, placement(), still, false, { transform: true, out })).toBeUndefined();
    expect(out.transform).toBeDefined();
  });

  it("still hands off 3D transforms, filters and turned islands a box cuts", () => {
    const cases: Array<[Record<string, string>, string]> = [
      [
        { transform: "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -0.002, 0, 0, 0, 1)" },
        "transformed",
      ],
      [{ rotate: "x 30deg" }, "transformed"],
      [{ filter: "blur(2px)" }, "transformed"],
    ];
    for (const [style, reason] of cases) {
      const { wrapper, card, placement } = setup();
      overrideStyle(card, style);
      expect(handoffOf(wrapper, placement(), still, false, { transform: true, out: {} })).toBe(
        reason,
      );
      resetStyleOverrides();
      vi.restoreAllMocks();
      document.body.replaceChildren();
    }
  });

  it("reads the linear part of rotate, scale and transform in CSS order", () => {
    const style = (values: Record<string, string>) =>
      ({ rotate: "none", scale: "none", transform: "none", ...values }) as CSSStyleDeclaration;
    expect(linearOf(style({}))).toEqual([1, 0, 0, 1]);
    const turned = linearOf(style({ rotate: "90deg" })) as readonly number[];
    expect(turned.map((value) => Math.round(value))).toEqual([0, 1, -1, 0]);
    expect(linearOf(style({ rotate: "0.25turn" }))?.map((value) => Math.round(value))).toEqual([
      0, 1, -1, 0,
    ]);
    expect(linearOf(style({ scale: "2 3" }))).toEqual([2, 0, 0, 3]);
    expect(linearOf(style({ scale: "2 2 2" }))).toBeUndefined();
    expect(linearOf(style({ rotate: "z 90deg" }))?.map((value) => Math.round(value))).toEqual([
      0, 1, -1, 0,
    ]);
    expect(linearOf(style({ rotate: "0 0 1 90deg" }))?.map((value) => Math.round(value))).toEqual([
      0, 1, -1, 0,
    ]);
    expect(linearOf(style({ rotate: "1 0 0 90deg" }))).toBeUndefined();
    expect(linearOf(style({ rotate: "nonsense" }))).toBeUndefined();
    expect(linearOf(style({ transform: "matrix(2, 0, 0, 2, 9, 9)" }))).toEqual([2, 0, 0, 2]);
    expect(
      linearOf(style({ transform: "matrix3d(2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 4, 5, 0, 1)" })),
    ).toEqual([2, 0, 0, 2]);
    expect(linearOf(style({ transform: "matrix(1, nope, 0, 1, 0, 0)" }))).toBeUndefined();
    expect(linearOf(style({ transform: "matrix(1, 0, 0)" }))).toBeUndefined();
    expect(linearOf(style({ transform: "matrix3d(1, 0, 0)" }))).toBeUndefined();
    expect(linearOf(style({ transform: "rotate(3deg)" }))).toBeUndefined();
    expect(multiply([2, 0, 0, 2], [0, 1, -1, 0])).toEqual([0, 2, -2, 0]);
  });

  it("hands off a turned island a box cuts, and one made of several boxes", () => {
    const { wrapper, card, placement } = setup(
      `<div id="card"><div id="clip" style="overflow-x: hidden; overflow-y: hidden"><div data-island style="display: contents"><button data-rect="${rectAttribute(10, 10, 100, 40)}">Go</button></div></div></div>`,
    );
    const clip = card.querySelector("#clip") as HTMLElement;
    clip.dataset.rect = rectAttribute(10, 10, 50, 40);
    setScrollGeometry(clip, { clientWidth: 50, clientHeight: 40 });
    overrideStyle(card, { rotate: "5deg" });
    expect(handoffOf(wrapper, placement(), still, false, { transform: true, out: {} })).toBe(
      "clipped",
    );
    resetStyleOverrides();
    vi.restoreAllMocks();
    document.body.replaceChildren();
    const two = setup(
      `<div id="card"><div data-island style="display: contents"><button data-rect="${rectAttribute(10, 10, 40, 40)}">A</button><button id="b" data-rect="${rectAttribute(60, 10, 40, 40)}">B</button></div></div>`,
    );
    overrideStyle(two.card.querySelector("#b") as Element, { rotate: "5deg" });
    expect(
      handoffOf(two.wrapper, two.placement(), still, false, { transform: true, out: {} }),
    ).toBe("transformed");
  });

  it("keeps native under a translated ancestor", () => {
    const { wrapper, card, placement } = setup();
    overrideStyle(card, { transform: "matrix(1, 0, 0, 1, 0, 20)", opacity: "1" });
    expect(handoffOf(wrapper, placement(), still)).toBeUndefined();
  });

  it("hands off when an overflow ancestor clips part of the element", () => {
    const { wrapper, card, placement } = setup(
      `<div id="card" data-rect="${rectAttribute(0, 0, 60, 100)}"><div data-island style="display: contents"><button data-rect="${rectAttribute(10, 10, 100, 40)}">Go</button></div></div>`,
    );
    overrideStyle(card, { overflowX: "hidden", overflowY: "visible" });
    setScrollGeometry(card, { clientWidth: 60, clientHeight: 100 });
    expect(handoffOf(wrapper, placement(), still)).toBe("clipped");
    setScrollGeometry(card, { clientWidth: 200 });
    expect(handoffOf(wrapper, placement(), still)).toBeUndefined();
  });

  it("leaves clipping by the anchor scroller and above it to native", () => {
    const { host, wrapper, placement } = setup(
      `<div id="frame" data-rect="${rectAttribute(0, 0, 50, 50)}"><div id="list" data-rect="${rectAttribute(0, 0, 400, 200)}"><div data-island style="display: contents"><button data-rect="${rectAttribute(10, 180, 100, 40)}">Go</button></div></div></div>`,
    );
    const list = host.querySelector("#list") as HTMLElement;
    const frame = host.querySelector("#frame") as HTMLElement;
    overrideStyle(list, { overflowY: "auto" });
    overrideStyle(frame, { overflowY: "hidden" });
    setScrollGeometry(list, { scrollHeight: 600, clientHeight: 200, clientWidth: 400 });
    setScrollGeometry(frame, { clientHeight: 50, clientWidth: 50 });
    expect(placement().kind).toBe("scroller");
    expect(handoffOf(wrapper, placement(), still)).toBeUndefined();
  });

  it("does not treat a fixed element as clipped by its ancestors", () => {
    const { wrapper, card, placement } = setup(
      `<div id="card" data-rect="${rectAttribute(0, 0, 10, 10)}"><div data-island style="display: contents"><button data-rect="${rectAttribute(300, 40, 44, 44)}">x</button></div></div>`,
    );
    overrideStyle(card, { overflowY: "hidden" });
    setScrollGeometry(card, { clientHeight: 10, clientWidth: 10 });
    overrideStyle(wrapper.querySelector("button") as Element, { position: "fixed" });
    expect(handoffOf(wrapper, placement(), still)).toBeUndefined();
  });

  it("hands off when something else is on top", () => {
    const { wrapper, placement } = setup();
    const modal = document.createElement("div");
    document.body.appendChild(modal);
    Object.assign(document, {
      elementsFromPoint: () => [modal, document.querySelector("[data-island] > *")],
    });
    expect(handoffOf(wrapper, placement(), still)).toBe("covered");
  });
});

describe("coveredAt", () => {
  it("counts only what is stacked above the element's own content", () => {
    const { host, wrapper, card } = setup();
    const button = wrapper.querySelector("button") as HTMLElement;
    const sibling = document.createElement("div");
    host.appendChild(sibling);
    expect(coveredAt(wrapper, [sibling, button, card])).toBe("covered");
    expect(coveredAt(wrapper, [button, sibling, card])).toBe("own");
    expect(coveredAt(wrapper, [card, button])).toBe("own");
  });

  it("ignores a point outside the element's shape, such as a rounded corner", () => {
    const { host, wrapper, card } = setup();
    const sibling = document.createElement("div");
    host.appendChild(sibling);
    expect(coveredAt(wrapper, [sibling, card, document.body])).toBe("outside");
  });
});

describe("isCovered", () => {
  it("is not covered when the element itself is hit", () => {
    const { wrapper, placement } = setup();
    const button = wrapper.querySelector("button");
    Object.assign(document, { elementsFromPoint: () => [button] });
    expect(isCovered(wrapper, placement())).toBe(false);
  });

  it("counts as covered when no sample reaches the element, rather than assuming it is clear", () => {
    const { host, wrapper, placement } = setup();
    const sheet = document.createElement("div");
    host.appendChild(sheet);
    Object.assign(document, { elementsFromPoint: () => [sheet, host, document.body] });
    expect(isCovered(wrapper, placement())).toBe(true);
    Object.assign(document, { elementsFromPoint: () => [] });
    expect(isCovered(wrapper, placement())).toBe(true);
  });

  it("is not covered when only some samples miss the element's shape", () => {
    const { host, wrapper, placement } = setup();
    const button = wrapper.querySelector("button") as HTMLElement;
    let call = 0;
    Object.assign(document, {
      elementsFromPoint: () => (call++ === 0 ? [host, document.body] : [button, host]),
    });
    expect(isCovered(wrapper, placement())).toBe(false);
  });

  it("samples only the part of the element on screen and inside its scroller", () => {
    const { host, wrapper, placement } = setup(
      `<div id="list" data-rect="${rectAttribute(0, 0, 400, 100)}"><div data-island style="display: contents"><button data-rect="${rectAttribute(10, 80, 100, 40)}">Go</button></div></div>`,
    );
    const list = host.querySelector("#list") as HTMLElement;
    overrideStyle(list, { overflowY: "auto" });
    setScrollGeometry(list, { scrollHeight: 600, clientHeight: 100, clientWidth: 400 });
    const points: Array<[number, number]> = [];
    Object.assign(document, {
      elementsFromPoint: (x: number, y: number) => {
        points.push([x, y]);
        return [];
      },
    });
    isCovered(wrapper, placement());
    expect(points.every(([, y]) => y >= 80 && y <= 100)).toBe(true);
    expect(points.length).toBeGreaterThan(9);
  });

  it("does not sample an element entirely off screen or scrolled out", () => {
    const { wrapper, placement } = setup(
      `<div data-island style="display: contents"><button data-rect="${rectAttribute(10, 5000, 100, 40)}">Go</button></div>`,
    );
    const hit = vi.fn(() => []);
    Object.assign(document, { elementsFromPoint: hit });
    expect(isCovered(wrapper, placement())).toBe(false);
    expect(hit).not.toHaveBeenCalled();

    const scrolled = setup(
      `<div id="list" data-rect="${rectAttribute(0, 0, 400, 100)}"><div data-island style="display: contents"><button data-rect="${rectAttribute(10, 300, 100, 40)}">Go</button></div></div>`,
    );
    const list = scrolled.host.querySelector("#list") as HTMLElement;
    overrideStyle(list, { overflowY: "auto" });
    setScrollGeometry(list, { scrollHeight: 600, clientHeight: 100, clientWidth: 400 });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 1000,
      configurable: true,
    });
    expect(isCovered(scrolled.wrapper, scrolled.placement())).toBe(false);
    expect(hit).not.toHaveBeenCalled();
    Reflect.deleteProperty(document.documentElement, "clientHeight");
  });

  it("has no viewport to sample in a document without a window", () => {
    mockLayout();
    const detached = document.implementation.createHTMLDocument();
    const wrapper = detached.createElement("div");
    wrapper.style.display = "inline-block";
    wrapper.dataset.rect = rectAttribute(0, 0, 10, 10);
    detached.body.appendChild(wrapper);
    const hit = vi.fn(() => []);
    Object.assign(detached, { elementsFromPoint: hit });
    expect(isCovered(wrapper, placementOf(wrapper) as NativePlacement)).toBe(false);
    expect(hit).not.toHaveBeenCalled();
  });

  it("is never covered where hit testing does not exist", () => {
    const { wrapper, placement } = setup();
    expect(isCovered(wrapper, placement())).toBe(false);
  });
});

describe("handoffOf, beyond ancestors", () => {
  it("hands off when the element itself is scaled or rotated, but not translated", () => {
    const { wrapper, placement } = setup();
    const button = wrapper.querySelector("button") as Element;
    overrideStyle(button, { transform: "matrix(1, 0, 0, 1, 4, 0)" });
    expect(handoffOf(wrapper, placement(), still)).toBeUndefined();
    overrideStyle(button, { transform: "matrix(1.2, 0, 0, 1.2, 0, 0)" });
    expect(handoffOf(wrapper, placement(), still)).toBe("transformed");
    overrideStyle(button, { transform: "none", rotate: "4deg" });
    expect(handoffOf(wrapper, placement(), still)).toBe("transformed");
    overrideStyle(button, { rotate: "none", scale: "1.1" });
    expect(handoffOf(wrapper, placement(), still)).toBe("transformed");
  });

  it("does not check the wrapper's own box as a child", () => {
    const { wrapper, placement } = setup(
      `<div data-island style="display: inline-block" data-rect="${rectAttribute(0, 0, 40, 40)}"><span>x</span></div>`,
    );
    expect(handoffOf(wrapper, placement(), still)).toBeUndefined();
  });

  it("skips overflow ancestors an absolute element escapes, until its containing block", () => {
    const { host, wrapper, placement } = setup(
      `<div id="clip" data-rect="${rectAttribute(0, 0, 50, 50)}"><div id="holder" data-rect="${rectAttribute(0, 0, 400, 400)}"><div data-island style="display: contents"><button data-rect="${rectAttribute(100, 100, 40, 40)}">x</button></div></div></div>`,
    );
    const clip = host.querySelector("#clip") as HTMLElement;
    overrideStyle(clip, { overflowY: "hidden" });
    setScrollGeometry(clip, { clientWidth: 50, clientHeight: 50 });
    expect(handoffOf(wrapper, placement(), still)).toBe("clipped");
    overrideStyle(wrapper.querySelector("button") as Element, { position: "absolute" });
    expect(handoffOf(wrapper, placement(), still)).toBeUndefined();
    overrideStyle(clip, { position: "relative" });
    expect(handoffOf(wrapper, placement(), still)).toBe("clipped");
  });

  it("follows a fixed element's containing block and the absolute one above it", () => {
    const { host, wrapper, placement } = setup(
      `<div id="clip" data-rect="${rectAttribute(0, 0, 50, 50)}"><div id="frame"><div data-island style="display: contents"><button data-rect="${rectAttribute(100, 100, 40, 40)}">x</button></div></div></div>`,
    );
    const clip = host.querySelector("#clip") as HTMLElement;
    const frame = host.querySelector("#frame") as HTMLElement;
    overrideStyle(clip, { overflowY: "hidden" });
    setScrollGeometry(clip, { clientWidth: 50, clientHeight: 50 });
    overrideStyle(wrapper.querySelector("button") as Element, { position: "fixed" });
    overrideStyle(frame, { willChange: "transform", position: "absolute" });
    expect(handoffOf(wrapper, placement(), still)).toBeUndefined();
    overrideStyle(frame, { position: "fixed", willChange: "auto" });
    expect(handoffOf(wrapper, placement(), still)).toBeUndefined();
  });

  it("lets a fixed ancestor escape the overflow ancestors above it", () => {
    const { host, wrapper, card, placement } = setup(
      `<div id="clip" data-rect="${rectAttribute(0, 0, 50, 50)}"><div id="card"><div data-island style="display: contents"><button data-rect="${rectAttribute(100, 100, 40, 40)}">x</button></div></div></div>`,
    );
    const clip = host.querySelector("#clip") as HTMLElement;
    overrideStyle(clip, { overflowY: "hidden" });
    setScrollGeometry(clip, { clientWidth: 50, clientHeight: 50 });
    expect(handoffOf(wrapper, placement(), still)).toBe("clipped");
    overrideStyle(card, { position: "fixed" });
    expect(handoffOf(wrapper, placement(), still)).toBeUndefined();
  });

  it("never treats the document element or body as clipping", () => {
    const { wrapper, placement } = setup(
      `<div data-island style="display: contents"><button data-rect="${rectAttribute(10, 3000, 100, 40)}">Go</button></div>`,
    );
    overrideStyle(document.documentElement, { overflowX: "hidden" });
    overrideStyle(document.body, { overflowX: "hidden" });
    expect(handoffOf(wrapper, placement(), still)).toBeUndefined();
  });
});

describe("cover sampling", () => {
  it("samples at most every 16 px, up to twelve points per side, one point inside the edges", () => {
    const points = samplePoints({ x: 0, y: 0, width: 354, height: 52 });
    const xs = [...new Set(points.map(([x]) => x))];
    const ys = [...new Set(points.map(([, y]) => y))];
    expect(xs).toHaveLength(12);
    expect(ys).toHaveLength(5);
    expect(xs[0]).toBe(1);
    expect(xs.at(-1)).toBe(353);
    expect(samplePoints({ x: 0, y: 0, width: 2, height: 2 })).toHaveLength(9);
  });

  it("marks only the island while it samples, never the document", () => {
    const { wrapper, placement } = setup();
    const before = document.documentElement.getAttributeNames();
    const seen: string[][] = [];
    Object.assign(document, {
      elementsFromPoint: () => {
        seen.push(document.documentElement.getAttributeNames());
        return [];
      },
    });
    isCovered(wrapper, placement());
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((names) => names.join() === before.join())).toBe(true);
  });

  it("lets a concealed web version be hit while it samples, then restores it", () => {
    const { wrapper, placement } = setup();
    const seen: Array<string | null> = [];
    Object.assign(document, {
      elementsFromPoint: () => {
        seen.push(wrapper.getAttribute("data-island-probe"));
        return [];
      },
    });
    isCovered(wrapper, placement());
    expect(seen.every((value) => value === "")).toBe(true);
    expect(wrapper.hasAttribute("data-island-probe")).toBe(false);
  });
});

describe("layered hosts", () => {
  const routed = () => {
    const parts = setup(
      `<div id="stack"><div id="route" data-rect="${rectAttribute(0, 0, 400, 600)}"><div id="inner"><div data-island style="display: contents"><button data-rect="${rectAttribute(10, 500, 100, 40)}">Go</button></div></div></div><footer id="footer"></footer></div>`,
    );
    const route = parts.host.querySelector("#route") as HTMLElement;
    overrideStyle(route, { overflowY: "auto" });
    setScrollGeometry(route, { scrollHeight: 1200, clientHeight: 600, clientWidth: 400 });
    return {
      ...parts,
      route,
      stack: parts.host.querySelector("#stack") as HTMLElement,
      inner: parts.host.querySelector("#inner") as HTMLElement,
      footer: parts.host.querySelector("#footer") as HTMLElement,
    };
  };

  it("lets a scroller island ride page changes, fades and transforms of its scroller and above", () => {
    const { wrapper, route, stack, placement } = routed();
    expect(placement().kind).toBe("scroller");
    route.setAttribute("data-island-phase", "enter");
    route.setAttribute("inert", "");
    overrideStyle(route, { opacity: "0.5", transform: "matrix(0.9, 0, 0, 0.9, 0, 0)" });
    overrideStyle(stack, { filter: "blur(2px)" });
    expect(handoffOf(wrapper, placement(), (element) => element === stack, true)).toBeUndefined();
    expect(handoffOf(wrapper, placement(), still)).toBe("inactive");
  });

  it("still hands off for fades inside the scroller, and when the scroller is hidden", () => {
    const { wrapper, route, inner, placement } = routed();
    expect(handoffOf(wrapper, placement(), (element) => element === inner, true)).toBeUndefined();
    overrideStyle(inner, { opacity: "0.5" });
    expect(handoffOf(wrapper, placement(), still, true)).toBe("faded");
    overrideStyle(inner, { opacity: "1" });
    overrideStyle(route, { visibility: "hidden" });
    expect(handoffOf(wrapper, placement(), still, true)).toBe("hidden");
  });

  it("leaves covering by things outside the scroller to the host, but not covering inside it", () => {
    const { wrapper, inner, footer, placement } = routed();
    const button = wrapper.querySelector("button") as HTMLElement;
    Object.assign(document, { elementsFromPoint: () => [footer, button, inner] });
    expect(handoffOf(wrapper, placement(), still, true)).toBeUndefined();
    expect(handoffOf(wrapper, placement(), still)).toBe("covered");
    const badge = document.createElement("span");
    inner.appendChild(badge);
    Object.assign(document, { elementsFromPoint: () => [badge, button, inner] });
    expect(handoffOf(wrapper, placement(), still, true)).toBe("covered");
    Object.assign(document, { elementsFromPoint: () => [footer] });
    expect(handoffOf(wrapper, placement(), still, true)).toBeUndefined();
  });

  it("cuts what the page covers out of the island instead of handing off, when the host clips", () => {
    const { wrapper, inner, placement } = routed();
    const button = wrapper.querySelector("button") as HTMLElement;
    const toast = document.createElement("div");
    toast.dataset.rect = rectAttribute(0, 490, 60, 30);
    inner.appendChild(toast);
    Object.assign(document, {
      elementsFromPoint: (x: number, y: number) =>
        x < 60 && y < 520 ? [toast, button, inner] : [button, inner],
    });
    const out: { holes?: TNativeFrame[] } = {};
    expect(handoffOf(wrapper, placement(), still, true, { clip: true, out })).toBeUndefined();
    expect(out.holes).toEqual([{ x: 10, y: 500, width: 50, height: 20 }]);
    expect(handoffOf(wrapper, placement(), still, true)).toBe("covered");
  });

  it("stays native, all cut away, when the page covers all of it", () => {
    const { wrapper, inner, placement } = routed();
    const footer = document.createElement("div");
    footer.dataset.rect = rectAttribute(0, 480, 400, 120);
    inner.appendChild(footer);
    const button = wrapper.querySelector("button") as HTMLElement;
    Object.assign(document, { elementsFromPoint: () => [footer, button, inner] });
    const out: { holes?: TNativeFrame[] } = {};
    expect(handoffOf(wrapper, placement(), still, true, { clip: true, out })).toBeUndefined();
    expect(out.holes).toEqual([{ x: 10, y: 500, width: 100, height: 40 }]);
  });

  it("lays a see-through backdrop over the island as a shade, fixed or not", () => {
    const { wrapper, inner, placement } = routed();
    const overlay = document.createElement("div");
    overlay.dataset.rect = rectAttribute(0, 0, 400, 600);
    inner.appendChild(overlay);
    overrideStyle(overlay, { position: "fixed", backgroundColor: "rgba(0, 0, 0, 0.4)" });
    const button = wrapper.querySelector("button") as HTMLElement;
    Object.assign(document, { elementsFromPoint: () => [overlay, button, inner] });
    const out: { holes?: TNativeFrame[]; shades?: NativeShade[] } = {};
    expect(handoffOf(wrapper, placement(), still, true, { clip: true, out })).toBeUndefined();
    expect(out.holes).toBeUndefined();
    expect(out.shades).toEqual([
      { x: 10, y: 500, width: 100, height: 40, color: "rgba(0, 0, 0, 0.4)" },
    ]);
  });

  it("merges more than a few cut-outs into one", () => {
    const { wrapper, inner, placement } = routed();
    const button = wrapper.querySelector("button") as HTMLElement;
    const dots = Array.from({ length: MAX_HOLES + 2 }, (_, index) => {
      const dot = document.createElement("i");
      dot.dataset.rect = rectAttribute(10 + index * 9, 500, 4, 4);
      inner.appendChild(dot);
      return dot;
    });
    let call = 0;
    Object.assign(document, {
      elementsFromPoint: () => [dots[call++ % dots.length], button, inner],
    });
    const out: { holes?: TNativeFrame[] } = {};
    handoffOf(wrapper, placement(), still, true, { clip: true, out });
    expect(out.holes).toHaveLength(1);
  });

  it("follows an even scale when the host clips, and hands off for anything else", () => {
    const { wrapper, inner, placement } = routed();
    const button = wrapper.querySelector("button") as HTMLElement;
    overrideStyle(inner, { transform: "matrix(1.04, 0, 0, 1.04, 0, 0)" });
    expect(handoffOf(wrapper, placement(), still, true, { clip: true })).toBeUndefined();
    expect(handoffOf(wrapper, placement(), still, true)).toBe("transformed");
    overrideStyle(inner, { transform: "none", scale: "1.1" });
    expect(handoffOf(wrapper, placement(), still, true, { clip: true })).toBeUndefined();
    overrideStyle(inner, { scale: "1.1 0.9" });
    expect(handoffOf(wrapper, placement(), still, true, { clip: true })).toBe("transformed");
    overrideStyle(inner, { scale: "none" });
    overrideStyle(button, { transform: "matrix(0.9, 0, 0, 0.9, 0, 0)" });
    expect(handoffOf(wrapper, placement(), still, true, { clip: true })).toBeUndefined();
    overrideStyle(button, { transform: "matrix(0.9, 0.1, 0, 0.9, 0, 0)" });
    expect(handoffOf(wrapper, placement(), still, true, { clip: true })).toBe("transformed");
  });

  it("applies only to scroller islands", () => {
    const { wrapper, card, placement } = setup();
    card.setAttribute("data-island-phase", "enter");
    expect(handoffOf(wrapper, placement(), still, true)).toBe("inactive");
  });
});

describe("shadeOf", () => {
  it("reads a see-through fill with nothing else on it", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    overrideStyle(element, { backgroundColor: "rgba(10, 20, 30, 0.5)" });
    expect(shadeOf(element)).toBe("rgba(10, 20, 30, 0.5)");
    overrideStyle(element, { backgroundColor: "color(srgb 0.1 0.2 0.3 / 0.4)" });
    expect(shadeOf(element)).toBe("rgba(26, 51, 77, 0.4)");
    overrideStyle(element, { backgroundColor: "color(srgb 0.1 0.2)" });
    expect(shadeOf(element)).toBeUndefined();
    overrideStyle(element, { backgroundColor: "rgb(1, 2)" });
    expect(shadeOf(element)).toBeUndefined();
    overrideStyle(element, { backgroundColor: "rgb(1, 2, 3)" });
    expect(shadeOf(element)).toBeUndefined();
    overrideStyle(element, { backgroundColor: "rgba(1, 2, 3, 0)" });
    expect(shadeOf(element)).toBeUndefined();
    overrideStyle(element, { backgroundColor: "transparent" });
    expect(shadeOf(element)).toBeUndefined();
    overrideStyle(element, { backgroundColor: "rgba(1, 2, 3, 0.5)", backdropFilter: "blur(4px)" });
    expect(shadeOf(element)).toBeUndefined();
  });

  it("fades the shade with the element's own opacity, as a backdrop fading in", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    overrideStyle(element, { backgroundColor: "rgba(0, 0, 0, 0.4)", opacity: "0.5" });
    expect(shadeOf(element)).toBe("rgba(0, 0, 0, 0.2)");
    overrideStyle(element, { opacity: "0" });
    expect(shadeOf(element)).toBeUndefined();
    overrideStyle(element, { opacity: "not a number" });
    expect(shadeOf(element)).toBe("rgba(0, 0, 0, 0.4)");
  });
});

describe("isEvenScale", () => {
  it("accepts translations and even scales only", () => {
    expect(isEvenScale("none")).toBe(true);
    expect(isEvenScale("matrix(1.5, 0, 0, 1.5, 4, 4)")).toBe(true);
    expect(isEvenScale("matrix(1.5, 0, 0, 1.4, 0, 0)")).toBe(false);
    expect(isEvenScale("matrix(-1, 0, 0, -1, 0, 0)")).toBe(false);
    expect(isEvenScale("matrix(1, 0.2, 0, 1, 0, 0)")).toBe(false);
    expect(isEvenScale("matrix(1, 0)")).toBe(false);
    expect(isEvenScale("rotate(3deg)")).toBe(false);
  });
});

describe("inTransition", () => {
  it("sees a page change or a moving ancestor", () => {
    const { wrapper, card } = setup();
    expect(inTransition(wrapper, still)).toBe(false);
    expect(inTransition(wrapper, (element) => element === card)).toBe(true);
    card.setAttribute("data-island-phase", "leave");
    expect(inTransition(wrapper, still)).toBe(true);
  });

  it("stops at the scroller a layered island rides in", () => {
    const { wrapper, card } = setup();
    card.setAttribute("data-island-phase", "leave");
    expect(inTransition(wrapper, still, card)).toBe(false);
    expect(inTransition(wrapper, (element) => element === card, card)).toBe(false);
  });
});
