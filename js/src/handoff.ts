import { ISLAND_PHASE_ATTRIBUTE, ISLAND_PROBE_ATTRIBUTE } from "./attributes";
import type { TNativeFrame } from "./schemas";
import {
  boxElementsOf,
  containsAbsolute,
  containsFixed,
  contentBoxOf,
  type NativePlacement,
} from "./measure";

/** Why an island is showing its web version for now. */
export type NativeHandoff =
  | "hidden"
  | "inactive"
  | "moving"
  | "faded"
  | "transformed"
  | "clipped"
  | "covered";

const TOLERANCE = 0.5;

const CLIPPING = /hidden|clip|auto|scroll/;

const IDENTITY_3D = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

export const isTranslation = (transform: string): boolean => {
  if (transform === "none" || transform === "") return true;
  const match = /^matrix(3d)?\((.*)\)$/.exec(transform.trim());
  if (!match) return false;
  const values = (match[2] as string).split(",").map((value) => Number.parseFloat(value));
  if (match[1]) {
    return (
      values.length === 16 &&
      IDENTITY_3D.every((value, index) => values[index] === value) &&
      values[15] === 1
    );
  }
  return (
    values.length === 6 && values[0] === 1 && values[1] === 0 && values[2] === 0 && values[3] === 1
  );
};

/** Whether `transform` only translates and scales evenly, so the island can just follow its rect. */
export const isEvenScale = (transform: string): boolean => {
  if (isTranslation(transform)) return true;
  const match = /^matrix\((.*)\)$/.exec(transform.trim());
  if (!match) return false;
  const values = (match[1] as string).split(",").map((value) => Number.parseFloat(value));
  return (
    values.length === 6 &&
    (values[0] as number) > 0 &&
    values[0] === values[3] &&
    values[1] === 0 &&
    values[2] === 0
  );
};

const isEvenScaleProperty = (scale: string | undefined) => {
  if (isNone(scale)) return true;
  const parts = (scale as string).trim().split(/\s+/);
  return (
    parts.length <= 2 &&
    parts.every((part) => part === parts[0]) &&
    Number.parseFloat(parts[0] as string) > 0
  );
};

const isNone = (value: string | undefined) =>
  value === undefined || value === "" || value === "none";

export const intersect = (left: TNativeFrame, right: TNativeFrame): TNativeFrame | undefined => {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const width = Math.min(left.x + left.width, right.x + right.width) - x;
  const height = Math.min(left.y + left.height, right.y + right.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : undefined;
};

export const contains = (outer: TNativeFrame, inner: TNativeFrame): boolean =>
  inner.x >= outer.x - TOLERANCE &&
  inner.y >= outer.y - TOLERANCE &&
  inner.x + inner.width <= outer.x + outer.width + TOLERANCE &&
  inner.y + inner.height <= outer.y + outer.height + TOLERANCE;

const viewportOf = (document: Document): TNativeFrame => ({
  x: 0,
  y: 0,
  width: document.documentElement.clientWidth || (document.defaultView?.innerWidth ?? 0),
  height: document.documentElement.clientHeight || (document.defaultView?.innerHeight ?? 0),
});

export const SAMPLE_SPACING = 16;

const MAX_SAMPLES_PER_AXIS = 12;

const axis = (start: number, length: number): number[] => {
  const inset = Math.min(1, length / 4);
  const from = start + inset;
  const to = start + length - inset;
  const count = Math.min(
    MAX_SAMPLES_PER_AXIS,
    Math.max(3, Math.ceil((to - from) / SAMPLE_SPACING) + 1),
  );
  return Array.from({ length: count }, (_, index) => from + ((to - from) * index) / (count - 1));
};

export const samplePoints = (area: TNativeFrame): Array<[number, number]> => {
  const xs = axis(area.x, area.width);
  return axis(area.y, area.height).flatMap((y) => xs.map((x): [number, number] => [x, y]));
};

export type PointCover = "own" | "covered" | "outside";

export const coveredAt = (
  wrapper: HTMLElement,
  stack: readonly Element[],
  within?: Element,
): PointCover => {
  const own = stack.findIndex((element) => wrapper.contains(element));
  if (own === -1) return within ? "own" : "outside";
  return stack
    .slice(0, own)
    .some(
      (element) => !element.contains(wrapper) && (within === undefined || within.contains(element)),
    )
    ? "covered"
    : "own";
};

/** A see-through area of the page over an island, such as a sheet's dimmed backdrop. */
export type NativeShade = TNativeFrame & { color: string };

const parseAlphaColor = (value: string): [number, number, number, number] | undefined => {
  const css = /^rgba?\(([^)]*)\)$/.exec(value.trim());
  if (css) {
    const parts = (css[1] as string)
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return undefined;
    return [parts[0] as number, parts[1] as number, parts[2] as number, parts[3] ?? 1];
  }
  const srgb = /^color\(srgb ([^)]*)\)$/.exec(value.trim());
  if (srgb) {
    const parts = (srgb[1] as string)
      .split(/[\s/]+/)
      .filter(Boolean)
      .map(Number);
    if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return undefined;
    return [
      (parts[0] as number) * 255,
      (parts[1] as number) * 255,
      (parts[2] as number) * 255,
      parts[3] ?? 1,
    ];
  }
  return undefined;
};

/**
 * The `rgba()` an element is filled with when it is see-through with nothing
 * else drawn on it, such as a backdrop; `undefined` otherwise.
 */
export const shadeOf = (element: Element): string | undefined => {
  const style = getComputedStyle(element);
  if (!isNone(style.backdropFilter) || !isNone(style.backgroundImage)) return undefined;
  const color = parseAlphaColor(style.backgroundColor);
  if (!color) return undefined;
  const [red, green, blue, alpha] = color;
  if (alpha <= 0 || alpha >= 1) return undefined;
  const round = (value: number) => Math.round(Math.min(255, Math.max(0, value)));
  return `rgba(${round(red)}, ${round(green)}, ${round(blue)}, ${Number(alpha.toFixed(3))})`;
};

export const MAX_HOLES = 8;

const union = (left: TNativeFrame, right: TNativeFrame): TNativeFrame => {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  return {
    x,
    y,
    width: Math.max(left.x + left.width, right.x + right.width) - x,
    height: Math.max(left.y + left.height, right.y + right.height) - y,
  };
};

/**
 * Samples what covers the island. With `cover`, every element drawn above it
 * is collected instead of counting as cover: a see-through one with nothing
 * on it as a shade the host lays over the island, anything else as a hole cut
 * out of it. The island then stays native whatever covers it, whether WebKit
 * draws the cover on the island's layer or a layer of its own.
 */
const sampleCover = (
  wrapper: HTMLElement,
  placement: NativePlacement,
  within: Element | undefined,
  cover: { holes: TNativeFrame[]; shades: NativeShade[] } | undefined,
): boolean => {
  const document = wrapper.ownerDocument;
  if (typeof document.elementsFromPoint !== "function") return false;
  let area = intersect(placement.rect, viewportOf(document));
  if (area && placement.scroller) area = intersect(area, contentBoxOf(placement.scroller));
  if (!area) return false;
  const sampled = area;
  const seen = new Set<Element>();
  wrapper.setAttribute(ISLAND_PROBE_ATTRIBUTE, "");
  try {
    let reached = false;
    for (const [x, y] of samplePoints(sampled)) {
      const stack = document.elementsFromPoint(x, y);
      const state = coveredAt(wrapper, stack, within);
      if (state === "own") reached = true;
      if (state !== "covered") continue;
      if (!cover) return true;
      reached = true;
      const top = stack.find(
        (element) => !wrapper.contains(element) && !element.contains(wrapper),
      ) as Element;
      if (seen.has(top)) continue;
      seen.add(top);
      const rect = top.getBoundingClientRect();
      const area = intersect(
        { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        sampled,
      );
      if (!area) continue;
      const color = shadeOf(top);
      if (color) cover.shades.push({ ...area, color });
      else cover.holes.push(area);
    }
    if (cover && cover.holes.length > MAX_HOLES) {
      cover.holes.splice(0, cover.holes.length, cover.holes.reduce(union));
    }
    if (cover && cover.shades.length > MAX_HOLES) cover.shades.splice(MAX_HOLES);
    return !reached;
  } finally {
    wrapper.removeAttribute(ISLAND_PROBE_ATTRIBUTE);
  }
};

export const isCovered = (
  wrapper: HTMLElement,
  placement: NativePlacement,
  within?: Element,
): boolean => sampleCover(wrapper, placement, within, undefined);

/**
 * Whether the wrapper or an ancestor is entering, leaving or moving. With
 * `riding`, the scroller a layered island is drawn inside, the walk stops
 * there: the island moves with that scroller and everything above it.
 */
export const inTransition = (
  wrapper: HTMLElement,
  isMoving: (element: Element) => boolean,
  riding?: Element,
  isRevealing?: (element: Element) => boolean,
): boolean => {
  for (
    let element: HTMLElement | null = wrapper.parentElement;
    element && element !== riding;
    element = element.parentElement
  ) {
    if (element.hasAttribute(ISLAND_PHASE_ATTRIBUTE)) return true;
    if (isMoving(element) && !(riding && isRevealing?.(element))) return true;
  }
  return false;
};

export type HandoffOptions = {
  /**
   * Whether the host cuts islands to a clip. A layered island inside a box
   * that clips it then stays native, cut to what the box shows, even while
   * the box grows or shrinks. Default: `false`.
   */
  clip?: boolean;
  /** Whether everything moving about an element is its size. Default: nothing is. */
  isRevealing?: (element: Element) => boolean;
  /**
   * Receives the visible part of a clipped island and the parts covered by
   * the page, in viewport coordinates, and whether a box around it is resizing.
   */
  out?: {
    clip?: TNativeFrame;
    holes?: TNativeFrame[];
    shades?: NativeShade[];
    revealing?: boolean;
  };
};

export const handoffOf = (
  wrapper: HTMLElement,
  placement: NativePlacement,
  isMoving: (element: Element) => boolean,
  layered = false,
  options: HandoffOptions = {},
): NativeHandoff | undefined => {
  const riding = layered && placement.kind === "scroller" ? placement.scroller : undefined;
  const clips = riding !== undefined && options.clip === true;
  let visible: TNativeFrame = placement.rect;
  let carried = false;
  const follows = (style: CSSStyleDeclaration) =>
    clips
      ? isEvenScale(style.transform) && isEvenScaleProperty(style.scale) && isNone(style.rotate)
      : isTranslation(style.transform) && isNone(style.scale) && isNone(style.rotate);
  if (placement.rect.width <= 0 || placement.rect.height <= 0) return "hidden";
  const boxes = boxElementsOf(wrapper);
  for (const box of boxes) {
    if (box === wrapper) continue;
    const style = getComputedStyle(box);
    if (!follows(style)) return "transformed";
  }
  const firstPosition = getComputedStyle(boxes[0] as HTMLElement).position;
  let clipping = placement.kind !== "screen";
  let pending: "absolute" | "fixed" | undefined =
    firstPosition === "absolute" ? "absolute" : firstPosition === "fixed" ? "fixed" : undefined;
  const { body, documentElement } = wrapper.ownerDocument;
  for (
    let element: HTMLElement | null = wrapper.parentElement;
    element;
    element = element.parentElement
  ) {
    if (element === riding) carried = true;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return "hidden";
    if (carried) continue;
    if (element.hasAttribute("inert") || element.hasAttribute(ISLAND_PHASE_ATTRIBUTE))
      return "inactive";
    if (
      isMoving(element) &&
      clips &&
      options.isRevealing?.(element) &&
      CLIPPING.test(style.overflowY + style.overflowX) &&
      options.out
    )
      options.out.revealing = true;
    if (Number.parseFloat(style.opacity) < 1) return "faded";
    if (!follows(style) || !isNone(style.filter) || !isNone(style.clipPath)) {
      return "transformed";
    }
    if (element === placement.scroller) clipping = false;
    if (pending) {
      if ((pending === "fixed" ? containsFixed : containsAbsolute)(style)) pending = undefined;
      else continue;
    }
    if (style.position === "absolute") pending = "absolute";
    else if (style.position === "fixed") pending = "fixed";
    if (element === body || element === documentElement) continue;
    if (
      clipping &&
      (CLIPPING.test(style.overflowX) || CLIPPING.test(style.overflowY)) &&
      !contains(contentBoxOf(element), visible)
    ) {
      if (!clips) return "clipped";
      const shown = intersect(visible, contentBoxOf(element));
      if (!shown) return "hidden";
      if (!(isMoving(element) && options.isRevealing?.(element))) return "clipped";
      visible = shown;
    }
  }
  if (visible !== placement.rect && options.out) options.out.clip = visible;
  const cover = clips && options.out ? { holes: [], shades: [] } : undefined;
  const covered = sampleCover(wrapper, { ...placement, rect: visible }, riding, cover);
  if (cover && options.out) {
    if (cover.holes.length > 0) options.out.holes = cover.holes;
    if (cover.shades.length > 0) options.out.shades = cover.shades;
  }
  return covered ? "covered" : undefined;
};
