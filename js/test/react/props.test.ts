import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCssColor, resolveCssVariables, resolveNativeProps } from "../../src/react/props";

const host = (variables: Record<string, string>) => {
  const element = document.createElement("div");
  for (const [name, value] of Object.entries(variables)) element.style.setProperty(name, value);
  document.body.appendChild(element);
  return element;
};

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("resolveCssVariables", () => {
  it("replaces variables with their computed values", () => {
    const element = host({ "--brand": " #0a84ff ", "--radius": "12px" });
    expect(resolveCssVariables("var(--brand)", element)).toBe("#0a84ff");
    expect(resolveCssVariables("calc(var(--radius) * 2)", element)).toBe("calc(12px * 2)");
    expect(resolveCssVariables("plain text", element)).toBe("plain text");
  });

  it("uses the fallback, including one that holds parentheses or another variable", () => {
    const element = host({ "--accent": "teal" });
    expect(resolveCssVariables("var(--missing, red)", element)).toBe("red");
    expect(resolveCssVariables("var(--missing, rgb(1, 2, 3))", element)).toBe("rgb(1, 2, 3)");
    expect(resolveCssVariables("var(--missing)", element)).toBe("");
    expect(resolveCssVariables("var(--missing, var(--accent))", element)).toBe("teal");
  });

  it("follows variables that point at other variables", () => {
    const element = host({ "--brand": "var(--blue)", "--blue": "#00f" });
    expect(resolveCssVariables("var(--brand)", element)).toBe("#00f");
  });

  it("stops on a cycle instead of looping forever", () => {
    const element = host({ "--a": "var(--a)" });
    expect(resolveCssVariables("var(--a)", element)).toBe("var(--a)");
  });
});

describe("resolveCssColor", () => {
  it("returns the computed rgb() colour", () => {
    expect(resolveCssColor("red", host({}))).toBe("rgb(255, 0, 0)");
  });

  it("leaves a value that is not a colour untouched", () => {
    expect(resolveCssColor("not a colour", host({}))).toBe("not a colour");
  });

  it("works on an element with no parent", () => {
    const element = document.createElement("div");
    expect(resolveCssColor("#fff", element)).toBe("rgb(255, 255, 255)");
    expect(document.body.children).toHaveLength(0);
  });

  it("keeps the value when the browser computes nothing", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({ color: "" } as CSSStyleDeclaration);
    expect(resolveCssColor("red", host({}))).toBe("red");
  });
});

describe("resolveNativeProps", () => {
  it("resolves variables in nested strings and colour props, and leaves other values alone", () => {
    const element = host({ "--brand": "red", "--title": "Go Pro" });
    expect(
      resolveNativeProps(
        {
          title: "var(--title)",
          tint: "var(--brand)",
          count: 2,
          on: true,
          none: null,
          labels: ["var(--title)", 3],
          style: { color: "var(--brand)" },
          missing: undefined,
        },
        element,
        ["tint", "count", "absent"],
      ),
    ).toEqual({
      title: "Go Pro",
      tint: "rgb(255, 0, 0)",
      count: 2,
      on: true,
      none: null,
      labels: ["Go Pro", 3],
      style: { color: "red" },
      missing: undefined,
    });
  });

  it("passes non-plain objects through for the bridge to refuse", () => {
    const when = new Date(0);
    expect(resolveNativeProps({ when }, host({})).when).toBe(when);
  });
});
