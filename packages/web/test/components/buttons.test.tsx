import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { CloseButton, GlassButton, Menu, type MenuItem } from "../../src/components";
import { removeCapability } from "../support/react";
import { installComponents, mountComponent } from "./support";

beforeEach(installComponents);

afterEach(() => {
  removeCapability();
  vi.restoreAllMocks();
});

describe("GlassButton", () => {
  it("sends its look natively and is labelled by its title", async () => {
    const onPress = vi.fn();
    const view = await mountComponent(
      <GlassButton
        title="Continue"
        prominence="prominent"
        tint="red"
        glassGroup="bar"
        onPress={onPress}
      />,
    );
    expect(view.mount).toMatchObject({
      component: "glassButton",
      props: {
        title: "Continue",
        prominence: "prominent",
        tint: "rgb(255, 0, 0)",
        glassGroup: "bar",
      },
      accessibility: { label: "Continue" },
    });
    view.event("press");
    const web = screen.getByRole("button", { name: "Continue" });
    expect(web.className).toBe("ni-glass ni-glass--pill");
    expect(web.dataset.prominent).toBe("");
    expect(web.style.getPropertyValue("--ni-tint")).toBe("red");
    fireEvent.click(web);
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it("is a circle around its icon, labelled by `label`", async () => {
    const view = await mountComponent(
      <GlassButton systemImage="plus" icon={<svg data-testid="plus" />} label="Add" disabled />,
    );
    expect(view.mount.props).toMatchObject({
      systemImage: "plus",
      prominence: "regular",
      disabled: true,
    });
    const web = screen.getByRole("button", { name: "Add" });
    expect(web.className).toBe("ni-glass ni-glass--circle");
    expect(web.dataset.prominent).toBeUndefined();
    expect(web).toHaveProperty("disabled", true);
    expect(screen.getByTestId("plus").parentElement?.className).toBe("ni-icon");
  });

  it("leaves the label to the page's own web version when it has none", async () => {
    const view = await mountComponent(
      <GlassButton systemImage="plus">
        <a href="#add">Own</a>
      </GlassButton>,
    );
    expect(view.mount.accessibility).toMatchObject({ label: "Own" });
    expect(screen.getByRole("link", { name: "Own" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps a page's accessibility over the defaults", async () => {
    const view = await mountComponent(
      <GlassButton title="Go" accessibility={{ label: "Go on", hint: "Opens the next step" }} />,
    );
    expect(view.mount.accessibility).toMatchObject({ label: "Go on", hint: "Opens the next step" });
  });
});

describe("CloseButton", () => {
  it("is labelled Close and presses from either version", async () => {
    const onPress = vi.fn();
    const view = await mountComponent(
      <CloseButton tint="blue" glassGroup="sheet" onPress={onPress} />,
    );
    expect(view.mount).toMatchObject({
      component: "closeButton",
      props: { tint: "rgb(0, 0, 255)", glassGroup: "sheet" },
      accessibility: { label: "Close" },
    });
    view.event("press");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it("takes another label, its own accessibility, or its own web version", async () => {
    await mountComponent(<CloseButton label="Done" />);
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
    const own = await mountComponent(
      <CloseButton accessibility={{ label: "Dismiss" }}>
        <span>×</span>
      </CloseButton>,
    );
    expect(own.mount.accessibility).toMatchObject({ label: "Dismiss" });
  });
});

const ITEMS: readonly MenuItem[] = [
  { id: "copy", title: "Copy", systemImage: "doc.on.doc" },
  { id: "sort", title: "Sort", children: [{ id: "name", title: "Name", checked: true }] },
  { id: "delete", title: "Delete", destructive: true },
];

describe("Menu", () => {
  it("sends its items natively and reports the one chosen", async () => {
    const onSelect = vi.fn();
    const view = await mountComponent(
      <Menu title="Edit" prominence="prominent" tint="red" items={ITEMS} onSelect={onSelect} />,
    );
    expect(view.mount).toMatchObject({
      component: "menu",
      props: { title: "Edit", items: ITEMS, prominence: "prominent" },
      accessibility: { label: "Edit" },
    });
    view.event("select", { id: "copy" });
    expect(onSelect).toHaveBeenCalledWith("copy");
  });

  it("opens a popover on the web, with submenus, and closes on a choice", async () => {
    const onSelect = vi.fn();
    await mountComponent(<Menu title="Edit" items={ITEMS} onSelect={onSelect} />);
    const trigger = screen.getByRole("button", { name: "Edit" });
    expect(trigger.className).toBe("ni-glass ni-glass--pill");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Delete" }).dataset.destructive).toBe("");
    const sort = screen.getByRole("menuitem", { name: "Sort" });
    expect(sort.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(sort);
    expect(sort.getAttribute("aria-expanded")).toBe("true");
    const name = screen.getByRole("menuitemcheckbox", { name: "Name" });
    expect(name.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(name);
    expect(onSelect).toHaveBeenCalledWith("name");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes a submenu again and closes from the backdrop", async () => {
    const view = await mountComponent(
      <Menu systemImage="ellipsis" icon={<svg />} label="More" items={ITEMS} onSelect={() => {}} />,
    );
    const trigger = screen.getByRole("button", { name: "More" });
    expect(trigger.className).toBe("ni-glass ni-glass--circle");
    fireEvent.click(trigger);
    const sort = screen.getByRole("menuitem", { name: "Sort" });
    fireEvent.click(sort);
    fireEvent.click(sort);
    expect(screen.queryByRole("menuitemcheckbox")).toBeNull();
    const backdrop = view.container.querySelector(".ni-menu-backdrop");
    if (!(backdrop instanceof HTMLElement)) throw new Error("No backdrop.");
    fireEvent.click(backdrop);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("leaves the label to its own web version without a title or label", async () => {
    const view = await mountComponent(
      <Menu systemImage="ellipsis" items={ITEMS} onSelect={() => {}}>
        <span>Own</span>
      </Menu>,
    );
    expect(view.mount.accessibility).toMatchObject({ label: "Own" });
    const labelled = await mountComponent(
      <Menu
        title="Edit"
        accessibility={{ label: "Edit text" }}
        items={ITEMS}
        onSelect={() => {}}
      />,
    );
    expect(labelled.mount.accessibility).toMatchObject({ label: "Edit text" });
  });
});
