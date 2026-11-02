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

export const isCovered = (
  wrapper: HTMLElement,
  placement: NativePlacement,
  within?: Element,
): boolean => {
  const document = wrapper.ownerDocument;
  if (typeof document.elementsFromPoint !== "function") return false;
  let area = intersect(placement.rect, viewportOf(document));
  if (area && placement.scroller) area = intersect(area, contentBoxOf(placement.scroller));
  if (!area) return false;
  const sampled = area;
  wrapper.setAttribute(ISLAND_PROBE_ATTRIBUTE, "");
  try {
    let reached = false;
    for (const [x, y] of samplePoints(sampled)) {
      const cover = coveredAt(wrapper, document.elementsFromPoint(x, y), within);
      if (cover === "covered") return true;
      if (cover === "own") reached = true;
    }
    return !reached;
  } finally {
    wrapper.removeAttribute(ISLAND_PROBE_ATTRIBUTE);
  }
};

/**
 * Whether the wrapper or an ancestor is entering, leaving or moving. With
 * `riding`, the scroller a layered island is drawn inside, the walk stops
 * there: the island moves with that scroller and everything above it.
 */
export const inTransition = (
  wrapper: HTMLElement,
  isMoving: (element: Element) => boolean,
  riding?: Element,
): boolean => {
  for (
    let element: HTMLElement | null = wrapper.parentElement;
    element && element !== riding;
    element = element.parentElement
  ) {
    if (element.hasAttribute(ISLAND_PHASE_ATTRIBUTE) || isMoving(element)) return true;
  }
  return false;
};

export const handoffOf = (
  wrapper: HTMLElement,
  placement: NativePlacement,
  isMoving: (element: Element) => boolean,
  layered = false,
): NativeHandoff | undefined => {
  const riding = layered && placement.kind === "scroller" ? placement.scroller : undefined;
  let carried = false;
  if (placement.rect.width <= 0 || placement.rect.height <= 0) return "hidden";
  const boxes = boxElementsOf(wrapper);
  for (const box of boxes) {
    if (box === wrapper) continue;
    const style = getComputedStyle(box);
    if (!isTranslation(style.transform) || !isNone(style.scale) || !isNone(style.rotate)) {
      return "transformed";
    }
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
    if (isMoving(element)) return "moving";
    if (Number.parseFloat(style.opacity) < 1) return "faded";
    if (
      !isTranslation(style.transform) ||
      !isNone(style.scale) ||
      !isNone(style.rotate) ||
      !isNone(style.filter) ||
      !isNone(style.clipPath)
    ) {
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
      !contains(contentBoxOf(element), placement.rect)
    ) {
      return "clipped";
    }
  }
  return isCovered(wrapper, placement, riding) ? "covered" : undefined;
};
