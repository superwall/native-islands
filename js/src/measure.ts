import type { TNativeAnchor, TNativeFrame } from "./schemas";

export type NativeAnchorKind = "page" | "scroller" | "screen" | "tracked";

export type NativePlacement = {
  kind: NativeAnchorKind;
  at: NativeAnchorOf;
  frame: TNativeFrame;
  anchor: TNativeAnchor;
  rect: TNativeFrame;
  scroller?: HTMLElement;
};

export const boxElementsOf = (wrapper: HTMLElement): HTMLElement[] => {
  if (getComputedStyle(wrapper).display !== "contents") return [wrapper];
  return Array.from(wrapper.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
};

export const unionRect = (elements: readonly Element[]): TNativeFrame | undefined => {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }
  if (!Number.isFinite(left)) return undefined;
  return { x: left, y: top, width: right - left, height: bottom - top };
};

const SCROLLING = /auto|scroll/;

export const isScroller = (element: Element): boolean => {
  const style = getComputedStyle(element);
  return (
    (SCROLLING.test(style.overflowY) && element.scrollHeight > element.clientHeight) ||
    (SCROLLING.test(style.overflowX) && element.scrollWidth > element.clientWidth)
  );
};

export type NativeAnchorOf =
  | { kind: "scroller"; scroller: HTMLElement }
  | { kind: Exclude<NativeAnchorKind, "scroller"> };

const isNone = (value: string | undefined) =>
  value === undefined || value === "" || value === "none" || value === "auto";

export const containsFixed = (style: CSSStyleDeclaration): boolean =>
  !isNone(style.transform) ||
  !isNone(style.filter) ||
  !isNone(style.perspective) ||
  /transform|filter|perspective/.test(style.willChange ?? "") ||
  /paint|layout|strict|content/.test(style.contain ?? "");

export const containsAbsolute = (style: CSSStyleDeclaration): boolean =>
  (style.position !== "static" && style.position !== "") || containsFixed(style);

export const anchorOf = (start: Element): NativeAnchorOf => {
  const { body, documentElement } = start.ownerDocument;
  let pending: "absolute" | "fixed" | undefined;
  for (
    let element: Element | null = start;
    element && element !== body && element !== documentElement;
    element = element.parentElement
  ) {
    const style = getComputedStyle(element);
    if (element !== start && pending) {
      const contains = pending === "fixed" ? containsFixed(style) : containsAbsolute(style);
      if (!contains) continue;
      pending = undefined;
    }
    if (style.position === "sticky") return { kind: "tracked" };
    if (element !== start && element instanceof HTMLElement && isScroller(element)) {
      return { kind: "scroller", scroller: element };
    }
    if (style.position === "fixed") pending = "fixed";
    else if (style.position === "absolute") pending = "absolute";
  }
  return pending === "fixed" ? { kind: "screen" } : { kind: "page" };
};

const scrollerIds = new WeakMap<Element, string>();
let nextScroller = 0;

export const scrollerIdOf = (element: Element): string => {
  let id = scrollerIds.get(element);
  if (id === undefined) {
    nextScroller += 1;
    id = `scroller-${nextScroller}`;
    scrollerIds.set(element, id);
  }
  return id;
};

export const scaleOf = (element: HTMLElement): { x: number; y: number } => {
  const rect = element.getBoundingClientRect();
  return {
    x: element.offsetWidth > 0 && rect.width > 0 ? rect.width / element.offsetWidth : 1,
    y: element.offsetHeight > 0 && rect.height > 0 ? rect.height / element.offsetHeight : 1,
  };
};

export const contentBoxOf = (scroller: HTMLElement): TNativeFrame => {
  const rect = scroller.getBoundingClientRect();
  const scale = scaleOf(scroller);
  return {
    x: rect.left + scroller.clientLeft * scale.x,
    y: rect.top + scroller.clientTop * scale.y,
    width: scroller.clientWidth * scale.x,
    height: scroller.clientHeight * scale.y,
  };
};

export const scrollOffsetOf = (scroller: HTMLElement): { x: number; y: number } => {
  const style = getComputedStyle(scroller);
  const flex = style.display.includes("flex");
  const flipX = (style.direction === "rtl") !== (flex && style.flexDirection === "row-reverse");
  const flipY = flex && style.flexDirection === "column-reverse";
  return {
    x: flipX
      ? scroller.scrollLeft + scroller.scrollWidth - scroller.clientWidth
      : scroller.scrollLeft,
    y: flipY
      ? scroller.scrollTop + scroller.scrollHeight - scroller.clientHeight
      : scroller.scrollTop,
  };
};

export const frameIn = (
  anchor: NativeAnchorOf,
  rect: TNativeFrame,
  document: Document,
): TNativeFrame => {
  if (anchor.kind === "scroller") {
    const box = contentBoxOf(anchor.scroller);
    const offset = scrollOffsetOf(anchor.scroller);
    const scale = scaleOf(anchor.scroller);
    return {
      x: (rect.x - box.x) / scale.x + offset.x,
      y: (rect.y - box.y) / scale.y + offset.y,
      width: rect.width / scale.x,
      height: rect.height / scale.y,
    };
  }
  if (anchor.kind === "page") {
    const view = document.defaultView;
    return {
      x: rect.x + (view?.scrollX ?? 0),
      y: rect.y + (view?.scrollY ?? 0),
      width: rect.width,
      height: rect.height,
    };
  }
  return rect;
};

export const placementOf = (wrapper: HTMLElement): NativePlacement | undefined => {
  const boxes = boxElementsOf(wrapper);
  const rect = unionRect(boxes);
  if (!rect) return undefined;
  const found = anchorOf(boxes[0] as HTMLElement);
  if (found.kind === "screen" || found.kind === "tracked") {
    return { kind: found.kind, at: found, rect, frame: rect, anchor: { type: "screen" } };
  }
  if (found.kind === "scroller") {
    const { scroller } = found;
    const box = contentBoxOf(scroller);
    const offset = scrollOffsetOf(scroller);
    return {
      kind: "scroller",
      at: found,
      rect,
      scroller,
      frame: frameIn(found, rect, wrapper.ownerDocument),
      anchor: {
        type: "scroller",
        scroller: {
          id: scrollerIdOf(scroller),
          frame: box,
          content_size: { width: scroller.scrollWidth, height: scroller.scrollHeight },
          scroll_offset: offset,
        },
      },
    };
  }
  return {
    kind: "page",
    at: found,
    rect,
    frame: frameIn(found, rect, wrapper.ownerDocument),
    anchor: { type: "page" },
  };
};

export const sameAnchor = (left: TNativeAnchor, right: TNativeAnchor): boolean => {
  if (left.type !== right.type) return false;
  if (left.type !== "scroller" || right.type !== "scroller") return true;
  return left.scroller.id === right.scroller.id;
};
