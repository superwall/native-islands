import { describe, expect, it } from "bun:test";
import { demoScreens, sectionsOf } from "../src/app/nav";
import { TABS } from "../src/app/navigation";
import { capabilityScreens } from "../src/tabs/capabilities";
import { componentScreens } from "../src/tabs/components";
import { settingScreens } from "../src/tabs/settings";
import { hasWebSymbol } from "../src/ui/icons";

const Empty = () => null;
const SCREENS = [...componentScreens, ...capabilityScreens, ...settingScreens];

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
    ]);
  });

  it("have a web drawing for every row symbol, for browsers and native islands off", () => {
    const missing = SCREENS.map((screen) => screen.symbol).filter(
      (symbol) => !hasWebSymbol(symbol),
    );
    expect(missing).toEqual([]);
  });
});
