import {
  ISLAND_COMPONENT_ATTRIBUTE,
  ISLAND_CONCEALED_ATTRIBUTE,
  ISLAND_PROBE_ATTRIBUTE,
  ISLAND_SCROLLER_ATTRIBUTE,
  ISLAND_SHOWN_ATTRIBUTE,
  ISLAND_STYLE_ATTRIBUTE,
} from "../../layout/attributes";

export const ISLAND_STYLES = [
  `:where([${ISLAND_COMPONENT_ATTRIBUTE}]) > * { transition: opacity var(--island-fade, 120ms) ease; }`,
  `[${ISLAND_COMPONENT_ATTRIBUTE}][${ISLAND_SHOWN_ATTRIBUTE}] > * { opacity: 0; }`,
  `[${ISLAND_COMPONENT_ATTRIBUTE}][${ISLAND_CONCEALED_ATTRIBUTE}]:not([${ISLAND_PROBE_ATTRIBUTE}]) { visibility: hidden; }`,
  `[${ISLAND_COMPONENT_ATTRIBUTE}][${ISLAND_PROBE_ATTRIBUTE}] * { pointer-events: auto !important; }`,
  // While content in a scroller animates, WebKit composites what follows it.
  // Unless the scroller is a stacking context, those layers go above the
  // scroller's own view, so they cover the islands drawn in it.
  `[${ISLAND_SCROLLER_ATTRIBUTE}] { isolation: isolate; }`,
].join("\n");

export const ensureIslandStyles = (document: Document) => {
  if (document.head.querySelector(`style[${ISLAND_STYLE_ATTRIBUTE}]`)) return;
  const style = document.createElement("style");
  style.setAttribute(ISLAND_STYLE_ATTRIBUTE, "");
  style.textContent = ISLAND_STYLES;
  document.head.appendChild(style);
};
