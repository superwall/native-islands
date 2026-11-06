import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, fireEvent, renderHook, screen } from "@testing-library/react";
import {
  NavigationBar,
  NavigationStack,
  SearchField,
  SearchTab,
  TabAccessory,
  TabBar,
  TabView,
  Toolbar,
  useNavigationPath,
  type BarItem,
  type SearchFieldHandle,
} from "../../src/components";
import { removeCapability, renderNative } from "../support/react";
import { installComponents, mountComponent, replyTo } from "./support";

beforeEach(installComponents);

afterEach(() => {
  removeCapability();
  vi.restoreAllMocks();
});

const renderWeb = (ui: React.ReactElement) => {
  removeCapability();
  return renderNative(ui);
};

const ITEMS: readonly BarItem[] = [
  { id: "share", systemImage: "square.and.arrow.up" },
  { kind: "spacer" },
  { id: "add", systemImage: "plus" },
  { kind: "flexibleSpace", id: "gap" },
  { id: "edit", title: "Edit", prominent: true, tint: "#f00" },
  { id: "off", title: "Off", disabled: true },
  {
    id: "more",
    kind: "menu",
    systemImage: "ellipsis",
    items: [
      { id: "a", title: "A", checked: true },
      { id: "sub", title: "Sub", children: [{ id: "b", title: "B", destructive: true }] },
    ],
  },
];

describe("Toolbar", () => {
  it("lays items out natively and reports a choice", async () => {
    const onSelect = vi.fn();
    const view = await mountComponent(<Toolbar items={ITEMS} onSelect={onSelect} />);
    expect(view.mount).toMatchObject({ component: "toolbar", props: { items: ITEMS } });
    view.event("select", { id: "add" });
    expect(onSelect).toHaveBeenCalledWith("add");
  });

  it("draws buttons, spaces and menus on the web, with the page's symbols", () => {
    const onSelect = vi.fn();
    renderWeb(
      <Toolbar items={ITEMS} icon={(name) => <i data-symbol={name} />} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "square.and.arrow.up" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onSelect.mock.calls).toEqual([["share"], ["edit"]]);
    const more = document.querySelector("[data-symbol=ellipsis]")?.closest("button");
    if (!more) throw new Error("No menu.");
    fireEvent.click(more);
    fireEvent.click(screen.getByRole("menuitem", { name: "B" }));
    expect(onSelect).toHaveBeenLastCalledWith("b");
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(more);
    fireEvent.click(more);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("falls back to its own glyphs, or the symbol's name, and takes its own web version", () => {
    renderWeb(
      <Toolbar
        items={[
          { id: "plus", systemImage: "plus" },
          { id: "star", systemImage: "star" },
          { id: "list", title: "List", items: [{ id: "x", title: "X" }] },
          { id: "empty", kind: "menu", title: "Empty" },
        ]}
      />,
    );
    expect(document.querySelector("[data-glyph=plus]")).not.toBeNull();
    expect(screen.getByText("star")).toBeTruthy();
    const list = screen.getByText("List").closest("button");
    if (!list) throw new Error("No menu.");
    fireEvent.click(list);
    fireEvent.click(screen.getByRole("menuitem", { name: "X" }));
    const own = renderWeb(
      <Toolbar items={[]}>
        <p>Mine</p>
      </Toolbar>,
    );
    expect(own.container.textContent).toBe("Mine");
  });
});

describe("NavigationBar", () => {
  it("sends Back and choices natively", async () => {
    const onBack = vi.fn();
    const onSelect = vi.fn();
    const view = await mountComponent(
      <NavigationBar
        title="Inbox"
        showsBack
        backTitle="Mail"
        trailing={ITEMS}
        onBack={onBack}
        onSelect={onSelect}
      />,
    );
    expect(view.mount).toMatchObject({
      component: "navigationBar",
      props: { title: "Inbox", showsBack: true, backTitle: "Mail", titleShown: true, leading: [] },
    });
    view.event("back");
    view.event("select", { id: "edit" });
    expect(onBack).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith("edit");
  });

  it("draws Back, the title and items on the web", () => {
    const onBack = vi.fn();
    const onSelect = vi.fn();
    const view = renderWeb(
      <NavigationBar
        title="Inbox"
        showsBack
        titleShown={false}
        leading={[{ id: "x", title: "X" }]}
        onBack={onBack}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "X" }));
    expect(onBack).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith("x");
    expect(view.container.querySelector(".ni-navbar-title")?.hasAttribute("data-shown")).toBe(
      false,
    );
    const plain = renderWeb(<NavigationBar title="Plain" leading={[{ id: "y", title: "Y" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Y" }));
    expect(plain.container.querySelector(".ni-navbar-back")).toBeNull();
    const own = renderWeb(
      <NavigationBar title="t">
        <p>Mine</p>
      </NavigationBar>,
    );
    expect(own.container.textContent).toBe("Mine");
  });
});

const TABS = [
  { id: "inbox", title: "Inbox", systemImage: "tray", badge: 2 },
  { id: "files", title: "Files", systemImage: "folder" },
];

describe("TabBar", () => {
  it("selects natively by id", async () => {
    const onSelect = vi.fn();
    const view = await mountComponent(
      <TabBar tabs={TABS} selectedId="files" onSelect={onSelect} />,
    );
    expect(view.mount).toMatchObject({
      component: "tabBar",
      props: { tabs: TABS, selectedId: "files", selectedIndex: 1 },
      accessibility: { label: "Tab Bar" },
    });
    view.event("select", { index: 0, id: "inbox" });
    expect(onSelect).toHaveBeenCalledWith("inbox");
  });

  it("is a tab list on the web", () => {
    const onSelect = vi.fn();
    renderWeb(<TabBar tabs={TABS} selectedId="inbox" onSelect={onSelect} />);
    expect(screen.getByRole("tab", { name: /Inbox/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("2")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Files" }));
    expect(onSelect).toHaveBeenCalledWith("files");
    const own = renderWeb(
      <TabBar tabs={[]} selectedId="" onSelect={onSelect}>
        <p>Mine</p>
      </TabBar>,
    );
    expect(own.container.textContent).toBe("Mine");
  });
});

describe("SearchTab", () => {
  it("presses natively and on the web", async () => {
    const onPress = vi.fn();
    const view = await mountComponent(<SearchTab selected onPress={onPress} />);
    expect(view.mount).toMatchObject({
      component: "searchTab",
      accessibility: { label: "Search", traits: ["selected"] },
    });
    view.event("press");
    expect(onPress).toHaveBeenCalledTimes(1);
    view.unmount();
    renderWeb(<SearchTab selected={false} icon={<i />} onPress={onPress} />);
    fireEvent.click(screen.getByRole("tab", { name: "Search" }));
    expect(onPress).toHaveBeenCalledTimes(2);
    const own = renderWeb(
      <SearchTab selected={false} onPress={onPress}>
        <p>Mine</p>
      </SearchTab>,
    );
    expect(own.container.textContent).toBe("Mine");
    own.unmount();
    renderWeb(<SearchTab selected={false} onPress={onPress} />);
    expect(screen.getAllByText("⌕")).toHaveLength(1);
  });
});

describe("SearchField", () => {
  it("streams text natively, submits, and focuses through its handle", async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const handle = React.createRef<SearchFieldHandle>();
    const view = await mountComponent(
      <SearchField text="" handle={handle} onChange={onChange} onSubmit={onSubmit} />,
    );
    expect(view.mount).toMatchObject({
      component: "searchField",
      props: { placeholder: "Search" },
    });
    await view.state({ text: "isl" });
    expect(onChange).toHaveBeenCalledWith("isl");
    view.event("submit", { text: "isl" });
    expect(onSubmit).toHaveBeenCalledWith("isl");
    await act(async () => handle.current?.focus());
    await replyTo(view, "focus", { ok: false, error: "no" });
    await act(async () => handle.current?.blur());
    await replyTo(view, "blur", { ok: true });
  });

  it("is a search form on the web", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const handle = React.createRef<SearchFieldHandle>();
    renderWeb(
      <SearchField
        text="a"
        placeholder="Find"
        handle={handle}
        onChange={onChange}
        onSubmit={onSubmit}
      />,
    );
    const input = screen.getByRole("searchbox", { name: "Find" });
    fireEvent.change(input, { target: { value: "ab" } });
    expect(onChange).toHaveBeenCalledWith("ab");
    fireEvent.submit(screen.getByRole("search"));
    expect(onSubmit).toHaveBeenCalledWith("a");
    handle.current?.focus();
    handle.current?.blur();
    renderWeb(<SearchField text="" onChange={onChange} />);
    fireEvent.submit(screen.getAllByRole("search")[1] ?? input);
    const own = renderWeb(
      <SearchField text="" onChange={onChange}>
        <p>Mine</p>
      </SearchField>,
    );
    expect(own.container.textContent).toBe("Mine");
  });
});

describe("TabAccessory", () => {
  it("presses and acts natively", async () => {
    const onPress = vi.fn();
    const onAction = vi.fn();
    const view = await mountComponent(
      <TabAccessory title="Radio" subtitle="Playing" onPress={onPress} onAction={onAction} />,
    );
    expect(view.mount).toMatchObject({
      component: "tabAccessory",
      accessibility: { label: "Radio, Playing" },
    });
    view.event("press");
    view.event("action", { id: "pause" });
    expect(onPress).toHaveBeenCalled();
    expect(onAction).toHaveBeenCalledWith("pause");
    view.unmount();
    const solo = await mountComponent(<TabAccessory title="Solo" />);
    expect(solo.mount.accessibility).toEqual({ label: "Solo" });
  });

  it("is a glass bar on the web", () => {
    const onPress = vi.fn();
    const onAction = vi.fn();
    renderWeb(
      <TabAccessory
        title="Radio"
        subtitle="Live"
        systemImage="music.note"
        actions={[{ id: "play", title: "Play" }]}
        onPress={onPress}
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Radio/ }));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(onPress).toHaveBeenCalled();
    expect(onAction).toHaveBeenCalledWith("play");
    const bare = renderWeb(<TabAccessory title="Bare" actions={[{ id: "x", title: "X" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "X" }));
    expect(bare.container.querySelector(".ni-tab-accessory-subtitle")).toBeNull();
    const own = renderWeb(
      <TabAccessory title="t">
        <p>Mine</p>
      </TabAccessory>,
    );
    expect(own.container.textContent).toBe("Mine");
  });
});

describe("TabView", () => {
  it("shows the selected tab, a Search tab and an accessory", () => {
    const onSelect = vi.fn();
    const view = renderWeb(
      <TabView
        tabs={TABS.map((tab) => ({ ...tab, content: <p>{tab.title} page</p> }))}
        selectedId="search"
        onSelect={onSelect}
        search={{ content: <p>Search page</p> }}
        accessory={<p>Accessory</p>}
      />,
    );
    const pages = [...view.container.querySelectorAll("section")].map((section) => section.hidden);
    expect(pages).toEqual([true, true, false]);
    fireEvent.click(screen.getByRole("tab", { name: "Files" }));
    fireEvent.click(screen.getByRole("tab", { name: "Search" }));
    expect(onSelect.mock.calls).toEqual([["files"], ["search"]]);
    expect(screen.getByText("Accessory")).toBeTruthy();
    const plain = renderWeb(
      <TabView
        tabs={TABS.map((tab) => Object.assign({ content: tab.title }, tab))}
        selectedId="inbox"
        onSelect={onSelect}
      />,
    );
    expect(plain.container.querySelectorAll("section")).toHaveLength(2);
    expect(plain.container.querySelector(".ni-tab-view-accessory")).toBeNull();
  });
});

describe("NavigationStack", () => {
  it("shows the screen on top with the one below, pops on Back, and shows the large title until it scrolls", () => {
    const onPathChange = vi.fn();
    const onSelect = vi.fn();
    const screens = {
      root: { title: "Root", largeTitle: true, render: () => <p>Root page</p> },
      detail: {
        title: "Detail",
        trailing: [{ id: "x", title: "X" }],
        render: () => <p>Detail page</p>,
      },
      deeper: { title: "Deeper", render: () => <p>Deeper page</p> },
    };
    const view = renderWeb(
      <NavigationStack
        path={["root"]}
        onPathChange={onPathChange}
        screens={screens}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole("heading", { name: "Root" })).toBeTruthy();
    const title = () => view.container.querySelector(".ni-navbar-title");
    expect(title()?.hasAttribute("data-shown")).toBe(false);
    const top = view.container.querySelector("[data-place=top]");
    if (!top) throw new Error("No screen.");
    top.scrollTop = 100;
    fireEvent.scroll(top);
    expect(title()?.hasAttribute("data-shown")).toBe(true);
    view.rerender(
      <NavigationStack
        path={["root", "detail", "deeper"]}
        onPathChange={onPathChange}
        screens={screens}
        onSelect={onSelect}
      />,
    );
    expect(screen.queryByText("Root page")).toBeNull();
    expect(view.container.querySelector("[data-place=below]")?.textContent).toBe("Detail page");
    expect(view.container.querySelector("[data-place=top]")?.getAttribute("data-motion")).toBe(
      "push",
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onPathChange).toHaveBeenCalledWith(["root", "detail"]);
    view.rerender(
      <NavigationStack
        path={["root", "detail"]}
        onPathChange={onPathChange}
        screens={screens}
        onSelect={onSelect}
      />,
    );
    expect(view.container.querySelector("[data-place=top]")?.getAttribute("data-motion")).toBe(
      "pop",
    );
    fireEvent.click(screen.getByRole("button", { name: "X" }));
    expect(onSelect).toHaveBeenCalledWith("x", "detail");
    view.rerender(
      <NavigationStack path={["missing"]} onPathChange={onPathChange} screens={screens} />,
    );
    fireEvent.click(view.container.querySelector("button") ?? document.body);
    view.rerender(<NavigationStack path={[]} onPathChange={onPathChange} screens={screens} />);
    expect(title()?.textContent).toBe("");
  });

  it("keeps a path to push and pop", () => {
    const { result } = renderHook(() => useNavigationPath("root"));
    act(() => result.current.pop());
    expect(result.current.path).toEqual(["root"]);
    act(() => result.current.push("a"));
    act(() => result.current.push("b"));
    expect(result.current.path).toEqual(["root", "a", "b"]);
    act(() => result.current.pop());
    expect(result.current.path).toEqual(["root", "a"]);
    act(() => result.current.popToRoot());
    expect(result.current.path).toEqual(["root"]);
    act(() => result.current.setPath(["root", "z"]));
    expect(result.current.path).toEqual(["root", "z"]);
  });
});
