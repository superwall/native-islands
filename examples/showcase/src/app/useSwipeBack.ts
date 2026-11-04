import * as React from "react";
import { ISLAND_PHASE_ATTRIBUTE } from "native-islands";
import { belowOffset, completesSwipe, lockAxis, startsSwipe, swipeProgress } from "./swipe";

const SETTLE_MS = 320;

type Drag = {
  startX: number;
  startY: number;
  axis?: "x" | "y";
  top?: HTMLElement;
  below?: HTMLElement;
  lastX: number;
  lastTime: number;
  velocity: number;
};

const place = (top: HTMLElement, below: HTMLElement | undefined, progress: number) => {
  const width = top.clientWidth;
  top.style.transform = `translateX(${progress * width}px)`;
  if (below) below.style.transform = `translateX(${belowOffset(progress) * width}px)`;
};

const release = (element: HTMLElement | undefined) => {
  if (!element) return;
  element.style.transform = "";
  element.style.transition = "";
  element.removeAttribute(ISLAND_PHASE_ATTRIBUTE);
  element.removeAttribute("data-swiping");
};

/**
 * Swipe back from the left edge, as in a navigation controller: the screen on
 * top follows the finger with the one below sliding in behind it, and letting
 * go either finishes the pop or puts both back. Both screens carry the island
 * phase while they move, so their islands ride along with them.
 */
export const useSwipeBack = (
  root: React.RefObject<HTMLElement | null>,
  canGoBack: boolean,
  onBack: () => void,
): void => {
  const latest = React.useRef({ canGoBack, onBack });
  latest.current = { canGoBack, onBack };

  React.useEffect(() => {
    const element = root.current;
    if (!element) return;
    let drag: Drag | undefined;

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (event.touches.length !== 1 || !touch) return;
      if (!startsSwipe(touch.clientX, latest.current.canGoBack)) return;
      drag = {
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastTime: event.timeStamp,
        velocity: 0,
      };
    };

    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!drag || !touch) return;
      const dx = touch.clientX - drag.startX;
      if (!drag.axis) {
        drag.axis = lockAxis(dx, touch.clientY - drag.startY);
        if (drag.axis === "y") drag = undefined;
        if (drag?.axis !== "x") return;
        drag.top = element.querySelector<HTMLElement>('.screen[data-place="top"]') ?? undefined;
        drag.below = element.querySelector<HTMLElement>('.screen[data-place="below"]') ?? undefined;
        for (const screen of [drag.top, drag.below]) {
          screen?.setAttribute(ISLAND_PHASE_ATTRIBUTE, "swipe");
          screen?.setAttribute("data-swiping", "");
          if (screen) screen.style.transition = "none";
        }
      }
      if (!drag.top) return;
      event.preventDefault();
      const elapsed = event.timeStamp - drag.lastTime;
      if (elapsed > 0) drag.velocity = (touch.clientX - drag.lastX) / elapsed;
      drag.lastX = touch.clientX;
      drag.lastTime = event.timeStamp;
      place(drag.top, drag.below, swipeProgress(dx, drag.top.clientWidth));
    };

    const onEnd = () => {
      const current = drag;
      drag = undefined;
      const { top, below } = current ?? {};
      if (!current || !top) return;
      const progress = swipeProgress(current.lastX - current.startX, top.clientWidth);
      const completes = completesSwipe(progress, current.velocity);
      for (const screen of [top, below]) {
        if (screen) screen.style.transition = `transform ${SETTLE_MS}ms var(--ease-push)`;
      }
      place(top, below, completes ? 1 : 0);
      window.setTimeout(() => {
        if (completes) {
          latest.current.onBack();
          requestAnimationFrame(() => {
            release(top);
            release(below);
          });
        } else {
          release(top);
          release(below);
        }
      }, SETTLE_MS);
    };

    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchmove", onMove, { passive: false });
    element.addEventListener("touchend", onEnd);
    element.addEventListener("touchcancel", onEnd);
    return () => {
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchmove", onMove);
      element.removeEventListener("touchend", onEnd);
      element.removeEventListener("touchcancel", onEnd);
    };
  }, [root]);
};
