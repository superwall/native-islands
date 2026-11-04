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

  it("hides the web version of an arriving island without a fade", () => {
    ensureIslandStyles(document);
    const rule = rulesOf().find((candidate) =>
      candidate.selectorText.includes("data-island-arriving"),
    );
    expect(rule?.style.getPropertyValue("opacity")).toBe("0");
    expect(rule?.style.getPropertyValue("transition")).toBe("none");
    const selector = rule?.selectorText ?? "";

    const wrapper = document.body.appendChild(document.createElement("span"));
    wrapper.setAttribute("data-island", "symbol");
    const child = wrapper.appendChild(document.createElement("svg"));
    expect(child.matches(selector)).toBe(false);
    wrapper.setAttribute("data-island-arriving", "");
    expect(child.matches(selector)).toBe(true);
    expect(wrapper.matches(selector)).toBe(false);
  });

  it("is added to a document once", () => {
    ensureIslandStyles(document);
    ensureIslandStyles(document);
    const styles = document.head.querySelectorAll("style[data-island-styles]");
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toBe(ISLAND_STYLES);
  });
});
