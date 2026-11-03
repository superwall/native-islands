import { describe, expect, it } from "bun:test";
import { drawsNatively, VIEW_MODES, viewModeItems, viewModeOf } from "../src/app/viewMode";

describe("viewModeItems", () => {
  it("lists every mode and checks only the current one", () => {
    const items = viewModeItems("web");
    expect(items.map((item) => item.id)).toEqual(["native", "web", "outlines"]);
    expect(items.filter((item) => item.checked).map((item) => item.id)).toEqual(["web"]);
  });

  it("gives every item a symbol", () => {
    expect(viewModeItems("native").every((item) => item.systemImage)).toBe(true);
  });
});

describe("viewModeOf", () => {
  it("reads each mode back from its item id", () => {
    for (const option of VIEW_MODES) expect(viewModeOf(option.value)).toBe(option.value);
  });

  it("ignores an id that is no mode", () => {
    expect(viewModeOf("simulate")).toBeUndefined();
  });
});

describe("drawsNatively", () => {
  it("keeps native views in Outlines, which only marks them, and drops them in Web", () => {
    expect(drawsNatively("native")).toBe(true);
    expect(drawsNatively("outlines")).toBe(true);
    expect(drawsNatively("web")).toBe(false);
  });
});
