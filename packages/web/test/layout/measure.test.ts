import { afterEach, describe, expect, it, vi } from "vitest";
import {
  anchorOf,
  containsAbsolute,
  containsFixed,
  scrollOffsetOf,
  boxElementsOf,
  frameIn,
  isScroller,
  placementOf,
  scaleOf,
  sameAnchor,
  scrollerIdOf,
  unionRect,
} from "../../src/layout/measure";
import { ISLAND_SCROLLER_ATTRIBUTE } from "../../src/layout/attributes";
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

const mount = (markup: string) => {
  const host = document.createElement("div");
  host.innerHTML = markup;
  document.body.appendChild(host);
  return host;
};

const wrapperIn = (host: HTMLElement) => host.querySelector("[data-island]") as HTMLElement;

describe("boxElementsOf", () => {
  it("measures the children of a display: contents wrapper, skipping non-HTML ones", () => {
    const host = mount(
      `<div data-island style="display: contents"><span>a</span><svg></svg><b>b</b></div>`,
    );
    expect(boxElementsOf(wrapperIn(host)).map((child) => child.tagName)).toEqual(["SPAN", "B"]);
  });

  it("leaves out a hidden child, which has no box", () => {
    const host = mount(
      `<div data-island style="display: contents"><button>Pick</button><input type="file" hidden><span style="display: none"></span></div>`,
    );
    expect(boxElementsOf(wrapperIn(host)).map((child) => child.tagName)).toEqual(["BUTTON"]);
  });

  it("looks through a nested display: contents child to its own children", () => {
    const host = mount(
      `<div data-island style="display: contents"><span>a</span><div style="display: contents"><b>b</b><i hidden>c</i><div style="display: contents"><u>d</u></div></div></div>`,
    );
    expect(boxElementsOf(wrapperIn(host)).map((child) => child.tagName)).toEqual([
      "SPAN",
      "B",
      "U",
    ]);
  });

  it("has no boxes when every child is hidden", () => {
    const host = mount(
      `<div data-island style="display: contents"><input hidden><div style="display: contents"></div></div>`,
    );
    expect(boxElementsOf(wrapperIn(host))).toEqual([]);
  });

  it("measures the wrapper itself once it has a box", () => {
    const host = mount(`<div data-island style="display: inline-block"><span>a</span></div>`);
    expect(boxElementsOf(wrapperIn(host))).toEqual([wrapperIn(host)]);
  });
});

describe("unionRect", () => {
  it("covers every element", () => {
    mockLayout();
    const host = mount(
      `<div data-island style="display: contents"><span data-rect="${rectAttribute(10, 10, 20, 20)}"></span><span data-rect="${rectAttribute(0, 40, 5, 5)}"></span></div>`,
    );
    expect(unionRect(boxElementsOf(wrapperIn(host)))).toEqual({
      x: 0,
      y: 10,
      width: 30,
      height: 35,
    });
  });

  it("has nothing to cover without elements", () => {
    expect(unionRect([])).toBeUndefined();
  });
});

describe("isScroller", () => {
  it("needs both a scrolling overflow and content that overflows", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    overrideStyle(element, { overflowY: "auto", overflowX: "visible" });
    setScrollGeometry(element, { scrollHeight: 100, clientHeight: 100 });
    expect(isScroller(element)).toBe(false);
    setScrollGeometry(element, { scrollHeight: 300 });
    expect(isScroller(element)).toBe(true);
    overrideStyle(element, { overflowY: "hidden", overflowX: "scroll" });
    expect(isScroller(element)).toBe(false);
    setScrollGeometry(element, { scrollWidth: 500, clientWidth: 100 });
    expect(isScroller(element)).toBe(true);
  });
});

describe("anchorOf", () => {
  it("anchors to the screen inside a fixed element, even the element itself", () => {
    const host = mount(`<div id="bar"><button id="b">x</button></div>`);
    overrideStyle(host.querySelector("#bar") as Element, { position: "fixed" });
    expect(anchorOf(host.querySelector("#b") as Element)).toEqual({ kind: "screen" });
    expect(anchorOf(host.querySelector("#bar") as Element)).toEqual({ kind: "screen" });
  });

  it("tracks an element inside a sticky one", () => {
    const host = mount(`<footer id="f"><button id="b">x</button></footer>`);
    overrideStyle(host.querySelector("#f") as Element, { position: "sticky" });
    expect(anchorOf(host.querySelector("#b") as Element)).toEqual({ kind: "tracked" });
  });

  it("anchors to the nearest scroller but never to the element itself", () => {
    const host = mount(`<div id="outer"><div id="inner"><button id="b">x</button></div></div>`);
    for (const id of ["#outer", "#inner"]) {
      const element = host.querySelector(id) as HTMLElement;
      overrideStyle(element, { overflowY: "auto" });
      setScrollGeometry(element, { scrollHeight: 500, clientHeight: 100 });
    }
    const inner = host.querySelector("#inner") as HTMLElement;
    expect(anchorOf(host.querySelector("#b") as Element)).toEqual({
      kind: "scroller",
      scroller: inner,
    });
    expect(anchorOf(inner)).toEqual({
      kind: "scroller",
      scroller: host.querySelector("#outer"),
    });
  });

  it("anchors to the page without any of those", () => {
    const host = mount(`<button id="b">x</button>`);
    expect(anchorOf(host.querySelector("#b") as Element)).toEqual({ kind: "page" });
    expect(anchorOf(document.body)).toEqual({ kind: "page" });
  });
});

describe("frameIn", () => {
  it("keeps screen and tracked frames in viewport coordinates", () => {
    const rect = { x: 4, y: 8, width: 30, height: 20 };
    expect(frameIn({ kind: "screen" }, rect, document)).toEqual(rect);
    expect(frameIn({ kind: "tracked" }, rect, document)).toEqual(rect);
  });

  it("adds the window's scroll for the page, and nothing for a detached document", () => {
    const rect = { x: 4, y: 8, width: 30, height: 20 };
    Object.assign(window, { scrollX: 3, scrollY: 100 });
    expect(frameIn({ kind: "page" }, rect, document)).toEqual({
      x: 7,
      y: 108,
      width: 30,
      height: 20,
    });
    Object.assign(window, { scrollX: 0, scrollY: 0 });
    const detached = document.implementation.createHTMLDocument();
    expect(frameIn({ kind: "page" }, rect, detached)).toEqual(rect);
  });
});

describe("placementOf", () => {
  it("returns page coordinates", () => {
    mockLayout();
    Object.defineProperty(window, "scrollX", { value: 5, configurable: true });
    const host = mount(
      `<div data-island style="display: contents"><span data-rect="${rectAttribute(10, 10, 20, 20)}"></span></div>`,
    );
    expect(placementOf(wrapperIn(host))).toEqual({
      kind: "page",
      at: { kind: "page" },
      rect: { x: 10, y: 10, width: 20, height: 20 },
      frame: { x: 15, y: 10, width: 20, height: 20 },
      anchor: { type: "page" },
    });
    Object.defineProperty(window, "scrollX", { value: 0, configurable: true });
  });

  it("measures a button next to a hidden file input as the button alone, not from 0,0", () => {
    mockLayout();
    const host = mount(
      `<div data-island style="display: contents"><button data-rect="${rectAttribute(100, 200, 160, 44)}">Pick</button><input type="file" hidden></div>`,
    );
    expect(placementOf(wrapperIn(host))).toMatchObject({
      kind: "page",
      rect: { x: 100, y: 200, width: 160, height: 44 },
      frame: { x: 100, y: 200, width: 160, height: 44 },
    });
  });

  it("returns viewport coordinates on the screen anchor for fixed and sticky elements", () => {
    mockLayout();
    for (const position of ["fixed", "sticky"]) {
      const host = mount(
        `<div data-island style="display: contents"><span data-rect="${rectAttribute(300, 40, 44, 44)}"></span></div>`,
      );
      overrideStyle(host.querySelector("span") as Element, { position });
      expect(placementOf(wrapperIn(host))).toMatchObject({
        kind: position === "fixed" ? "screen" : "tracked",
        frame: { x: 300, y: 40, width: 44, height: 44 },
        anchor: { type: "screen" },
      });
    }
  });

  it("returns content coordinates inside an inner scroller, with the scroller described", () => {
    mockLayout();
    const host = mount(
      `<div id="list" data-rect="${rectAttribute(20, 300, 360, 200)}"><div data-island style="display: contents"><span data-rect="${rectAttribute(40, 280, 100, 40)}"></span></div></div>`,
    );
    const list = host.querySelector("#list") as HTMLElement;
    overrideStyle(list, { overflowY: "auto" });
    setScrollGeometry(list, {
      scrollHeight: 800,
      scrollWidth: 356,
      clientHeight: 196,
      clientWidth: 356,
      clientTop: 2,
      clientLeft: 2,
      scrollTop: 150,
      scrollLeft: 0,
    });
    const placement = placementOf(wrapperIn(host));
    expect(placement).toMatchObject({
      kind: "scroller",
      scroller: list,
      frame: { x: 18, y: 128, width: 100, height: 40 },
      anchor: {
        type: "scroller",
        scroller: {
          id: scrollerIdOf(list),
          frame: { x: 22, y: 302, width: 356, height: 196 },
          content_size: { width: 356, height: 800 },
          scroll_offset: { x: 0, y: 150 },
        },
      },
    });
    expect(list.hasAttribute(ISLAND_SCROLLER_ATTRIBUTE)).toBe(true);
  });

  it("measures nothing for an empty wrapper", () => {
    const host = mount(`<div data-island style="display: contents"></div>`);
    expect(placementOf(wrapperIn(host))).toBeUndefined();
  });

  it("measures a detached document with no window", () => {
    mockLayout();
    const detached = document.implementation.createHTMLDocument();
    const element = detached.createElement("div");
    element.style.display = "inline-block";
    element.dataset.rect = rectAttribute(1, 2, 3, 4);
    detached.body.appendChild(element);
    expect(placementOf(element)?.frame).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });
});

describe("scaleOf", () => {
  it("reads an element's rendered scale, or 1 when it cannot", () => {
    mockLayout();
    const element = document.createElement("div");
    element.dataset.rect = rectAttribute(0, 0, 180, 50);
    document.body.appendChild(element);
    expect(scaleOf(element)).toEqual({ x: 1, y: 1 });
    Object.defineProperty(element, "offsetWidth", { value: 200, configurable: true });
    Object.defineProperty(element, "offsetHeight", { value: 100, configurable: true });
    expect(scaleOf(element)).toEqual({ x: 0.9, y: 0.5 });
    element.dataset.rect = rectAttribute(0, 0, 0, 0);
    expect(scaleOf(element)).toEqual({ x: 1, y: 1 });
  });

  it("measures inside a scaled scroller in its own, unscaled coordinates", () => {
    mockLayout();
    const host = document.createElement("div");
    host.innerHTML = `<div id="list" data-rect="${rectAttribute(0, 0, 180, 270)}"><div data-island style="display: contents"><span data-rect="${rectAttribute(18, 45, 90, 18)}"></span></div></div>`;
    document.body.appendChild(host);
    const list = host.querySelector("#list") as HTMLElement;
    overrideStyle(list, { overflowY: "auto" });
    setScrollGeometry(list, {
      scrollHeight: 900,
      clientHeight: 300,
      clientWidth: 200,
      scrollTop: 10,
    });
    Object.defineProperty(list, "offsetWidth", { value: 200, configurable: true });
    Object.defineProperty(list, "offsetHeight", { value: 300, configurable: true });
    const placement = placementOf(host.querySelector("[data-island]") as HTMLElement);
    expect(placement?.frame).toEqual({ x: 20, y: 60, width: 100, height: 20 });
  });
});

describe("scrollerIdOf", () => {
  it("is stable per element and distinct between elements", () => {
    const one = document.createElement("div");
    const two = document.createElement("div");
    expect(scrollerIdOf(one)).toBe(scrollerIdOf(one));
    expect(scrollerIdOf(one)).not.toBe(scrollerIdOf(two));
  });
});

describe("sameAnchor", () => {
  const scroller = (id: string) => ({
    type: "scroller" as const,
    scroller: {
      id,
      frame: { x: 0, y: 0, width: 1, height: 1 },
      content_size: { width: 1, height: 1 },
      scroll_offset: { x: 0, y: 0 },
    },
  });

  it("resends a scroller whose size or content size changed", () => {
    const resized = (width: number, height: number, content: number) => ({
      ...scroller("a"),
      scroller: {
        ...scroller("a").scroller,
        frame: { x: 0, y: 0, width, height },
        content_size: { width, height: content },
      },
    });
    expect(sameAnchor(scroller("a"), resized(1, 1, 1.2))).toBe(true);
    expect(sameAnchor(scroller("a"), resized(1, 1, 930))).toBe(false);
    expect(sameAnchor(scroller("a"), resized(2, 1, 1))).toBe(false);
    expect(sameAnchor(scroller("a"), resized(1, 2, 1))).toBe(false);
    expect(
      sameAnchor(scroller("a"), {
        ...scroller("a"),
        scroller: { ...scroller("a").scroller, content_size: { width: 3, height: 1 } },
      }),
    ).toBe(false);
  });

  it("does not resend a scroller that only scrolled or moved", () => {
    expect(sameAnchor({ type: "page" }, { type: "page" })).toBe(true);
    expect(sameAnchor({ type: "page" }, { type: "screen" })).toBe(false);
    expect(
      sameAnchor(scroller("a"), {
        ...scroller("a"),
        scroller: {
          ...scroller("a").scroller,
          frame: { x: 402, y: 0, width: 1, height: 1 },
          scroll_offset: { x: 0, y: 99 },
        },
      }),
    ).toBe(true);
    expect(sameAnchor(scroller("a"), scroller("b"))).toBe(false);
    expect(sameAnchor({ type: "screen" }, scroller("a"))).toBe(false);
  });
});

describe("containing blocks", () => {
  const styleOf = (values: Record<string, string>) => values as unknown as CSSStyleDeclaration;

  it("knows what holds a fixed or absolute element", () => {
    expect(containsFixed(styleOf({}))).toBe(false);
    expect(containsFixed(styleOf({ transform: "matrix(1, 0, 0, 1, 0, 0)" }))).toBe(true);
    expect(containsFixed(styleOf({ filter: "blur(1px)" }))).toBe(true);
    expect(containsFixed(styleOf({ perspective: "100px" }))).toBe(true);
    expect(containsFixed(styleOf({ willChange: "transform" }))).toBe(true);
    expect(containsFixed(styleOf({ contain: "paint" }))).toBe(true);
    expect(containsFixed(styleOf({ willChange: "auto", contain: "none" }))).toBe(false);
    expect(containsAbsolute(styleOf({ position: "relative" }))).toBe(true);
    expect(containsAbsolute(styleOf({ position: "static" }))).toBe(false);
    expect(containsAbsolute(styleOf({ position: "", transform: "rotate(1deg)" }))).toBe(true);
  });

  it("anchors an absolute element to the scroller that holds it, not one it escapes", () => {
    const host = mount(
      `<section id="section"><div id="list"><div id="row"><button id="b">x</button></div></div></section>`,
    );
    const list = host.querySelector("#list") as HTMLElement;
    overrideStyle(list, { overflowY: "auto" });
    setScrollGeometry(list, { scrollHeight: 500, clientHeight: 100 });
    const button = host.querySelector("#b") as HTMLElement;
    expect(anchorOf(button)).toEqual({ kind: "scroller", scroller: list });
    overrideStyle(button, { position: "absolute" });
    expect(anchorOf(button)).toEqual({ kind: "page" });
    overrideStyle(host.querySelector("#row") as Element, { position: "relative" });
    expect(anchorOf(button)).toEqual({ kind: "scroller", scroller: list });
  });

  it("treats a fixed element inside a transformed ancestor like an absolute one", () => {
    const host = mount(`<div id="list"><div id="frame"><button id="b">x</button></div></div>`);
    const list = host.querySelector("#list") as HTMLElement;
    overrideStyle(list, { overflowY: "auto" });
    setScrollGeometry(list, { scrollHeight: 500, clientHeight: 100 });
    const button = host.querySelector("#b") as HTMLElement;
    overrideStyle(button, { position: "fixed" });
    expect(anchorOf(button)).toEqual({ kind: "screen" });
    overrideStyle(host.querySelector("#frame") as Element, {
      transform: "matrix(1, 0, 0, 1, 0, 4)",
    });
    expect(anchorOf(button)).toEqual({ kind: "scroller", scroller: list });
  });
});

describe("scrollOffsetOf", () => {
  const scroller = (style: Record<string, string>) => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    overrideStyle(element, { display: "block", direction: "ltr", flexDirection: "row", ...style });
    setScrollGeometry(element, {
      scrollLeft: -100,
      scrollTop: -50,
      scrollWidth: 860,
      clientWidth: 282,
      scrollHeight: 448,
      clientHeight: 218,
    });
    return element;
  };

  it("measures from the left and top whichever way the content flows", () => {
    expect(scrollOffsetOf(scroller({ direction: "rtl" }))).toEqual({ x: 478, y: -50 });
    expect(scrollOffsetOf(scroller({ display: "flex", flexDirection: "row-reverse" }))).toEqual({
      x: 478,
      y: -50,
    });
    expect(
      scrollOffsetOf(scroller({ display: "flex", direction: "rtl", flexDirection: "row-reverse" })),
    ).toEqual({ x: -100, y: -50 });
    expect(scrollOffsetOf(scroller({ display: "flex", flexDirection: "column-reverse" }))).toEqual({
      x: -100,
      y: 180,
    });
    expect(scrollOffsetOf(scroller({ display: "inline-flex", flexDirection: "column" }))).toEqual({
      x: -100,
      y: -50,
    });
  });
});
