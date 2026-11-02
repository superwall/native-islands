import type { TNativeAnchor, TNativeFrame, TNativeSticky } from "./schemas";
import { layoutWatcherFor } from "./watcher";

export type NativeAnchorKind = "page" | "scroller" | "screen" | "tracked";

export type NativePlacement = {
  kind: NativeAnchorKind;
  at: NativeAnchorOf;
  frame: TNativeFrame;
  anchor: TNativeAnchor;
  rect: TNativeFrame;
  scroller?: HTMLElement;
  /** For an island in a sticky box the host keeps stuck: that box, in content coordinates. */
  sticky?: TNativeSticky;
};

export type PlacementOptions = {
  /** Whether the host keeps sticky boxes in a scroller stuck itself. Default: `false`. */
  sticky?: boolean;
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
  | { kind: "scroller"; scroller: HTMLElement; sticky?: HTMLElement }
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

export const anchorOf = (start: Element, options: PlacementOptions = {}): NativeAnchorOf => {
  const { body, documentElement } = start.ownerDocument;
  let pending: "absolute" | "fixed" | undefined;
  let sticky: HTMLElement | undefined;
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
    if (style.position === "sticky" && !sticky) {
      if (!options.sticky || !(element instanceof HTMLElement)) return { kind: "tracked" };
      sticky = element;
      continue;
    }
    if (element !== start && element instanceof HTMLElement && isScroller(element)) {
      return sticky
        ? { kind: "scroller", scroller: element, sticky }
        : { kind: "scroller", scroller: element };
    }
    if (style.position === "fixed") pending = "fixed";
    else if (style.position === "absolute") pending = "absolute";
  }
  if (sticky) return { kind: "tracked" };
  return pending === "fixed" ? { kind: "screen" } : { kind: "page" };
};

const pixels = (value: string): number | undefined =>
  value.endsWith("px") ? Number.parseFloat(value) : undefined;

/**
 * How far a sticky box sits from where it would be unstuck, for a scroller
 * scrolled to `offset` that shows `height` pixels of its content. The host
 * runs the same rule on every scroll.
 */
export const stickyShift = (sticky: TNativeSticky, offset: number, height: number): number => {
  let y = sticky.box.y;
  if (sticky.bottom !== undefined) {
    y = Math.min(y, Math.max(offset + height - sticky.bottom - sticky.box.height, sticky.bounds.y));
  }
  if (sticky.top !== undefined) {
    y = Math.max(
      y,
      Math.min(offset + sticky.top, sticky.bounds.y + sticky.bounds.height - sticky.box.height),
    );
  }
  return y - sticky.box.y;
};

/**
 * Measures the island and its sticky box where they sit unstuck, by laying the
 * box out as `static` for the length of one measurement. Nothing paints in
 * between, and the layout watcher forgets the change.
 */
export const unstuckOf = (
  at: Extract<NativeAnchorOf, { kind: "scroller" }> & { sticky: HTMLElement },
  boxes: readonly Element[],
): { rect: TNativeFrame; sticky: TNativeSticky } | undefined => {
  const { sticky: element } = at;
  const document = element.ownerDocument;
  const parent = element.parentElement;
  if (!parent) return undefined;
  const style = getComputedStyle(element);
  const top = pixels(style.top);
  const bottom = pixels(style.bottom);
  if (top === undefined && bottom === undefined) return undefined;
  const marginTop = Number.parseFloat(style.marginTop) || 0;
  const marginBottom = Number.parseFloat(style.marginBottom) || 0;
  return layoutWatcherFor(document).quietly(() => {
    const hadStyle = element.hasAttribute("style");
    const previous = element.style.getPropertyValue("position");
    const priority = element.style.getPropertyPriority("position");
    element.style.setProperty("position", "static", "important");
    try {
      const rect = unionRect(boxes);
      if (!rect) return undefined;
      const box = element.getBoundingClientRect();
      const outer = parent.getBoundingClientRect();
      const parentStyle = getComputedStyle(parent);
      const inset = (side: "Top" | "Bottom" | "Left" | "Right") =>
        (Number.parseFloat(parentStyle[`border${side}Width`]) || 0) +
        (Number.parseFloat(parentStyle[`padding${side}`]) || 0);
      const content = {
        x: outer.left + inset("Left"),
        y: outer.top + inset("Top") + marginTop,
        width: Math.max(0, outer.width - inset("Left") - inset("Right")),
        height: Math.max(
          0,
          outer.height - inset("Top") - inset("Bottom") - marginTop - marginBottom,
        ),
      };
      return {
        rect,
        sticky: {
          ...(top === undefined ? {} : { top }),
          ...(bottom === undefined ? {} : { bottom }),
          box: frameIn(
            at,
            { x: box.left, y: box.top, width: box.width, height: box.height },
            document,
          ),
          bounds: frameIn(at, content, document),
        },
      };
    } finally {
      if (previous) element.style.setProperty("position", previous, priority);
      else element.style.removeProperty("position");
      if (!hadStyle) element.removeAttribute("style");
    }
  });
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

export const placementOf = (
  wrapper: HTMLElement,
  options: PlacementOptions = {},
): NativePlacement | undefined => {
  const boxes = boxElementsOf(wrapper);
  const [first] = boxes;
  const rect = unionRect(boxes);
  if (!first || !rect) return undefined;
  let found = anchorOf(first, options);
  let unstuck: ReturnType<typeof unstuckOf>;
  if (found.kind === "scroller" && found.sticky) {
    unstuck = unstuckOf({ ...found, sticky: found.sticky }, boxes);
    if (!unstuck) found = { kind: "tracked" };
  }
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
      frame: frameIn(found, unstuck?.rect ?? rect, wrapper.ownerDocument),
      ...(unstuck ? { sticky: unstuck.sticky } : {}),
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
