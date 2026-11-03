/**
 * How many islands the perf page renders: `?count=<n>`, 10 by default, and
 * none unless it was opened with `?route=perf`, so other runs don't pay for them.
 */
export const perfCount = (search: string): number => {
  if (new URLSearchParams(search).get("route") !== "perf") return 0;
  const count = Number(new URLSearchParams(search).get("count"));
  return Number.isInteger(count) && count > 0 && count <= 500 ? count : 10;
};

type FrameTimer = { start: () => void; stop: () => number };

/**
 * Times every animation-frame callback while measuring, which is where the
 * islands' layout passes run. Installed before the page renders, so the
 * library's own callbacks go through it.
 */
export const installFrameTimer = (target: Window = window): FrameTimer => {
  const original = target.requestAnimationFrame.bind(target);
  let measuring = false;
  let spent = 0;
  target.requestAnimationFrame = (callback) =>
    original((time) => {
      if (!measuring) return callback(time);
      const begin = performance.now();
      try {
        callback(time);
      } finally {
        spent += performance.now() - begin;
      }
    });
  return {
    start: () => {
      spent = 0;
      measuring = true;
    },
    stop: () => {
      measuring = false;
      return spent;
    },
  };
};

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

/** Scrolls `scroller` from top to bottom and back over `ms`, one step a frame. */
export const sweep = async (scroller: HTMLElement, ms = 1600) => {
  const range = scroller.scrollHeight - scroller.clientHeight;
  const begin = await nextFrame();
  for (;;) {
    const now = await nextFrame();
    const t = Math.min(1, (now - begin) / ms);
    scroller.scrollTop = range * (t < 0.5 ? t * 2 : 2 - t * 2);
    if (t >= 1) break;
  }
};

/**
 * Forces `passes` layout passes by nudging `element`'s padding, and returns
 * the mean JS time each spent in animation-frame callbacks, in ms. A mean,
 * since WebKit rounds `performance.now()` to whole milliseconds.
 */
export const measureLayout = async (element: HTMLElement, timer: FrameTimer, passes = 21) => {
  const costs: number[] = [];
  for (let pass = 0; pass < passes; pass += 1) {
    await nextFrame();
    timer.start();
    element.style.paddingTop = `${pass % 2}px`;
    await nextFrame();
    await nextFrame();
    costs.push(timer.stop());
  }
  element.style.paddingTop = "";
  return costs.length === 0 ? 0 : costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
};
