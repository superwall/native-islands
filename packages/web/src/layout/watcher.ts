import {
  ISLAND_PHASE_ATTRIBUTE,
  SHOWN_ISLAND_SELECTOR,
  SIMULATOR_LAYER_ATTRIBUTE,
} from "./attributes";

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

const isKeyframeEffect = (effect: AnimationEffect | null | undefined): effect is KeyframeEffect =>
  effect != null && "getKeyframes" in effect && typeof effect.getKeyframes === "function";

export const animatesGeometry = (element: Element, animationName: string): boolean => {
  if (typeof element.getAnimations !== "function") return true;
  const animation = element
    .getAnimations()
    .find((candidate) => "animationName" in candidate && candidate.animationName === animationName);
  const keyframes = isKeyframeEffect(animation?.effect)
    ? animation.effect.getKeyframes()
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
  isRevealing: (element: Element) => boolean;
  quietly: <T>(measure: () => T) => T;
};

const REVEALING = new Set(
  ["height", "width", "max-height", "max-width"].map((p) => `transition:${p}`),
);

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

// Inside the hidden web version of an island whose native view shows: the
// island styles stop its animations, and it moves nothing the page shows.
// The island's own box still counts, since it carries the native view.
const inShownIsland = (element: Element) =>
  element.parentElement?.closest(SHOWN_ISLAND_SELECTOR) != null;

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
  let observer: MutationObserver | undefined;

  const emit = (pass: LayoutPass) => {
    for (const listener of listeners) listener(pass);
  };

  const prune = () => {
    for (const element of live.keys()) {
      const animating =
        element.isConnected &&
        !inShownIsland(element) &&
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

  const onTransitionRun = ({ target, propertyName }: TransitionEvent) => {
    if (!(target instanceof Element) || !isGeometric(propertyName)) return;
    keyed(moving, target).add(`transition:${propertyName}`);
    notify();
  };
  const onTransitionDone = ({ target, propertyName }: TransitionEvent) => {
    if (!(target instanceof Element)) return;
    moving.get(target)?.delete(`transition:${propertyName}`);
    notify();
  };
  const onAnimationStart = ({ target, animationName }: AnimationEvent) => {
    if (
      !(target instanceof Element) ||
      inShownIsland(target) ||
      !animatesGeometry(target, animationName)
    )
      return;
    const names = live.get(target) ?? new Set<string>();
    names.add(animationName);
    live.set(target, names);
    notify();
  };
  const onAnimationDone = ({ target, animationName }: AnimationEvent) => {
    if (!(target instanceof Element)) return;
    const names = live.get(target);
    names?.delete(animationName);
    if (names?.size === 0) live.delete(target);
    notify();
  };

  const start = () => {
    const capture = { capture: true, passive: true } as const;
    const listen = <K extends keyof DocumentEventMap>(
      name: K,
      handler: (event: DocumentEventMap[K]) => void,
    ) => {
      document.addEventListener(name, handler, capture);
      return () => document.removeEventListener(name, handler, capture);
    };
    const unlisten = [
      listen("transitionrun", onTransitionRun),
      listen("transitionend", onTransitionDone),
      listen("transitioncancel", onTransitionDone),
      listen("animationstart", onAnimationStart),
      listen("animationend", onAnimationDone),
      listen("animationcancel", onAnimationDone),
      listen("scroll", notify),
      listen("load", notify),
      listen("error", notify),
      listen("pointerdown", heat),
      listen("keydown", heat),
    ];
    const view = document.defaultView;
    view?.addEventListener("resize", notify);
    observer =
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
      for (const stop of unlisten) stop();
      view?.removeEventListener("resize", notify);
      observer?.disconnect();
      observer = undefined;
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
    isRevealing: (element) => {
      const keys = moving.get(element);
      return keys !== undefined && keys.size > 0 && [...keys].every((key) => REVEALING.has(key));
    },
    quietly: (measure) => {
      const earlier = observer?.takeRecords() ?? [];
      try {
        return measure();
      } finally {
        observer?.takeRecords();
        if (earlier.some((record) => !isOwnMutation(record))) notify();
      }
    },
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
