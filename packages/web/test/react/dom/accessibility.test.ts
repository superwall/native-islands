import { describe, expect, it } from "vitest";
import { accessibilityOf } from "../../../src/react/dom/accessibility";

const html = (markup: string) => {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  return Array.from(template.content.children);
};

describe("accessibilityOf", () => {
  it("reads the label from aria-label, then alt, then text", () => {
    expect(accessibilityOf(html(`<button aria-label="Close">×</button>`))).toEqual({
      label: "Close",
      traits: ["button"],
    });
    expect(accessibilityOf(html(`<img alt="Crown" src="x.png">`))).toEqual({
      label: "Crown",
      traits: ["image"],
    });
    expect(accessibilityOf(html(`<span>  Start\n  trial </span><span>now</span>`))).toEqual({
      label: "Start trial now",
    });
  });

  it("maps roles to native traits", () => {
    const traitOf = (markup: string) => accessibilityOf(html(markup))?.traits;
    expect(traitOf(`<a href="/terms">Terms</a>`)).toEqual(["link"]);
    expect(traitOf(`<a>Terms</a>`)).toBeUndefined();
    expect(traitOf(`<h2>Plans</h2>`)).toEqual(["header"]);
    expect(traitOf(`<input type="checkbox" aria-label="x">`)).toEqual(["switch"]);
    expect(traitOf(`<input type="submit" aria-label="x">`)).toEqual(["button"]);
    expect(traitOf(`<input type="button" aria-label="x">`)).toEqual(["button"]);
    expect(traitOf(`<input type="text" aria-label="x">`)).toBeUndefined();
    expect(traitOf(`<div role="switch">x</div>`)).toEqual(["switch"]);
    expect(traitOf(`<div role="tab">x</div>`)).toEqual(["button"]);
    expect(traitOf(`<div role="slider">x</div>`)).toBeUndefined();
  });

  it("lets explicit values win and returns nothing when there is nothing to say", () => {
    expect(accessibilityOf(html(`<button>Go</button>`), { label: "Buy", hidden: false })).toEqual({
      label: "Buy",
      traits: ["button"],
      hidden: false,
    });
    expect(accessibilityOf(html(`<div></div>`))).toBeUndefined();
    expect(accessibilityOf([])).toBeUndefined();
  });

  it("never names a composite widget from its text, so its controls are not run together", () => {
    expect(
      accessibilityOf(
        html(
          `<div role="tablist"><button role="tab">Inbox</button><button role="tab">Files</button></div>`,
        ),
      ),
    ).toBeUndefined();
    expect(
      accessibilityOf(
        html(`<div role="toolbar"><button>Share</button><button>Edit</button></div>`),
      ),
    ).toBeUndefined();
    expect(accessibilityOf(html(`<ul role="list"><li>Lena</li><li>Sam</li></ul>`))).toBeUndefined();
    expect(
      accessibilityOf(
        html(`<div role="toolbar" aria-label="Formatting"><button>Bold</button></div>`),
      ),
    ).toEqual({
      label: "Formatting",
    });
  });

  it("skips blank aria-labels", () => {
    expect(accessibilityOf(html(`<span aria-label="  " alt="">Text</span>`))).toEqual({
      label: "Text",
    });
  });
});
