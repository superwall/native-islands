import { describe, expect, it } from "bun:test";
import { demoScreens, searchScreens, sectionsOf, type ScreenSpec } from "../src/app/nav";
import { TABS } from "../src/app/navigation";
import { capabilityScreens } from "../src/tabs/capabilities";
import { PLACES } from "../src/tabs/capabilities/location";
import { componentScreens } from "../src/tabs/components";
import { searchScreen } from "../src/tabs/search";
import { settingScreens } from "../src/tabs/settings";
import { hasWebSymbol } from "../src/ui/icons";

const Empty = () => null;
const SCREENS = [...componentScreens, ...capabilityScreens, ...settingScreens, searchScreen];

describe("demoScreens", () => {
  it("puts every demo in its tab and section, in order", () => {
    const screens = demoScreens("components", "Controls", [
      { id: "a", title: "A", symbol: "plus", Component: Empty },
      { id: "b", title: "B", symbol: "minus", Component: Empty },
    ]);
    expect(screens.map((screen) => [screen.id, screen.tab, screen.section])).toEqual([
      ["a", "components", "Controls"],
      ["b", "components", "Controls"],
    ]);
  });
});

describe("sectionsOf", () => {
  it("groups a tab's demos by section and leaves out its root and other tabs", () => {
    const screens = [
      {
        id: "components",
        tab: "components" as const,
        title: "Root",
        symbol: "x",
        Component: Empty,
      },
      ...demoScreens("components", "One", [{ id: "a", title: "A", symbol: "x", Component: Empty }]),
      ...demoScreens("components", "Two", [{ id: "b", title: "B", symbol: "x", Component: Empty }]),
      ...demoScreens("components", "One", [{ id: "c", title: "C", symbol: "x", Component: Empty }]),
      ...demoScreens("settings", "One", [{ id: "d", title: "D", symbol: "x", Component: Empty }]),
    ];
    expect(
      sectionsOf(screens, "components").map((section) => [
        section.title,
        section.screens.map((screen) => screen.id),
      ]),
    ).toEqual([
      ["One", ["a", "c"]],
      ["Two", ["b"]],
    ]);
  });
});

describe("the app's screens", () => {
  it("have unique ids, one root per tab", () => {
    const ids = SCREENS.map((screen) => screen.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tab of TABS) expect(SCREENS.find((screen) => screen.id === tab)?.tab).toBe(tab);
  });

  it("list the Components demos in their sections", () => {
    expect(
      sectionsOf(SCREENS, "components").map((section) => [
        section.title,
        section.screens.map((screen) => screen.id),
      ]),
    ).toEqual([
      ["Controls", ["buttons", "menus", "toggles", "segmented", "sliders", "steppers"]],
      ["Pickers & Input", ["pickers", "dates", "text-fields"]],
      ["Indicators", ["gauges", "symbols", "charts"]],
      ["Presentations", ["sheets", "popovers", "alerts"]],
      ["Layout", ["lists", "list-editing", "outlines", "bars", "app-chrome"]],
    ]);
  });

  it("list the Capabilities demos in their sections", () => {
    expect(
      sectionsOf(SCREENS, "capabilities").map((section) => [
        section.title,
        section.screens.map((screen) => screen.id),
      ]),
    ).toEqual([
      ["Location", ["maps"]],
      ["Media", ["video", "camera", "photos"]],
      ["System", ["permissions", "haptics", "tips", "share"]],
      ["Primitives", ["haptic-patterns", "notifications", "context-menus", "materials"]],
    ]);
  });

  it("have a web drawing for every row symbol, for browsers and native islands off", () => {
    const symbols = [
      ...SCREENS.map((screen) => screen.symbol),
      ...PLACES.map((place) => place.symbol ?? ""),
    ];
    const missing = symbols.filter((symbol) => !hasWebSymbol(symbol));
    expect(missing).toEqual([]);
  });
});

describe("searchScreens", () => {
  const ids = (query: string, screens: readonly ScreenSpec[] = SCREENS) =>
    searchScreens(screens, query).map((screen) => screen.id);

  it("finds every demo, and no tab root or settings page, for an empty query", () => {
    const all = ids("  ");
    expect(all).toHaveLength(32);
    expect(all).not.toContain("components");
    expect(all).not.toContain("search");
    expect(all).not.toContain("accent");
  });

  it("matches the start of a word in the title, section or keywords", () => {
    expect(ids("vid")).toEqual(["video"]);
    expect(ids("picture in")).toEqual(["video"]);
    expect(ids("pickers")).toEqual(["pickers", "dates", "text-fields"]);
    expect(ids("glass")).toEqual(["buttons", "materials"]);
    expect(ids("ideo")).toEqual([]);
  });

  it("ignores case and accents, and needs every word to match", () => {
    expect(ids("MAPKIT")).toEqual(["maps"]);
    const accented = demoScreens("components", "Café", [
      { id: "a", title: "Crème", symbol: "x", Component: Empty },
    ]);
    expect(ids("creme cafe", accented)).toEqual(["a"]);
    expect(ids("creme tea", accented)).toEqual([]);
  });

  it("keeps the order the tabs list their demos in", () => {
    expect(ids("camera")).toEqual(["camera", "permissions"]);
  });
});
