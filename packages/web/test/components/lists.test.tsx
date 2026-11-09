import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { List, deleteRows, moveRow, type ListSection } from "../../src/components";
import { removeCapability, renderNative } from "../support/react";
import { installComponents, mountComponent } from "./support";

beforeEach(installComponents);

afterEach(() => {
  removeCapability();
  vi.restoreAllMocks();
});

const renderWeb = (ui: React.ReactElement) => {
  removeCapability();
  return renderNative(ui);
};

const SECTIONS: readonly ListSection[] = [
  {
    id: "main",
    header: "Main",
    footer: "The end",
    rows: [
      {
        id: "wifi",
        title: "Wi-Fi",
        subtitle: "Home",
        systemImage: "wifi",
        iconTint: "#0a84ff",
        value: "On",
        badge: 2,
        accessory: "chevron",
        leadingActions: [{ id: "pin", title: "Pin" }],
        trailingActions: [{ id: "delete", title: "Delete", role: "destructive", tint: "#f00" }],
      },
      { id: "info", title: "Info", systemImage: "info", accessory: "info" },
      { id: "erase", title: "Erase", role: "destructive", disabled: true },
      {
        id: "docs",
        title: "Docs",
        children: [{ id: "cv", title: "CV", children: [{ id: "page", title: "Page" }] }],
      },
    ],
  },
  { id: "other", rows: [{ id: "x", title: "X" }] },
];

describe("List", () => {
  it("mounts rows natively and hears taps, actions, edits and its height", async () => {
    const onPress = vi.fn();
    const onAction = vi.fn();
    const onSelectedChange = vi.fn();
    const onExpandedChange = vi.fn();
    const onSectionsChange = vi.fn();
    const view = await mountComponent(
      <List
        sections={SECTIONS}
        style="plain"
        selectionMode="multiple"
        editing
        reorderable
        deletable
        tint="#00f"
        onPress={onPress}
        onAction={onAction}
        onSelectedChange={onSelectedChange}
        onExpandedChange={onExpandedChange}
        onSectionsChange={onSectionsChange}
      />,
    );
    expect(view.mount).toMatchObject({
      component: "list",
      props: {
        style: "plain",
        selectionMode: "multiple",
        selected: [],
        expanded: [],
        editing: true,
      },
    });
    view.event("press", { id: "wifi" });
    view.event("action", { row: "wifi", id: "pin" });
    expect(onPress).toHaveBeenCalledWith("wifi");
    expect(onAction).toHaveBeenCalledWith("wifi", "pin");
    await view.state({
      selected: ["wifi"],
      expanded: ["docs"],
      sections: [SECTIONS[1]],
      contentHeight: 200,
    });
    expect(onSelectedChange).toHaveBeenCalledWith(["wifi"]);
    expect(onExpandedChange).toHaveBeenCalledWith(["docs"]);
    expect(onSectionsChange).toHaveBeenCalledWith([SECTIONS[1]]);
    expect(view.container.querySelector<HTMLElement>(".ni-list")?.style.height).toBe("200px");
  });

  it("runs without handlers natively", async () => {
    const view = await mountComponent(<List sections={SECTIONS} />);
    view.event("press", { id: "wifi" });
    view.event("action", { row: "wifi", id: "pin" });
    await view.state({ selected: ["wifi"], sections: [] });
  });

  it("draws the same rows on the web, and selects, expands and acts", () => {
    const onPress = vi.fn();
    const onAction = vi.fn();
    const onSelectedChange = vi.fn();
    const view = renderWeb(
      <List
        sections={SECTIONS}
        selectionMode="multiple"
        selected={["info"]}
        icon={(name) => <i data-symbol={name} />}
        onPress={onPress}
        onAction={onAction}
        onSelectedChange={onSelectedChange}
      />,
    );
    expect(screen.getByRole("heading", { name: "Main" })).toBeTruthy();
    expect(screen.getByText("The end")).toBeTruthy();
    const main = screen.getByRole("list", { name: "Main" });
    expect(within(main).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Info", pressed: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Docs/, expanded: false })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Wi-Fi/ }));
    expect(onSelectedChange).toHaveBeenLastCalledWith(["info", "wifi"]);
    expect(onPress).toHaveBeenCalledWith("wifi");
    fireEvent.click(screen.getByRole("button", { name: /^Info/ }));
    expect(onSelectedChange).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByRole("button", { name: "Pin" }));
    expect(onAction).toHaveBeenCalledWith("wifi", "pin");
    fireEvent.click(screen.getByRole("button", { name: "Expand Docs" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand CV" }));
    expect(screen.getByText("Page")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Collapse Docs" }));
    expect(screen.queryByText("CV")).toBeNull();
    // A tap on the row itself opens it too, and still reports the press.
    fireEvent.click(screen.getByRole("button", { name: /^Docs/ }));
    expect(screen.getByText("CV")).toBeTruthy();
    expect(onPress).toHaveBeenLastCalledWith("docs");
    expect(view.container.querySelector("[data-symbol=wifi]")).not.toBeNull();
  });

  it("selects one at a time, or none, and works without handlers", () => {
    const onSelectedChange = vi.fn();
    renderWeb(
      <List sections={SECTIONS} selectionMode="single" onSelectedChange={onSelectedChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Wi-Fi/ }));
    expect(onSelectedChange).toHaveBeenCalledWith(["wifi"]);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const view = renderWeb(<List sections={SECTIONS} expanded={["docs"]} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Wi-Fi/ })[1] ?? document.body);
    fireEvent.click(screen.getAllByRole("button", { name: "Pin" })[1] ?? document.body);
    expect(view.container.textContent).toContain("CV");
    const own = renderWeb(
      <List sections={[]}>
        <p>Mine</p>
      </List>,
    );
    expect(own.container.textContent).toBe("Mine");
  });

  it("deletes and moves rows in edit mode on the web", () => {
    const onSectionsChange = vi.fn();
    renderWeb(
      <List
        sections={SECTIONS}
        editing
        reorderable
        deletable
        onSectionsChange={onSectionsChange}
      />,
    );
    expect(screen.queryByRole("button", { name: "Pin" })).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Move Wi-Fi up" }).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Move Info up" }));
    expect(
      onSectionsChange.mock.calls[0]?.[0][0].rows.map((row: { id: string }) => row.id),
    ).toEqual(["info", "wifi", "erase", "docs"]);
    fireEvent.click(screen.getByRole("button", { name: "Delete X" }));
    expect(onSectionsChange.mock.calls[1]?.[0][1].rows).toEqual([]);
  });

  it("shows only the edit controls it has, and none outside edit mode, with no handler", () => {
    const deleting = renderWeb(<List sections={SECTIONS} editing deletable />);
    expect(screen.queryByRole("button", { name: "Move Info up" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete Info" }));
    deleting.unmount();
    const moving = renderWeb(<List sections={SECTIONS} editing reorderable />);
    expect(screen.queryByRole("button", { name: "Delete Info" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Move Info up" }));
    moving.unmount();
    const view = renderWeb(<List sections={SECTIONS} editing />);
    expect(view.container.querySelector(".ni-list-edit")).toBeNull();
  });
});

describe("moveRow and deleteRows", () => {
  it("change only the section they name, and keep a move in bounds", () => {
    expect(moveRow(SECTIONS, "other", 0, 5)[1]?.rows.map((row) => row.id)).toEqual(["x"]);
    expect(moveRow(SECTIONS, "other", 3, 0)[1]?.rows).toEqual([{ id: "x", title: "X" }]);
    expect(moveRow(SECTIONS, "main", 0, -1)[0]?.rows[0]?.id).toBe("wifi");
    expect(moveRow(SECTIONS, "main", 0, 9)[1]).toBe(SECTIONS[1]);
    expect(deleteRows(SECTIONS, "main", ["wifi", "info"])[0]?.rows.map((row) => row.id)).toEqual([
      "erase",
      "docs",
    ]);
  });
});
