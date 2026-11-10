import type { TNativeAccessibility } from "../../protocol/schemas";

const TRAITS: Readonly<Record<string, string>> = {
  button: "button",
  link: "link",
  switch: "switch",
  checkbox: "switch",
  tab: "button",
  img: "image",
  heading: "header",
};

// Composite widgets whose controls each name themselves: ARIA never names one
// from its text, which would run every tab or row together into one label.
const NAMED_BY_CHILDREN: ReadonlySet<string> = new Set([
  "grid",
  "list",
  "listbox",
  "menu",
  "menubar",
  "radiogroup",
  "table",
  "tablist",
  "toolbar",
  "tree",
  "treegrid",
]);

const roleOf = (element: Element): string | undefined => {
  const explicit = element.getAttribute("role");
  if (explicit) return explicit;
  const tag = element.tagName.toLowerCase();
  if (tag === "button") return "button";
  if (tag === "a" && element.hasAttribute("href")) return "link";
  if (tag === "img") return "img";
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "input") {
    const type = element.getAttribute("type");
    if (type === "checkbox") return "checkbox";
    if (type === "button" || type === "submit") return "button";
  }
  return undefined;
};

const labelOf = (elements: readonly Element[], fromText: boolean): string | undefined => {
  for (const element of elements) {
    const aria = element.getAttribute("aria-label")?.trim();
    if (aria) return aria;
    const alt = element.getAttribute("alt")?.trim();
    if (alt) return alt;
  }
  if (!fromText) return undefined;
  const text = elements
    .map((element) => element.textContent)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text === "" ? undefined : text;
};

export const accessibilityOf = (
  elements: readonly Element[],
  explicit?: TNativeAccessibility,
): TNativeAccessibility | undefined => {
  const derived: TNativeAccessibility = {};
  const first = elements[0];
  const role = first && roleOf(first);
  const label = labelOf(elements, !(role && NAMED_BY_CHILDREN.has(role)));
  if (label !== undefined) derived.label = label;
  const trait = role && TRAITS[role];
  if (trait) derived.traits = [trait];
  const merged = { ...derived, ...explicit };
  return Object.keys(merged).length === 0 ? undefined : merged;
};
