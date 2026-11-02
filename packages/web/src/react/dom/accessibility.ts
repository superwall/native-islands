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

const labelOf = (elements: readonly Element[]): string | undefined => {
  for (const element of elements) {
    const aria = element.getAttribute("aria-label")?.trim();
    if (aria) return aria;
    const alt = element.getAttribute("alt")?.trim();
    if (alt) return alt;
  }
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
  const label = labelOf(elements);
  if (label !== undefined) derived.label = label;
  const first = elements[0];
  const role = first && roleOf(first);
  const trait = role && TRAITS[role];
  if (trait) derived.traits = [trait];
  const merged = { ...derived, ...explicit };
  return Object.keys(merged).length === 0 ? undefined : merged;
};
