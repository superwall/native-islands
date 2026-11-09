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
  it("is hidden from the first frame, with no fade", () => {
    ensureIslandStyles(document);
    const rule = rulesOf().find((candidate) =>
      candidate.selectorText.includes("data-island-reusing"),
    );
    expect(rule?.style.getPropertyValue("opacity")).toBe("0");
    expect(rule?.style.getPropertyValue("transition")).toContain("none");
    const wrapper = document.createElement("span");
    wrapper.setAttribute("data-island", "symbol");
    wrapper.setAttribute("data-island-reusing", "");
    const child = wrapper.appendChild(document.createElement("span"));
    document.body.appendChild(wrapper);
    expect(child.matches(rule?.selectorText ?? "")).toBe(true);
  });
});

describe("the concealed web version of a shown island", () => {
  const concealment = () => {
    ensureIslandStyles(document);
    return rulesOf().find((candidate) => candidate.selectorText.includes("data-island-concealed"));
  };

  it("takes no touches, down to its deepest child", () => {
    const rule = concealment();
    expect(rule?.style.getPropertyValue("pointer-events")).toBe("none");
    // Important, so a child the page gives `pointer-events: auto` stays untouchable.
    expect(rule?.style.getPropertyPriority("pointer-events")).toBe("important");
    const wrapper = document.createElement("span");
    wrapper.setAttribute("data-island", "segmentedControl");
    const child = wrapper.appendChild(document.createElement("div"));
    const deep = child.appendChild(document.createElement("button"));
    document.body.appendChild(wrapper);
    const selector = rule?.selectorText ?? "";
    expect(deep.matches(selector)).toBe(false);
    wrapper.setAttribute("data-island-concealed", "");
    expect(wrapper.matches(selector)).toBe(true);
    expect(child.matches(selector)).toBe(true);
    expect(deep.matches(selector)).toBe(true);
    // While the page samples what covers the island, it can be hit again.
    wrapper.setAttribute("data-island-probe", "");
    expect(deep.matches(selector)).toBe(false);
  });

  it("stays in the accessibility tree, so VoiceOver can read it", () => {
    concealment();
    for (const rule of rulesOf()) {
      expect(rule.style.getPropertyValue("visibility")).toBe("");
      expect(rule.style.getPropertyValue("display")).toBe("");
      expect(rule.style.getPropertyValue("content-visibility")).toBe("");
    }
  });
});
