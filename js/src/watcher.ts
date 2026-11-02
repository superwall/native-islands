import { ISLAND_PHASE_ATTRIBUTE, SIMULATOR_LAYER_ATTRIBUTE } from "./attributes";

const GEOMETRY = new Set([
  "all",
  "transform",
  "translate",
  "scale",
  "rotate",
  "opacity",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
  "width",
  "height",
  "clip-path",
  "filter",
  "offset-path",
  "offset-distance",
  "font-size",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "gap",
  "row-gap",
  "column-gap",
  "aspect-ratio",
  "border-width",
  "zoom",
]);

const GEOMETRY_PREFIXES = ["margin", "padding", "inset-", "min-", "max-", "flex", "grid"];

export const isGeometric = (property: string): boolean =>
  GEOMETRY.has(property) ||
  GEOMETRY_PREFIXES.some((prefix) => property.startsWith(prefix)) ||
  (property.startsWith("border-") && property.endsWith("-width"));

const KEYFRAME_META = new Set(["offset", "easing", "composite", "computedOffset"]);

const toCssName = (property: string) =>
  property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

export const animatesGeometry = (element: Element, animationName: string): boolean => {
  if (typeof element.getAnimations !== "function") return true;
  const animation = element
    .getAnimations()
    .find(
      (candidate) =>
        (candidate as Animation & { animationName?: string }).animationName === animationName,
    );
  const keyframes =
    animation?.effect && "getKeyframes" in animation.effect
      ? (animation.effect as KeyframeEffect).getKeyframes()
      : undefined;
  if (!keyframes) return true;
  return keyframes.some((frame) =>
    Object.keys(frame).some((key) => !KEYFRAME_META.has(key) && isGeometric(toCssName(key))),
  );
};

export type LayoutPass = "layout" | "frame";

export type LayoutWatcher = {
  subscribe: (listener: (pass: LayoutPass) => void) => () => void;
  refresh: () => void;
  isMoving: (element: Element) => boolean;
};

export const HOT_MS = 600;

export const LIVE_LAYOUT_EVERY = 3;

export const PRUNE_EVERY = 30;

const OBSERVED_ATTRIBUTES = [
  "class",
  "style",
  "hidden",
  "inert",
  "open",
  "dir",
  "src",
  "width",
  "height",
  ISLAND_PHASE_ATTRIBUTE,
];

const schedule = (callback: () => void) => {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
  else setTimeout(callback, 16);
};

const now = () => (typeof performance === "undefined" ? Date.now() : performance.now());

const isOwnMutation = (record: MutationRecord) =>
  record.target instanceof Element &&
  record.target.closest(`[${SIMULATOR_LAYER_ATTRIBUTE}]`) !== null;

const keyed = (map: WeakMap<Element, Set<string>>, target: Element) => {
  const keys = map.get(target) ?? new Set<string>();
  map.set(target, keys);
  return keys;
};

export const createLayoutWatcher = (document: Document): LayoutWatcher => {
  const listeners = new Set<(pass: LayoutPass) => void>();
  const moving = new WeakMap<Element, Set<string>>();
  const live = new Map<Element, Set<string>>();
  let layoutDue = false;
  let running = false;
  let hotUntil = 0;
  let frameCount = 0;
  let teardown: (() => void) | undefined;

  const emit = (pass: LayoutPass) => {
    for (const listener of listeners) listener(pass);
  };

  const prune = () => {
    for (const element of live.keys()) {
      const animating =
        element.isConnected &&
        (typeof element.getAnimations !== "function" ||
          element.getAnimations().some((animation) => animation.playState === "running"));
      if (!animating) live.delete(element);
    }
  };

  const tick = () => {
    if (listeners.size === 0) {
      running = false;
      return;
    }
    frameCount += 1;
    if (frameCount % PRUNE_EVERY === 0) prune();
    const layout = layoutDue || (live.size > 0 && frameCount % LIVE_LAYOUT_EVERY === 0);
    layoutDue = false;
    emit(layout ? "layout" : "frame");
    if (layoutDue || live.size > 0 || now() < hotUntil) schedule(tick);
    else running = false;
  };

  const wake = () => {
    if (running) return;
    running = true;
    schedule(tick);
  };

  const notify = () => {
    layoutDue = true;
    hotUntil = now() + HOT_MS;
    wake();
  };

  const heat = () => {
    hotUntil = now() + HOT_MS;
    wake();
  };

  const onTransitionRun = (event: Event) => {
    const { propertyName } = event as TransitionEvent;
    const { target } = event;
    if (!(target instanceof Element) || !isGeometric(propertyName)) return;
    keyed(moving, target).add(`transition:${propertyName}`);
    notify();
  };
  const onTransitionDone = (event: Event) => {
    const { target } = event;
    if (!(target instanceof Element)) return;
    moving.get(target)?.delete(`transition:${(event as TransitionEvent).propertyName}`);
    notify();
  };
  const onAnimationStart = (event: Event) => {
    const { animationName } = event as AnimationEvent;
    const { target } = event;
    if (!(target instanceof Element) || !animatesGeometry(target, animationName)) return;
    const names = live.get(target) ?? new Set<string>();
    names.add(animationName);
    live.set(target, names);
    notify();
  };
  const onAnimationDone = (event: Event) => {
    const { target } = event;
    if (!(target instanceof Element)) return;
    const names = live.get(target);
    names?.delete((event as AnimationEvent).animationName);
    if (names?.size === 0) live.delete(target);
    notify();
  };

  const start = () => {
    const capture = { capture: true, passive: true } as const;
    const events: Array<[string, (event: Event) => void]> = [
      ["transitionrun", onTransitionRun],
      ["transitionend", onTransitionDone],
      ["transitioncancel", onTransitionDone],
      ["animationstart", onAnimationStart],
      ["animationend", onAnimationDone],
      ["animationcancel", onAnimationDone],
      ["scroll", notify],
      ["load", notify],
      ["error", notify],
      ["pointerdown", heat],
      ["keydown", heat],
    ];
    for (const [name, handler] of events) document.addEventListener(name, handler, capture);
    const view = document.defaultView;
    view?.addEventListener("resize", notify);
    const observer =
      typeof MutationObserver === "function"
        ? new MutationObserver((records) => {
            if (records.some((record) => !isOwnMutation(record))) notify();
          })
        : undefined;
    observer?.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributeFilter: OBSERVED_ATTRIBUTES,
    });
    void document.fonts?.ready.then(notify);
    return () => {
      for (const [name, handler] of events) document.removeEventListener(name, handler, capture);
      view?.removeEventListener("resize", notify);
      observer?.disconnect();
      live.clear();
    };
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      teardown ??= start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          teardown?.();
          teardown = undefined;
        }
      };
    },
    refresh: notify,
    isMoving: (element) => (moving.get(element)?.size ?? 0) > 0,
  };
};

const watchers = new WeakMap<Document, LayoutWatcher>();

export const layoutWatcherFor = (document: Document): LayoutWatcher => {
  let watcher = watchers.get(document);
  if (!watcher) {
    watcher = createLayoutWatcher(document);
    watchers.set(document, watcher);
  }
  return watcher;
};
