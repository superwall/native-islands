import { ISLAND_PHASE_ATTRIBUTE, ISLAND_PROBE_ATTRIBUTE } from "./attributes";
import type { TNativeFrame } from "../protocol/schemas";
import {
  boxElementsOf,
  containsAbsolute,
  containsFixed,
  contentBoxOf,
  type NativePlacement,
} from "./measure";

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

type Matrix =
  | { kind: "2d"; values: readonly [number, number, number, number, number, number] }
  | { kind: "3d"; values: readonly number[] };

const isNone = (value: string | undefined): value is undefined | "" | "none" =>
  value === undefined || value === "" || value === "none";

const numbersIn = (list: string, separator: RegExp): number[] | undefined => {
  const values = list
    .split(separator)
    .filter(Boolean)
    .map((value) => Number.parseFloat(value));
  return values.every(Number.isFinite) ? values : undefined;
};

const isSixValues = (
  values: number[],
): values is [number, number, number, number, number, number] => values.length === 6;

const matrixOf = (transform: string): Matrix | undefined => {
  const match = /^matrix(3d)?\((.*)\)$/.exec(transform.trim());
  const values = match?.[2] === undefined ? undefined : numbersIn(match[2], /\s*,\s*/);
  if (!values) return undefined;
  if (match?.[1]) return values.length === 16 ? { kind: "3d", values } : undefined;
  return isSixValues(values) ? { kind: "2d", values } : undefined;
};

const IDENTITY_3D_LINEAR = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

export const isTranslation = (transform: string): boolean => {
  if (isNone(transform)) return true;
  const matrix = matrixOf(transform);
  if (!matrix) return false;
  if (matrix.kind === "3d") {
    return (
      IDENTITY_3D_LINEAR.every((value, index) => matrix.values[index] === value) &&
      matrix.values[15] === 1
    );
  }
  const [a, b, c, d] = matrix.values;
  return a === 1 && b === 0 && c === 0 && d === 1;
};

export const isEvenScale = (transform: string): boolean => {
  if (isTranslation(transform)) return true;
  const matrix = matrixOf(transform);
  if (matrix?.kind !== "2d") return false;
  const [a, b, c, d] = matrix.values;
  return a > 0 && a === d && b === 0 && c === 0;
};

const isEvenScaleProperty = (scale: string | undefined) => {
  if (isNone(scale)) return true;
  const [first, ...rest] = scale.trim().split(/\s+/);
  return (
    first !== undefined &&
    rest.length <= 1 &&
    rest.every((part) => part === first) &&
    Number.parseFloat(first) > 0
  );
};

export type Linear = readonly [number, number, number, number];

export const IDENTITY: Linear = [1, 0, 0, 1];

export const multiply = (outer: Linear, inner: Linear): Linear => [
  outer[0] * inner[0] + outer[2] * inner[1],
  outer[1] * inner[0] + outer[3] * inner[1],
  outer[0] * inner[2] + outer[2] * inner[3],
  outer[1] * inner[2] + outer[3] * inner[3],
];

export const isIdentity = (linear: Linear, epsilon = 1e-4) =>
  linear.every((value, index) => Math.abs(value - (index % 3 === 0 ? 1 : 0)) < epsilon);

const ANGLE_UNITS = {
  deg: Math.PI / 180,
  rad: 1,
  turn: Math.PI * 2,
  grad: Math.PI / 200,
} as const satisfies Record<string, number>;

const isAngleUnit = (unit: string): unit is keyof typeof ANGLE_UNITS => unit in ANGLE_UNITS;

const angleOf = (value: string): number | undefined => {
  const match = /^(-?[\d.]+(?:e-?\d+)?)([a-z]+)$/.exec(value);
  const [, amount, unit] = match ?? [];
  if (amount === undefined || unit === undefined || !isAngleUnit(unit)) return undefined;
  return Number.parseFloat(amount) * ANGLE_UNITS[unit];
};

const FLAT_3D_ZEROES = [2, 3, 6, 7, 8, 9, 11, 14];

const linearOfTransform = (transform: string): Linear | undefined => {
  if (isNone(transform)) return IDENTITY;
  const matrix = matrixOf(transform);
  if (!matrix) return undefined;
  if (matrix.kind === "2d") {
    const [a, b, c, d] = matrix.values;
    return [a, b, c, d];
  }
  const { values } = matrix;
  const flat = FLAT_3D_ZEROES.every((index) => values[index] === 0);
  if (!flat || values[10] !== 1 || values[15] !== 1) return undefined;
  const [a = 1, b = 0, , , c = 0, d = 1] = values;
  return [a, b, c, d];
};

const linearOfRotate = (rotate: string | undefined): Linear | undefined => {
  if (isNone(rotate)) return IDENTITY;
  const parts = rotate.trim().split(/\s+/);
  const angle = angleOf(rotate.trim().replace(/^.*\s/, ""));
  if (angle === undefined) return undefined;
  const axis = parts.slice(0, -1);
  if (axis.length === 1 && axis[0] !== "z") return undefined;
  if (axis.length === 3 && !(axis[0] === "0" && axis[1] === "0" && Number(axis[2]) > 0)) {
    return undefined;
  }
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cos, sin, -sin, cos];
};

const linearOfScale = (scale: string | undefined): Linear | undefined => {
  if (isNone(scale)) return IDENTITY;
  const [x, y = x, z = 1] = numbersIn(scale.trim(), /\s+/) ?? [];
  if (x === undefined || y === undefined || z !== 1) return undefined;
  return [x, 0, 0, y];
};

export const linearOf = (style: CSSStyleDeclaration): Linear | undefined => {
  const rotate = linearOfRotate(style.rotate);
  const scale = linearOfScale(style.scale);
  const transform = linearOfTransform(style.transform);
  if (!rotate || !scale || !transform) return undefined;
  return multiply(multiply(rotate, scale), transform);
};

const opacityOf = (style: CSSStyleDeclaration) => {
  const value = Number.parseFloat(style.opacity);
  return Number.isFinite(value) ? value : 1;
};

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

export type NativeShade = TNativeFrame & { color: string };

type Rgba = readonly [number, number, number, number];

const channelsOf = (list: string, scale: number): Rgba | undefined => {
  const [red, green, blue, alpha = 1, ...rest] = numbersIn(list, /[\s,/]+/) ?? [];
  if (red === undefined || green === undefined || blue === undefined || rest.length > 0) {
    return undefined;
  }
  return [red * scale, green * scale, blue * scale, alpha];
};

const parseAlphaColor = (value: string): Rgba | undefined => {
  const trimmed = value.trim();
  const inside = trimmed.slice(trimmed.indexOf("(") + 1, -1);
  if (/^rgba?\([^)]*\)$/.test(trimmed)) return channelsOf(inside, 1);
  if (/^color\(srgb [^)]*\)$/.test(trimmed)) return channelsOf(inside.slice("srgb ".length), 255);
  return undefined;
};

const toByte = (value: number) => Math.round(Math.min(255, Math.max(0, value)));

export const shadeOf = (element: Element): string | undefined => {
  const style = getComputedStyle(element);
  if (!isNone(style.backdropFilter) || !isNone(style.backgroundImage)) return undefined;
  const color = parseAlphaColor(style.backgroundColor);
  if (!color) return undefined;
  const [red, green, blue, fill] = color;
  if (fill <= 0 || fill >= 1) return undefined;
  const faded = Number.parseFloat(style.opacity);
  const alpha = fill * (Number.isFinite(faded) ? Math.min(1, Math.max(0, faded)) : 1);
  if (alpha <= 0) return undefined;
  return `rgba(${toByte(red)}, ${toByte(green)}, ${toByte(blue)}, ${Number(alpha.toFixed(3))})`;
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
      const top = stack.find((element) => !wrapper.contains(element) && !element.contains(wrapper));
      if (!top || seen.has(top)) continue;
      seen.add(top);
      const rect = top.getBoundingClientRect();
      const covered = intersect(
        { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        sampled,
      );
      if (!covered) continue;
      const color = shadeOf(top);
      if (color) cover.shades.push({ ...covered, color });
      else cover.holes.push(covered);
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
  clip?: boolean;
  transform?: boolean;
  isRevealing?: (element: Element) => boolean;
  out?: {
    clip?: TNativeFrame;
    holes?: TNativeFrame[];
    shades?: NativeShade[];
    revealing?: boolean;
    transform?: Linear;
    opacity?: number;
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
  const turns = options.transform === true;
  const follows = (style: CSSStyleDeclaration) =>
    clips
      ? isEvenScale(style.transform) && isEvenScaleProperty(style.scale) && isNone(style.rotate)
      : isTranslation(style.transform) && isNone(style.scale) && isNone(style.rotate);
  if (placement.rect.width <= 0 || placement.rect.height <= 0) return "hidden";
  const boxes = boxElementsOf(wrapper);
  let linear: Linear = IDENTITY;
  let opacity = 1;
  for (const box of boxes) {
    if (box === wrapper) continue;
    const style = getComputedStyle(box);
    if (turns) {
      const own = linearOf(style);
      if (!own) return "transformed";
      if (!isIdentity(own)) {
        if (boxes.length > 1) return "transformed";
        linear = own;
      }
      // The box's own opacity is the web copy's look, such as a dimmed
      // disabled button; the native view draws its own.
      continue;
    }
    if (!follows(style)) return "transformed";
  }
  const [first] = boxes;
  if (!first) return "hidden";
  const firstPosition = getComputedStyle(first).position;
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
    if (turns) {
      opacity *= opacityOf(style);
      const own = linearOf(style);
      if (!own || !isNone(style.filter) || !isNone(style.clipPath)) return "transformed";
      if (!isIdentity(own)) linear = multiply(own, linear);
    } else {
      if (Number.parseFloat(style.opacity) < 1) return "faded";
      if (!follows(style) || !isNone(style.filter) || !isNone(style.clipPath)) {
        return "transformed";
      }
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
      visible = shown;
    }
  }
  const turned = !isIdentity(linear);
  if (turned && visible !== placement.rect) return "clipped";
  if (options.out) {
    if (turned) options.out.transform = linear;
    if (opacity < 1) options.out.opacity = Math.max(0, opacity);
  }
  if (visible !== placement.rect && options.out) options.out.clip = visible;
  const cover = clips && options.out && !turned ? { holes: [], shades: [] } : undefined;
  const covered = sampleCover(wrapper, { ...placement, rect: visible }, riding, cover);
  if (cover && options.out) {
    if (cover.holes.length > 0) options.out.holes = cover.holes;
    if (cover.shades.length > 0) options.out.shades = cover.shades;
  }
  return covered ? "covered" : undefined;
};
