import {
  ISLAND_COMPONENT_ATTRIBUTE,
  ISLAND_CONCEALED_ATTRIBUTE,
  ISLAND_PROBE_ATTRIBUTE,
  ISLAND_SHOWN_ATTRIBUTE,
  ISLAND_STYLE_ATTRIBUTE,
} from "../attributes";

export const ISLAND_STYLES = [
  `:where([${ISLAND_COMPONENT_ATTRIBUTE}]) > * { transition: opacity var(--island-fade, 120ms) ease; }`,
  `[${ISLAND_COMPONENT_ATTRIBUTE}][${ISLAND_SHOWN_ATTRIBUTE}] > * { opacity: 0; }`,
  `[${ISLAND_COMPONENT_ATTRIBUTE}][${ISLAND_CONCEALED_ATTRIBUTE}]:not([${ISLAND_PROBE_ATTRIBUTE}]) { visibility: hidden; }`,
  `[${ISLAND_COMPONENT_ATTRIBUTE}][${ISLAND_PROBE_ATTRIBUTE}] * { pointer-events: auto !important; }`,
].join("\n");

/** Adds the style rules islands need to `document`, once. */
export const ensureIslandStyles = (document: Document) => {
  if (document.head.querySelector(`style[${ISLAND_STYLE_ATTRIBUTE}]`)) return;
  const style = document.createElement("style");
  style.setAttribute(ISLAND_STYLE_ATTRIBUTE, "");
  style.textContent = ISLAND_STYLES;
  document.head.appendChild(style);
};
