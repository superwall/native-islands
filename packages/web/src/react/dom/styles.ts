import {
  ISLAND_ARRIVING_ATTRIBUTE,
  ISLAND_COMPONENT_ATTRIBUTE,
  ISLAND_CONCEALED_ATTRIBUTE,
  ISLAND_PROBE_ATTRIBUTE,
  ISLAND_SCROLLER_ATTRIBUTE,
  ISLAND_SHOWN_ATTRIBUTE,
  ISLAND_STYLE_ATTRIBUTE,
  SHOWN_ISLAND_SELECTOR,
} from "../../layout/attributes";

export const ISLAND_STYLES = [
  `:where([${ISLAND_COMPONENT_ATTRIBUTE}]) > * { transition: opacity var(--island-fade, 120ms) ease; }`,
  `[${ISLAND_COMPONENT_ATTRIBUTE}][${ISLAND_SHOWN_ATTRIBUTE}] > * { opacity: 0; }`,
  // The host shows a fresh island at once, so its web version goes without a
  // fade and is already gone when the island turns shown.
  `[${ISLAND_COMPONENT_ATTRIBUTE}][${ISLAND_ARRIVING_ATTRIBUTE}] > * { opacity: 0; transition: none; }`,
  `[${ISLAND_COMPONENT_ATTRIBUTE}][${ISLAND_CONCEALED_ATTRIBUTE}]:not([${ISLAND_PROBE_ATTRIBUTE}]) { visibility: hidden; }`,
  `[${ISLAND_COMPONENT_ATTRIBUTE}][${ISLAND_PROBE_ATTRIBUTE}] * { pointer-events: auto !important; }`,
  // While content in a scroller animates, WebKit composites what follows it.
  // Unless the scroller is a stacking context, those layers go above the
  // scroller's own view, so they cover the islands drawn in it.
  `[${ISLAND_SCROLLER_ATTRIBUTE}] { isolation: isolate; }`,
  // A running animation in the hidden web version makes WebKit composite it
  // and every box painted after it above the scroll view the native views
  // live in, covering them. Pausing keeps those layers; only removing it
  // drops them. The wrapper is `display: contents`, so this reaches the
  // boxes the native view follows too: an animation on one of them, such as
  // a spin, no longer turns or moves the native view. Animations on the
  // island's ancestors still run and move it.
  `${SHOWN_ISLAND_SELECTOR} * { animation: none !important; }`,
].join("\n");

export const ensureIslandStyles = (document: Document) => {
  if (document.head.querySelector(`style[${ISLAND_STYLE_ATTRIBUTE}]`)) return;
  const style = document.createElement("style");
  style.setAttribute(ISLAND_STYLE_ATTRIBUTE, "");
  style.textContent = ISLAND_STYLES;
  document.head.appendChild(style);
};
