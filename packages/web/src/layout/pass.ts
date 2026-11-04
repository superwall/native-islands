import type { TNativeFrame } from "../protocol/schemas";
import { ISLAND_COMPONENT_ATTRIBUTE, ISLAND_PROBE_ATTRIBUTE } from "./attributes";

type Remembered = {
  style: CSSStyleDeclaration;
  box: TNativeFrame;
  scale: { x: number; y: number };
  offset: { x: number; y: number };
};

type Pass = {
  probed?: Element[];
  memo: { [K in keyof Remembered]: Map<Element, Remembered[K]> };
};

const ISLAND = `[${ISLAND_COMPONENT_ATTRIBUTE}]`;

const passes = new WeakMap<Document, Pass>();

/**
 * Runs `measure` as one layout pass: geometry read once is reused until it
 * ends, and every island's hit-test probe goes up once and comes down once,
 * so WebKit recalculates style once per pass rather than once per island.
 * Nothing in the pass may move the page.
 */
export const inLayoutPass = <T>(document: Document, measure: () => T): T => {
  if (passes.has(document)) return measure();
  const pass: Pass = {
    memo: { style: new Map(), box: new Map(), scale: new Map(), offset: new Map() },
  };
  passes.set(document, pass);
  try {
    return measure();
  } finally {
    passes.delete(document);
    for (const wrapper of pass.probed ?? []) wrapper.removeAttribute(ISLAND_PROBE_ATTRIBUTE);
  }
};

export const remember = <K extends keyof Remembered>(
  element: Element,
  kind: K,
  read: () => Remembered[K],
): Remembered[K] => {
  const memo = passes.get(element.ownerDocument)?.memo[kind];
  if (!memo) return read();
  const known = memo.get(element);
  if (known !== undefined) return known;
  const value = read();
  memo.set(element, value);
  return value;
};

export const styleOf = (element: Element): CSSStyleDeclaration =>
  remember(element, "style", () => getComputedStyle(element));

// A probe makes a wrapper's whole subtree visible and hit-testable, so one
// holding another island would change what that island measures; it is
// probed alone when its own turn comes.
const probeAll = (pass: Pass, document: Document): Element[] => {
  if (pass.probed) return pass.probed;
  const wrappers = [...document.querySelectorAll(ISLAND)];
  const outer = new Set(wrappers.map((wrapper) => wrapper.parentElement?.closest(ISLAND)));
  const probed = wrappers.filter((wrapper) => !outer.has(wrapper));
  for (const wrapper of probed) wrapper.setAttribute(ISLAND_PROBE_ATTRIBUTE, "");
  pass.probed = probed;
  return probed;
};

class SharedStack extends Error {}

export type Hits = {
  /** Everything at the point, topmost first. */
  stackAt: (x: number, y: number) => Element[];
  /**
   * Whether the wrapper's own content is topmost at the point, which a single
   * hit test answers, far cheaper than the whole stack.
   */
  ownAt: (x: number, y: number) => boolean;
};

/**
 * Hit-tests with the wrapper's content made hit-testable, as `sample` asks.
 * In a layout pass every island is probed at once; a stack that holds
 * another island's content could depend on that island's probe, so `sample`
 * runs again with this wrapper probed alone.
 */
export const hitTest = <T>(wrapper: HTMLElement, sample: (hits: Hits) => T): T => {
  const document = wrapper.ownerDocument;
  const topAt =
    typeof document.elementFromPoint === "function"
      ? (x: number, y: number) => document.elementFromPoint(x, y)
      : () => null;
  const pass = passes.get(document);
  const probed = pass ? probeAll(pass, document) : [];
  if (probed.includes(wrapper)) {
    try {
      return sample({
        stackAt: (x, y) => {
          const stack = document.elementsFromPoint(x, y);
          const shared = stack.some((element) => {
            const owner = element.closest(ISLAND);
            return owner !== null && owner !== wrapper;
          });
          if (shared) throw new SharedStack();
          return stack;
        },
        ownAt: (x, y) => topAt(x, y)?.closest(ISLAND) === wrapper,
      });
    } catch (error) {
      if (!(error instanceof SharedStack)) throw error;
    }
  }
  const others = probed.filter((element) => element !== wrapper);
  for (const element of others) element.removeAttribute(ISLAND_PROBE_ATTRIBUTE);
  const own = !probed.includes(wrapper);
  if (own) wrapper.setAttribute(ISLAND_PROBE_ATTRIBUTE, "");
  try {
    return sample({
      stackAt: (x, y) => document.elementsFromPoint(x, y),
      ownAt: (x, y) => {
        const top = topAt(x, y);
        return top !== null && wrapper.contains(top);
      },
    });
  } finally {
    if (own) wrapper.removeAttribute(ISLAND_PROBE_ATTRIBUTE);
    for (const element of others) element.setAttribute(ISLAND_PROBE_ATTRIBUTE, "");
  }
};
