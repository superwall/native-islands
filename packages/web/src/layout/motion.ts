import type { TNativeMotion, TNativeMotionKeyframe } from "../protocol/schemas";
import { isGeometric } from "./watcher";

export type Offset = { readonly x: number; readonly y: number };

export type Easing = readonly [number, number, number, number];

const LINEAR: Easing = [0, 0, 1, 1];

const NAMED_EASINGS: Readonly<Record<string, Easing>> = {
  linear: LINEAR,
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

/** A CSS easing as a cubic Bézier, or nothing for one Core Animation can't run, such as `steps()`. */
export const easingOf = (value: string | undefined): Easing | undefined => {
  const trimmed = (value ?? "linear").trim();
  const named = NAMED_EASINGS[trimmed];
  if (named) return named;
  const match = /^cubic-bezier\(([^)]*)\)$/.exec(trimmed);
  const numbers = match?.[1]?.split(",").map((part) => Number.parseFloat(part));
  if (numbers?.length !== 4 || !numbers.every(Number.isFinite)) return undefined;
  const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = numbers;
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return undefined;
  return [x1, y1, x2, y2];
};

const lengthOf = (value: string, size: number): number | undefined => {
  const match = /^(-?[\d.]+(?:e-?\d+)?)(px|%)?$/.exec(value.trim());
  if (!match?.[1]) return undefined;
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  if (match[2] === "%") return (amount / 100) * size;
  if (match[2] === undefined && amount !== 0) return undefined;
  return amount;
};

const IDENTITY_2D = [1, 0, 0, 1];
const IDENTITY_3D = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

const translationOfFunction = (
  name: string,
  args: readonly string[],
  box: { width: number; height: number },
): Offset | undefined => {
  const numbers = () => args.map((arg) => Number.parseFloat(arg));
  switch (name) {
    case "translateX": {
      const x = args.length === 1 && args[0] ? lengthOf(args[0], box.width) : undefined;
      return x === undefined ? undefined : { x, y: 0 };
    }
    case "translateY": {
      const y = args.length === 1 && args[0] ? lengthOf(args[0], box.height) : undefined;
      return y === undefined ? undefined : { x: 0, y };
    }
    case "translate":
    case "translate3d": {
      const [first, second = "0", third = "0"] = args;
      if (!first || args.length > (name === "translate" ? 2 : 3)) return undefined;
      const x = lengthOf(first, box.width);
      const y = lengthOf(second, box.height);
      if (x === undefined || y === undefined || lengthOf(third, 0) !== 0) return undefined;
      return { x, y };
    }
    case "matrix": {
      const values = numbers();
      if (values.length !== 6 || !IDENTITY_2D.every((value, index) => values[index] === value)) {
        return undefined;
      }
      const [, , , , x = 0, y = 0] = values;
      return { x, y };
    }
    case "matrix3d": {
      const values = numbers();
      if (values.length !== 16 || !IDENTITY_3D.every((value, index) => values[index] === value)) {
        return undefined;
      }
      if (values[14] !== 0 || values[15] !== 1) return undefined;
      const [, , , , , , , , , , , , x = 0, y = 0] = values;
      return { x, y };
    }
    default:
      return undefined;
  }
};

/**
 * The translation a CSS `transform` value amounts to, with percentages taken
 * of the element's border box, or nothing when it does more than translate.
 */
export const translationOf = (
  transform: string,
  box: { width: number; height: number },
): Offset | undefined => {
  const value = transform.trim();
  if (value === "" || value === "none") return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  let rest = value;
  const step = /^\s*([a-zA-Z0-9]+)\(([^)]*)\)\s*/;
  while (rest.length > 0) {
    const match = step.exec(rest);
    if (!match) return undefined;
    const offset = translationOfFunction(
      String(match[1]),
      String(match[2])
        .split(",")
        .map((arg) => arg.trim()),
      box,
    );
    if (!offset) return undefined;
    x += offset.x;
    y += offset.y;
    rest = rest.slice(match[0].length);
  }
  return { x, y };
};

/** A slide an element is running: the motion to send, and where it is in it now. */
export type Slide = {
  readonly motion: TNativeMotion;
  readonly current: Offset;
};

const KEYFRAME_META = new Set(["offset", "easing", "composite", "computedOffset"]);

const toCssName = (property: string) =>
  property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const isKeyframeEffect = (effect: AnimationEffect | null | undefined): effect is KeyframeEffect =>
  effect != null && "getKeyframes" in effect && typeof effect.getKeyframes === "function";

const animatedProperties = (frames: readonly ComputedKeyframe[]) =>
  new Set(
    frames.flatMap((frame) =>
      Object.keys(frame)
        .filter((key) => !KEYFRAME_META.has(key))
        .map(toCssName),
    ),
  );

const fillOf = (fill: string | undefined): TNativeMotion["fill"] =>
  fill === "forwards" || fill === "backwards" || fill === "both" ? fill : undefined;

const cache = new WeakMap<Animation, TNativeMotion | null>();

const motionOfAnimation = (
  animation: Animation,
  effect: KeyframeEffect,
  box: { width: number; height: number },
): TNativeMotion | undefined => {
  const timing = effect.getComputedTiming();
  const duration = Number(timing.duration);
  if (
    !(duration > 0) ||
    timing.iterations !== 1 ||
    (timing.direction !== undefined && timing.direction !== "normal") ||
    animation.playbackRate !== 1
  ) {
    return undefined;
  }
  const frames = effect.getKeyframes();
  const overall = easingOf(timing.easing);
  if (!overall) return undefined;
  const keyframes: TNativeMotionKeyframe[] = [];
  const easings: Easing[] = [];
  for (const frame of frames) {
    if (frame.transform === undefined || frame.transform === null) continue;
    const offset = frame.computedOffset;
    const at = translationOf(String(frame.transform), box);
    const easing = easingOf(frame.easing);
    if (at === undefined || easing === undefined || !Number.isFinite(offset)) return undefined;
    keyframes.push({ offset, x: at.x, y: at.y });
    easings.push(easing);
  }
  const [first] = keyframes;
  const [firstEasing] = easings;
  if (!first || !firstEasing) return undefined;
  // A CSS animation that leaves out its `from` or `to` keyframe runs from or
  // to the element's own transform, which a sliding page leaves at none.
  if (first.offset > 0) {
    keyframes.unshift({ offset: 0, x: 0, y: 0 });
    easings.unshift(firstEasing);
  }
  const last = keyframes.at(-1);
  if (last && last.offset < 1) keyframes.push({ offset: 1, x: 0, y: 0 });
  easings.length = keyframes.length - 1;
  if (keyframes.length > 16) return undefined;
  const linearSegments = easings.every((easing) => easing.every((v, i) => v === LINEAR[i]));
  if (overall !== LINEAR && overall.some((v, i) => v !== LINEAR[i])) {
    // The effect's own easing warps the whole timeline; Core Animation can
    // only take it as a single segment's curve.
    if (keyframes.length !== 2 || !linearSegments) return undefined;
    easings[0] = overall;
  }
  const delay = timing.delay ?? 0;
  const current = Number(animation.currentTime);
  const elapsed = (Number.isFinite(current) ? current : 0) - delay;
  const allLinear = easings.every((easing) => easing.every((v, i) => v === LINEAR[i]));
  const fill = fillOf(timing.fill);
  return {
    keyframes,
    ...(allLinear ? {} : { easings: easings.map(([x1, y1, x2, y2]) => [x1, y1, x2, y2] as const) }),
    duration,
    elapsed: Math.max(-10_000, Math.min(10_000, elapsed)),
    ...(fill ? { fill } : {}),
  };
};

/**
 * The slide an element is running, when it is one Core Animation can run on
 * a native view in step: a single running CSS animation or transition of
 * `transform` that only translates, once through, with Bézier easing, and
 * nothing else on the element moving its box. The motion is read once per
 * animation, so measuring again mid-slide sends the same one.
 */
export const slideOf = (element: Element): Slide | undefined => {
  if (typeof element.getAnimations !== "function" || !(element instanceof HTMLElement)) {
    return undefined;
  }
  const own = element.getAnimations().flatMap((animation) => {
    const { effect } = animation;
    return animation.playState === "running" &&
      isKeyframeEffect(effect) &&
      effect.target === element &&
      !effect.pseudoElement
      ? [{ animation, effect }]
      : [];
  });
  let found: { animation: Animation; effect: KeyframeEffect } | undefined;
  for (const { animation, effect } of own) {
    const properties = animatedProperties(effect.getKeyframes());
    if (properties.has("transform")) {
      if (found || properties.size > 1) return undefined;
      found = { animation, effect };
    } else if ([...properties].some(isGeometric)) {
      return undefined;
    }
  }
  if (!found) return undefined;
  const box = { width: element.offsetWidth, height: element.offsetHeight };
  const current = translationOf(getComputedStyle(element).transform, box);
  if (!current) return undefined;
  let motion = cache.get(found.animation);
  if (motion === undefined) {
    motion = motionOfAnimation(found.animation, found.effect, box) ?? null;
    cache.set(found.animation, motion);
  }
  return motion ? { motion, current } : undefined;
};

const ELAPSED_SLACK_MS = 34;

/** Whether two slides share one timeline, so one can be expressed relative to the other. */
export const inStep = (left: TNativeMotion, right: TNativeMotion): boolean =>
  left.keyframes.length === right.keyframes.length &&
  left.keyframes.every((frame, index) => frame.offset === right.keyframes[index]?.offset) &&
  JSON.stringify(left.easings) === JSON.stringify(right.easings) &&
  Math.abs(left.duration - right.duration) < 1 &&
  Math.abs(left.elapsed - right.elapsed) < ELAPSED_SLACK_MS;

const zIndexOf = (element: Element) => {
  const value = Number.parseInt(getComputedStyle(element).zIndex, 10);
  return Number.isFinite(value) ? value : 0;
};

/** Whether `other`, a sibling of `element`, paints above it. */
const paintsAbove = (other: Element, element: Element) => {
  const difference = zIndexOf(other) - zIndexOf(element);
  if (difference !== 0) return difference > 0;
  return Boolean(element.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING);
};

const overlaps = (left: Element, right: Element) => {
  const a = left.getBoundingClientRect();
  const b = right.getBoundingClientRect();
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
};

/**
 * The siblings of a sliding element that paint above it and slide in step
 * with it, such as the next page coming in over the one going under. Nothing
 * when a sibling above it slides out of step, since then the native view
 * could not be cut where it is covered. An inert page can't be hit-tested
 * for what covers it, so for one a still sibling over it counts as nothing
 * too.
 */
export const coversOf = (
  element: Element,
  slide: Slide,
): readonly { element: Element; slide: Slide }[] | undefined => {
  const covers: { element: Element; slide: Slide }[] = [];
  const inert = element.hasAttribute("inert");
  for (const sibling of element.parentElement?.children ?? []) {
    if (sibling === element || !paintsAbove(sibling, element)) continue;
    const moving =
      typeof sibling.getAnimations === "function" &&
      sibling.getAnimations().some((animation) => animation.playState === "running");
    if (!moving) {
      if (inert && overlaps(sibling, element)) return undefined;
      continue;
    }
    const other = slideOf(sibling);
    if (!other || !inStep(other.motion, slide.motion)) return undefined;
    covers.push({ element: sibling, slide: other });
  }
  return covers;
};
