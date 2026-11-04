import { afterEach, describe, expect, it } from "vitest";
import { ensureIslandStyles, ISLAND_STYLES } from "../../../src/react/dom/styles";

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
});

const rulesOf = () => {
  const rules: CSSStyleRule[] = [];
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) if ("selectorText" in rule) rules.push(rule as CSSStyleRule);
  }
  return rules;
};

describe("ISLAND_STYLES", () => {
  it("removes animations from the hidden web version of a shown island only", () => {
    ensureIslandStyles(document);
    const rule = rulesOf().find((candidate) => candidate.style.getPropertyValue("animation"));
    expect(rule?.style.getPropertyValue("animation")).toBe("none");
    expect(rule?.style.getPropertyPriority("animation")).toBe("important");
    const selector = rule?.selectorText ?? "";

    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-island", "Button");
    const child = wrapper.appendChild(document.createElement("div"));
    const deep = child.appendChild(document.createElement("span"));
    document.body.appendChild(wrapper);
    expect(child.matches(selector)).toBe(false);

    wrapper.setAttribute("data-island-shown", "");
    expect(child.matches(selector)).toBe(true);
    expect(deep.matches(selector)).toBe(true);
    // The wrapper is `display: contents`; its child is the box the native
    // view follows, and loses its animations too. An ancestor keeps them.
    expect(wrapper.matches(selector)).toBe(false);
    const ancestor = document.createElement("div");
    document.body.appendChild(ancestor).appendChild(wrapper);
    expect(ancestor.matches(selector)).toBe(false);
  });

  it("is added to a document once", () => {
    ensureIslandStyles(document);
    ensureIslandStyles(document);
    const styles = document.head.querySelectorAll("style[data-island-styles]");
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toBe(ISLAND_STYLES);
  });
});

describe("the web version of an island the host takes over", () => {
  it("stays up until the native view shows, then goes without the fade", () => {
    ensureIslandStyles(document);
    const rule = rulesOf().find((candidate) =>
      candidate.selectorText.includes("data-island-reusing"),
    );
    expect(rule?.style.getPropertyValue("opacity")).toBe("");
    expect(rule?.style.getPropertyValue("transition")).toContain("none");
    const wrapper = document.createElement("span");
    wrapper.setAttribute("data-island", "symbol");
    wrapper.setAttribute("data-island-reusing", "");
    const child = wrapper.appendChild(document.createElement("span"));
    document.body.appendChild(wrapper);
    expect(child.matches(rule?.selectorText ?? "")).toBe(true);
  });
});
