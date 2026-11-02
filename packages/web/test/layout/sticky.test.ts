import { afterEach, describe, expect, it, vi } from "vitest";
import { anchorOf, placementOf, stickyShift, unstuckOf } from "../../src/layout/measure";
import { layoutWatcherFor } from "../../src/layout/watcher";
import { rectAttribute, setScrollGeometry } from "../support/dom";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

const unstuck = (element: Element) => {
  for (let at: Element | null = element; at; at = at.parentElement) {
    if (at instanceof HTMLElement && at.style.position === "static") return true;
  }
  return false;
};

const mockStickyLayout = () =>
  vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      const source = unstuck(this)
        ? (this.dataset.unstuck ?? this.dataset.rect)
        : this.dataset.rect;
      const [x = 0, y = 0, width = 0, height = 0] = (source ?? "0,0,0,0").split(",").map(Number);
      return {
        x,
        y,
        width,
        height,
        left: x,
        top: y,
        right: x + width,
        bottom: y + height,
        toJSON: () => ({}),
      } as DOMRect;
    });

const footerPage = (stickyStyle = "position: sticky; bottom: 12px; margin-top: 8px") => {
  document.body.innerHTML = `
    <div id="route" style="overflow-y: auto" data-rect="${rectAttribute(0, 0, 400, 800)}">
      <main id="main" data-rect="${rectAttribute(0, 0, 400, 1000)}">
        <div id="footer" style="${stickyStyle}"
          data-rect="${rectAttribute(0, 728, 400, 60)}" data-unstuck="${rectAttribute(0, 900, 400, 60)}">
          <div data-island style="display: inline-block"
            data-rect="${rectAttribute(20, 736, 360, 44)}" data-unstuck="${rectAttribute(20, 908, 360, 44)}"></div>
        </div>
      </main>
    </div>`;
  const route = document.getElementById("route") as HTMLElement;
  setScrollGeometry(route, { scrollHeight: 1000, clientHeight: 800, clientWidth: 400 });
  return {
    route,
    footer: document.getElementById("footer") as HTMLElement,
    wrapper: document.querySelector("[data-island]") as HTMLElement,
  };
};

describe("stickyShift", () => {
  const footer = {
    bottom: 12,
    box: { x: 0, y: 900, width: 400, height: 60 },
    bounds: { x: 0, y: 0, width: 400, height: 1000 },
  };

  it("keeps a bottom box at the viewport's edge until its own spot scrolls into view", () => {
    expect(stickyShift(footer, 0, 800)).toBe(-172);
    expect(stickyShift(footer, 100, 800)).toBe(-72);
    expect(stickyShift(footer, 300, 800)).toBe(0);
  });

  it("never lifts a bottom box above its containing block", () => {
    expect(
      stickyShift({ ...footer, bounds: { x: 0, y: 600, width: 400, height: 360 } }, 0, 300),
    ).toBe(-300);
  });

  it("stops a top box at the end of its containing block", () => {
    const header = {
      top: 8,
      box: { x: 0, y: 100, width: 400, height: 50 },
      bounds: { x: 0, y: 0, width: 400, height: 600 },
    };
    expect(stickyShift(header, 0, 800)).toBe(0);
    expect(stickyShift(header, 200, 800)).toBe(108);
    expect(stickyShift(header, 1000, 800)).toBe(450);
  });
});

describe("sticky placement", () => {
  it("anchors a sticky island in its scroller with the box where it sits unstuck", () => {
    mockStickyLayout();
    const { route, footer, wrapper } = footerPage();
    const placement = placementOf(wrapper, { sticky: true });
    expect(placement?.kind).toBe("scroller");
    expect(placement?.scroller).toBe(route);
    expect(placement?.frame).toEqual({ x: 20, y: 908, width: 360, height: 44 });
    expect(placement?.rect).toEqual({ x: 20, y: 736, width: 360, height: 44 });
    expect(placement?.sticky).toEqual({
      bottom: 12,
      box: { x: 0, y: 900, width: 400, height: 60 },
      bounds: { x: 0, y: 8, width: 400, height: 992 },
    });
    expect(footer.getAttribute("style")).toBe("position: sticky; bottom: 12px; margin-top: 8px;");
  });

  it("puts back a box that had no style attribute", () => {
    mockStickyLayout();
    const { footer, wrapper } = footerPage();
    footer.removeAttribute("style");
    footer.style.position = "sticky";
    footer.style.bottom = "0px";
    const placement = placementOf(wrapper, { sticky: true });
    expect(placement?.sticky?.bottom).toBe(0);
    expect(footer.style.position).toBe("sticky");
  });

  it("keeps an important position the box set itself", () => {
    mockStickyLayout();
    const { footer, wrapper } = footerPage("position: sticky !important; top: 4px");
    expect(placementOf(wrapper, { sticky: true })?.sticky?.top).toBe(4);
    expect(footer.style.getPropertyPriority("position")).toBe("important");
  });

  it("follows the box every frame from JS when the host cannot keep it stuck", () => {
    mockStickyLayout();
    const { wrapper } = footerPage();
    expect(placementOf(wrapper)?.kind).toBe("tracked");
  });

  it("follows the box from JS when it sticks to no inset or has no parent", () => {
    mockStickyLayout();
    const { wrapper } = footerPage("position: sticky");
    expect(placementOf(wrapper, { sticky: true })?.kind).toBe("tracked");
    const orphan = document.createElement("div");
    expect(
      unstuckOf({ kind: "scroller", scroller: orphan, sticky: orphan }, [orphan]),
    ).toBeUndefined();
  });

  it("follows a sticky box that has no scroller above it from JS", () => {
    mockStickyLayout();
    document.body.innerHTML = `<div style="position: sticky; top: 0"><div data-island></div></div>`;
    const wrapper = document.querySelector("[data-island]") as HTMLElement;
    expect(anchorOf(wrapper, { sticky: true })).toEqual({ kind: "tracked" });
  });

  it("follows from JS when the island has nothing to measure while unstuck", () => {
    mockStickyLayout();
    const { route, footer } = footerPage();
    expect(unstuckOf({ kind: "scroller", scroller: route, sticky: footer }, [])).toBeUndefined();
  });

  it("measures without waking the layout watcher", async () => {
    mockStickyLayout();
    const { wrapper } = footerPage();
    const watcher = layoutWatcherFor(document);
    const passes: string[] = [];
    const stop = watcher.subscribe((pass) => passes.push(pass));
    await new Promise((resolve) => setTimeout(resolve, 700));
    passes.length = 0;
    placementOf(wrapper, { sticky: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    stop();
    expect(passes).toEqual([]);
  });
});
