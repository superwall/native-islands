import { afterEach, describe, expect, it, vi } from "vitest";
import { ISLAND_COMPONENT_ATTRIBUTE, ISLAND_PROBE_ATTRIBUTE } from "../../src/layout/attributes";
import { isCovered } from "../../src/layout/handoff";
import { contentBoxOf, placementOf, type NativePlacement } from "../../src/layout/measure";
import { type Hits, hitTest, inLayoutPass, remember, styleOf } from "../../src/layout/pass";
import { mockLayout, rectAttribute } from "../support/dom";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "elementsFromPoint");
  Reflect.deleteProperty(document, "elementFromPoint");
});

const island = (name: string, rect = rectAttribute(10, 10, 100, 40)) => {
  const wrapper = document.createElement("span");
  wrapper.setAttribute(ISLAND_COMPONENT_ATTRIBUTE, name);
  wrapper.style.display = "contents";
  const button = document.createElement("button");
  button.dataset.rect = rect;
  wrapper.appendChild(button);
  return { wrapper, button };
};

const probedNow = () =>
  [...document.querySelectorAll(`[${ISLAND_PROBE_ATTRIBUTE}]`)].map((element) =>
    element.getAttribute(ISLAND_COMPONENT_ATTRIBUTE),
  );

describe("remember", () => {
  it("reads every time outside a layout pass and once inside one", () => {
    const element = document.createElement("div");
    const read = vi.fn(() => ({ x: 1, y: 1 }));
    remember(element, "scale", read);
    remember(element, "scale", read);
    expect(read).toHaveBeenCalledTimes(2);
    read.mockClear();
    inLayoutPass(document, () => {
      const first = remember(element, "scale", read);
      expect(remember(element, "scale", read)).toBe(first);
      remember(element, "offset", read);
    });
    expect(read).toHaveBeenCalledTimes(2);
    remember(element, "scale", read);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("keeps a scroller's content box for the rest of the pass", () => {
    mockLayout();
    const scroller = document.createElement("div");
    scroller.dataset.rect = rectAttribute(0, 0, 300, 200);
    document.body.appendChild(scroller);
    const spy = vi.spyOn(scroller, "getBoundingClientRect");
    inLayoutPass(document, () => {
      expect(contentBoxOf(scroller)).toBe(contentBoxOf(scroller));
    });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("reads each element's computed style once per pass", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const spy = vi.spyOn(window, "getComputedStyle");
    inLayoutPass(document, () => {
      expect(styleOf(element)).toBe(styleOf(element));
    });
    styleOf(element);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("inLayoutPass", () => {
  it("joins a pass already running instead of starting another", () => {
    const element = document.createElement("div");
    const read = vi.fn(() => ({ x: 0, y: 0 }));
    inLayoutPass(document, () => {
      remember(element, "offset", read);
      expect(inLayoutPass(document, () => remember(element, "offset", read))).toEqual({
        x: 0,
        y: 0,
      });
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("takes every probe down when a measurement throws", () => {
    const one = island("one");
    document.body.append(one.wrapper);
    Object.assign(document, { elementsFromPoint: () => [one.button] });
    expect(() =>
      inLayoutPass(document, () => {
        hitTest(one.wrapper, ({ stackAt }) => stackAt(0, 0));
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(probedNow()).toEqual([]);
  });
});

describe("hitTest", () => {
  it("probes only its own wrapper outside a layout pass", () => {
    const one = island("one");
    const two = island("two");
    document.body.append(one.wrapper, two.wrapper);
    const seen: Array<Array<string | null>> = [];
    Object.assign(document, {
      elementsFromPoint: () => {
        seen.push(probedNow());
        return [one.button];
      },
    });
    expect(hitTest(one.wrapper, ({ stackAt }) => stackAt(0, 0))).toEqual([one.button]);
    expect(seen).toEqual([["one"]]);
    expect(probedNow()).toEqual([]);
  });

  it("puts every island's probe up once per pass and takes them down at its end", () => {
    const one = island("one");
    const two = island("two");
    const three = island("three");
    document.body.append(one.wrapper, two.wrapper, three.wrapper);
    const set = vi.spyOn(Element.prototype, "setAttribute");
    const seen: Array<Array<string | null>> = [];
    let hit: Element = one.button;
    Object.assign(document, {
      elementsFromPoint: () => {
        seen.push(probedNow());
        return [hit, document.body];
      },
    });
    inLayoutPass(document, () => {
      hitTest(one.wrapper, ({ stackAt }) => stackAt(0, 0));
      hit = two.button;
      hitTest(two.wrapper, ({ stackAt }) => stackAt(0, 0));
      hit = three.button;
      hitTest(three.wrapper, ({ stackAt }) => stackAt(0, 0));
    });
    expect(seen).toEqual(Array.from({ length: 3 }, () => ["one", "two", "three"]));
    expect(set.mock.calls.filter(([name]) => name === ISLAND_PROBE_ATTRIBUTE)).toHaveLength(3);
    expect(probedNow()).toEqual([]);
  });

  it("samples again with only its own probe where another island's content is in the stack", () => {
    const one = island("one");
    const two = island("two");
    document.body.append(one.wrapper, two.wrapper);
    const seen: Array<Array<string | null>> = [];
    Object.assign(document, {
      elementsFromPoint: () => {
        const probed = probedNow();
        seen.push(probed);
        return probed.includes("two") ? [two.button, one.button] : [one.button];
      },
    });
    const sample = vi.fn(({ stackAt }: Hits) => stackAt(0, 0));
    inLayoutPass(document, () => {
      expect(hitTest(one.wrapper, sample)).toEqual([one.button]);
      expect(probedNow()).toEqual(["one", "two"]);
    });
    expect(sample).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([["one", "two"], ["one"]]);
  });

  it("probes an island holding another island alone, so its probe never changes what the inner one measures", () => {
    const outer = island("outer");
    const inner = island("inner");
    outer.wrapper.appendChild(inner.wrapper);
    document.body.append(outer.wrapper);
    const seen: Array<Array<string | null>> = [];
    Object.assign(document, {
      elementsFromPoint: () => {
        seen.push(probedNow());
        return [inner.button];
      },
    });
    inLayoutPass(document, () => {
      hitTest(inner.wrapper, ({ stackAt }) => stackAt(0, 0));
      hitTest(outer.wrapper, ({ stackAt }) => stackAt(0, 0));
      expect(probedNow()).toEqual(["inner"]);
    });
    expect(seen).toEqual([["inner"], ["outer"]]);
    expect(probedNow()).toEqual([]);
  });

  it("probes an element that is not an island alone in a pass", () => {
    const one = island("one");
    const plain = document.createElement("div");
    document.body.append(one.wrapper, plain);
    const seen: boolean[] = [];
    Object.assign(document, {
      elementsFromPoint: () => {
        seen.push(probedNow().length === 1 && plain.hasAttribute(ISLAND_PROBE_ATTRIBUTE));
        return [];
      },
    });
    inLayoutPass(document, () => {
      hitTest(plain, ({ stackAt }) => stackAt(0, 0));
      expect(plain.hasAttribute(ISLAND_PROBE_ATTRIBUTE)).toBe(false);
      expect(probedNow()).toEqual(["one"]);
    });
    expect(seen).toEqual([true]);
  });

  it("lets other errors through", () => {
    const one = island("one");
    document.body.append(one.wrapper);
    expect(() =>
      inLayoutPass(document, () =>
        hitTest(one.wrapper, () => {
          throw new Error("boom");
        }),
      ),
    ).toThrow("boom");
  });
});

describe("cover in a layout pass", () => {
  it("finds the same cover for overlapping islands as measuring each alone", () => {
    mockLayout();
    const under = island("under", rectAttribute(10, 10, 100, 40));
    const over = island("over", rectAttribute(10, 10, 100, 40));
    document.body.append(under.wrapper, over.wrapper);
    // `over` paints above `under`; like a shown island's web version, its
    // content is hit-testable only while it is probed.
    Object.assign(document, {
      elementsFromPoint: () => [
        ...(over.wrapper.hasAttribute(ISLAND_PROBE_ATTRIBUTE) ? [over.button] : []),
        ...(under.wrapper.hasAttribute(ISLAND_PROBE_ATTRIBUTE) ? [under.button] : []),
        document.body,
      ],
    });
    const placement = (wrapper: HTMLElement) => placementOf(wrapper) as NativePlacement;
    const alone = [
      isCovered(under.wrapper, placement(under.wrapper)),
      isCovered(over.wrapper, placement(over.wrapper)),
    ];
    const batched = inLayoutPass(document, () => [
      isCovered(under.wrapper, placement(under.wrapper)),
      isCovered(over.wrapper, placement(over.wrapper)),
    ]);
    expect(alone).toEqual([false, false]);
    expect(batched).toEqual(alone);
  });
});

describe("ownAt", () => {
  const ownAt = (wrapper: HTMLElement) => hitTest(wrapper, (hits) => hits.ownAt(0, 0));

  it("answers whether the wrapper's own content is topmost from a single hit test", () => {
    const one = island("one");
    const two = island("two");
    const other = document.createElement("div");
    document.body.append(one.wrapper, two.wrapper, other);
    const stack = vi.fn(() => []);
    let top: Element | null = one.button;
    Object.assign(document, { elementsFromPoint: stack, elementFromPoint: () => top });
    expect(ownAt(one.wrapper)).toBe(true);
    expect(inLayoutPass(document, () => ownAt(one.wrapper))).toBe(true);
    top = other;
    expect(ownAt(one.wrapper)).toBe(false);
    expect(inLayoutPass(document, () => ownAt(one.wrapper))).toBe(false);
    top = null;
    expect(ownAt(one.wrapper)).toBe(false);
    expect(inLayoutPass(document, () => ownAt(one.wrapper))).toBe(false);
    expect(stack).not.toHaveBeenCalled();
  });

  it("counts a nested island's content as its holder's own, as hit testing alone does", () => {
    const outer = island("outer");
    const inner = island("inner");
    outer.wrapper.appendChild(inner.wrapper);
    const one = island("one");
    one.wrapper.appendChild(outer.wrapper);
    document.body.append(one.wrapper);
    Object.assign(document, { elementFromPoint: () => inner.button });
    expect(
      inLayoutPass(document, () => [
        ownAt(inner.wrapper),
        ownAt(outer.wrapper),
        ownAt(one.wrapper),
      ]),
    ).toEqual([true, true, true]);
  });

  it("is never true where single hit tests do not exist", () => {
    const one = island("one");
    document.body.append(one.wrapper);
    expect(ownAt(one.wrapper)).toBe(false);
  });
});

describe("cover from single hit tests", () => {
  it("asks for the whole stack only where something else is on top", () => {
    mockLayout();
    const one = island("one", rectAttribute(10, 10, 100, 40));
    const sheet = document.createElement("div");
    document.body.append(one.wrapper, sheet);
    let call = 0;
    const stack = vi.fn(() => [sheet, one.button]);
    Object.assign(document, {
      elementFromPoint: () => (call++ === 0 ? sheet : one.button),
      elementsFromPoint: stack,
    });
    const placement = placementOf(one.wrapper) as NativePlacement;
    expect(inLayoutPass(document, () => isCovered(one.wrapper, placement))).toBe(true);
    expect(stack).toHaveBeenCalledTimes(1);
    call = 1;
    expect(isCovered(one.wrapper, placement)).toBe(false);
    expect(stack).toHaveBeenCalledTimes(1);
  });
});
