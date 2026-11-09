import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
import * as React from "react";
import {
  ColorPicker,
  DatePicker,
  Picker,
  SegmentedControl,
  Slider,
  Stepper,
  TextField,
  Toggle,
  type TextFieldHandle,
} from "../../src/components";
import { WHEEL_ROW } from "../../src/components/controls";
import { removeCapability, renderNative } from "../support/react";
import { installComponents, mountComponent } from "./support";

beforeEach(installComponents);

afterEach(() => {
  removeCapability();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Toggle", () => {
  it("is sized natively and switches from either version", async () => {
    const onChange = vi.fn();
    const view = await mountComponent(
      <Toggle label="Wi-Fi" isOn={false} tint="green" onChange={onChange} />,
    );
    expect(view.mount).toMatchObject({
      component: "toggle",
      sizing: "native",
      props: { isOn: false, tint: "rgb(0, 128, 0)" },
      accessibility: { label: "Wi-Fi" },
    });
    view.state({ isOn: true });
    const web = screen.getByRole("switch", { name: "Wi-Fi" });
    expect(web.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(web);
    expect(onChange.mock.calls).toEqual([[true], [true]]);
  });

  it("takes its own web version and accessibility", async () => {
    const view = await mountComponent(
      <Toggle label="Wi-Fi" isOn accessibility={{ label: "Wireless" }} onChange={() => {}}>
        <span>On</span>
      </Toggle>,
    );
    expect(view.mount.accessibility).toMatchObject({ label: "Wireless" });
    expect(screen.queryByRole("switch")).toBeNull();
  });
});

describe("SegmentedControl", () => {
  it("sends its segments and reports the one chosen", async () => {
    const onChange = vi.fn();
    const view = await mountComponent(
      <SegmentedControl
        label="View"
        segments={["Day", "Week"]}
        selectedIndex={0}
        glassGroup="bar"
        onChange={onChange}
      />,
    );
    expect(view.mount).toMatchObject({
      component: "segmentedControl",
      props: { segments: ["Day", "Week"], selectedIndex: 0, glassGroup: "bar" },
      accessibility: { label: "View", value: "Day" },
    });
    view.state({ selectedIndex: 1 });
    expect(screen.getByRole("button", { name: "Day" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(onChange.mock.calls).toEqual([[1], [1]]);
  });
});

describe("Slider", () => {
  it("sends its range, follows native state and fills its web track", async () => {
    const onChange = vi.fn();
    const view = await mountComponent(
      <Slider
        label="Volume"
        value={25}
        minimum={0}
        maximum={100}
        step={5}
        minimumSymbol="speaker"
        maximumSymbol="speaker.wave.3"
        minimumIcon={<svg data-testid="low" />}
        maximumIcon={<svg data-testid="high" />}
        tint="red"
        onChange={onChange}
      />,
    );
    expect(view.mount).toMatchObject({
      component: "slider",
      props: { value: 25, minimum: 0, maximum: 100, step: 5, minimumSymbol: "speaker" },
    });
    view.state({ value: 40 });
    view.state({ other: 1 });
    const range = screen.getByRole("slider", { name: "Volume" });
    expect(range.style.getPropertyValue("--ni-fill")).toBe("25%");
    expect(range.getAttribute("step")).toBe("5");
    fireEvent.change(range, { target: { value: "60" } });
    expect(onChange.mock.calls).toEqual([[40], [60]]);
    expect(screen.getByTestId("low")).toBeTruthy();
    expect(screen.getByTestId("high")).toBeTruthy();
  });

  it("runs from 0 to 1 by default, at any step", async () => {
    const view = await mountComponent(<Slider label="Level" value={0.5} onChange={() => {}} />);
    expect(view.mount.props).toMatchObject({ minimum: 0, maximum: 1 });
    expect(screen.getByRole("slider").getAttribute("step")).toBe("any");
  });
});

describe("Stepper", () => {
  it("steps within its range from either version", async () => {
    const onChange = vi.fn();
    const view = await mountComponent(
      <Stepper label="Guests" value={1} minimum={1} maximum={2} onChange={onChange} />,
    );
    expect(view.mount).toMatchObject({
      component: "stepper",
      props: { value: 1, minimum: 1, maximum: 2, step: 1 },
      accessibility: { label: "Guests", value: "1" },
    });
    view.state({ value: 2 });
    view.state({});
    expect(screen.getByRole("button", { name: "Decrement" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Increment" }));
    expect(onChange.mock.calls).toEqual([[2], [2]]);
  });

  it("steps down and stops at the top, or not at all when disabled", async () => {
    const onChange = vi.fn();
    const view = await mountComponent(
      <Stepper label="Guests" value={2} minimum={1} maximum={2} step={1} onChange={onChange} />,
    );
    expect(screen.getByRole("button", { name: "Increment" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Decrement" }));
    expect(onChange).toHaveBeenCalledWith(1);
    view.rerender(
      <Stepper label="Guests" value={1} minimum={0} maximum={2} disabled onChange={onChange} />,
    );
    expect(screen.getByRole("button", { name: "Decrement" })).toHaveProperty("disabled", true);
  });
});

describe("Picker", () => {
  it("is a native-sized menu by default, with a select on the web", async () => {
    const onChange = vi.fn();
    const view = await mountComponent(
      <Picker
        label="Size"
        options={["S", "M", "L"]}
        selectedIndex={1}
        tint="red"
        onChange={onChange}
      />,
    );
    expect(view.mount).toMatchObject({
      component: "picker",
      sizing: "native",
      props: { options: ["S", "M", "L"], selectedIndex: 1, style: "menu" },
      accessibility: { label: "Size", value: "M" },
    });
    view.state({ selectedIndex: 2 });
    view.state({});
    fireEvent.change(screen.getByRole("combobox", { name: "Size" }), { target: { value: "0" } });
    expect(onChange.mock.calls).toEqual([[2], [0]]);
  });

  it("is a wheel that fills its box, snapping a row after scrolling", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const onChange = vi.fn();
    const view = renderWheel(onChange);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
      view.islands.flush();
    });
    const wheel = screen.getByRole("listbox", { name: "Size" });
    expect(wheel.scrollTop).toBe(WHEEL_ROW);
    wheel.scrollTop = WHEEL_ROW * 2 + 4;
    fireEvent.scroll(wheel);
    fireEvent.scroll(wheel);
    await act(() => vi.advanceTimersByTimeAsync(120));
    expect(onChange).toHaveBeenCalledWith(2);
    wheel.scrollTop = WHEEL_ROW;
    fireEvent.scroll(wheel);
    await act(() => vi.advanceTimersByTimeAsync(120));
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("option", { name: "S" }));
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(screen.getByRole("option", { name: "M" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.scroll(wheel);
    view.unmount();
    await act(() => vi.advanceTimersByTimeAsync(120));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("keeps the wheel where it is when the row already matches", async () => {
    const view = await mountComponent(
      <Picker
        label="Size"
        style="wheel"
        options={["S", "M"]}
        selectedIndex={0}
        onChange={() => {}}
      />,
    );
    expect(view.mount).toMatchObject({
      component: "picker",
      sizing: "web",
      props: { style: "wheel" },
    });
    expect(screen.getByRole("listbox").scrollTop).toBe(0);
  });
});

const renderWheel = (onChange: (index: number) => void) =>
  renderNative(
    <Picker
      label="Size"
      style="wheel"
      options={["S", "M", "L"]}
      selectedIndex={1}
      onChange={onChange}
    />,
  );

describe("DatePicker", () => {
  it("is a pill that edits the date, and follows native state", async () => {
    const onChange = vi.fn();
    const view = await mountComponent(
      <DatePicker label="Day" date="2026-11-04T09:30" tint="red" onChange={onChange} />,
    );
    expect(view.mount).toMatchObject({
      component: "datePicker",
      props: { date: "2026-11-04T09:30", components: "date", style: "compact" },
    });
    view.state({ date: "2026-11-05T09:30" });
    view.state({});
    const input = screen.getByLabelText("Day");
    expect(input).toHaveProperty("value", "2026-11-04");
    fireEvent.change(input, { target: { value: "2026-12-01" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange.mock.calls).toEqual([["2026-11-05T09:30"], ["2026-12-01T09:30"]]);
  });

  it("edits only the time in a time pill", async () => {
    const onChange = vi.fn();
    await mountComponent(
      <DatePicker label="Alarm" date="2026-11-04T09:30" components="time" onChange={onChange} />,
    );
    const input = screen.getByLabelText("Alarm");
    expect(input).toHaveProperty("value", "09:30");
    fireEvent.change(input, { target: { value: "07:15" } });
    expect(onChange).toHaveBeenCalledWith("2026-11-04T07:15");
  });

  it("falls back to a valid date when given one it cannot read", async () => {
    const view = await mountComponent(<DatePicker label="Day" date="soon" onChange={() => {}} />);
    expect(view.mount.props).toMatchObject({ date: "2026-01-01T09:00" });
  });

  it("is a calendar that moves between months and picks a day", async () => {
    const onChange = vi.fn();
    const view = await mountComponent(
      <DatePicker label="Day" style="graphical" date="2026-11-04T09:30" onChange={onChange} />,
    );
    expect(screen.getByRole("button", { name: "4" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.queryByRole("button", { pressed: true })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "9" }));
    expect(onChange).toHaveBeenCalledWith("2026-10-09T09:30");
    view.rerender(<DatePicker label="Day" style="graphical" date="bad" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "1" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("is a pair of hour and minute wheels", async () => {
    const onChange = vi.fn();
    await mountComponent(
      <DatePicker
        label="Time"
        style="wheel"
        components="time"
        date="2026-11-04T09:30"
        onChange={onChange}
      />,
    );
    const hours = within(screen.getByRole("listbox", { name: "Hour" }));
    const minutes = within(screen.getByRole("listbox", { name: "Minute" }));
    expect(hours.getByRole("option", { name: "09" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(hours.getByRole("option", { name: "07" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-11-04T07:30");
    fireEvent.click(minutes.getByRole("option", { name: "45" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-11-04T09:45");
  });
});

describe("ColorPicker", () => {
  it("sends its colour and reports the one chosen", async () => {
    const onChange = vi.fn();
    const view = await mountComponent(
      <ColorPicker label="Accent" color="#ff0000" onChange={onChange} />,
    );
    expect(view.mount).toMatchObject({
      component: "colorPicker",
      props: { color: "rgb(255, 0, 0)" },
      accessibility: { label: "Accent" },
    });
    view.state({ color: "#00ff00" });
    view.state({});
    const input = screen.getByLabelText("Accent");
    expect(input.parentElement?.style.getPropertyValue("--ni-well")).toBe("#ff0000");
    fireEvent.input(input, { target: { value: "#0000ff" } });
    expect(onChange.mock.calls).toEqual([["#00ff00"], ["#0000ff"]]);
  });
});

describe("TextField", () => {
  it("sends its text and reports changes, submits and focus from either version", async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const onFocusChange = vi.fn();
    const view = await mountComponent(
      <TextField
        label="Email"
        text="a"
        kind="email"
        submitLabel="done"
        placeholder="you@example.com"
        tint="red"
        onChange={onChange}
        onSubmit={onSubmit}
        onFocusChange={onFocusChange}
      />,
    );
    expect(view.mount).toMatchObject({
      component: "textField",
      props: { text: "a", kind: "email", submitLabel: "done", placeholder: "you@example.com" },
    });
    view.state({ text: "ab" });
    view.state({});
    view.event("submit", { text: "ab" });
    view.event("focusChange", { focused: true });
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input.getAttribute("type")).toBe("email");
    expect(input.getAttribute("enterkeyhint")).toBe("done");
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.focus(input);
    fireEvent.blur(input);
    fireEvent.keyDown(input, { key: "a" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange.mock.calls).toEqual([["ab"], ["abc"]]);
    expect(onSubmit.mock.calls).toEqual([["ab"], ["a"]]);
    expect(onFocusChange.mock.calls).toEqual([[true], [true], [false]]);
  });

  it("works without submit or focus handlers", async () => {
    const view = await mountComponent(
      <TextField label="Code" text="" kind="number" onChange={() => {}} />,
    );
    view.event("submit", { text: "1" });
    view.event("focusChange", { focused: true });
    const input = screen.getByRole("textbox", { name: "Code" });
    expect(input.getAttribute("inputmode")).toBe("decimal");
    fireEvent.focus(input);
    fireEvent.blur(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.getAttribute("type")).toBe("text");
  });

  it("is a password field for secure text", async () => {
    const view = await mountComponent(
      <TextField label="Password" text="" kind="secure" onChange={() => {}} />,
    );
    expect(view.container.querySelector("input")?.getAttribute("type")).toBe("password");
  });

  it("moves the keyboard natively, and falls back to the web field when the host refuses", async () => {
    const handle = React.createRef<TextFieldHandle>();
    const view = await mountComponent(
      <TextField label="Name" text="" handle={handle} onChange={() => {}} />,
    );
    const input = screen.getByRole("textbox", { name: "Name" });
    await act(async () => handle.current?.focus());
    const command = view.outgoing.find(
      (message) => message.event_name === "native_component_command",
    );
    if (command?.event_name !== "native_component_command") throw new Error("No command was sent.");
    expect(command).toMatchObject({ id: view.mount.id, name: "focus" });
    view.send({
      event_name: "native_component_reply",
      request_id: command.request_id,
      ok: false,
      error: "No keyboard.",
    });
    await act(async () => {});
    expect(document.activeElement).toBe(input);
    await act(async () => handle.current?.blur());
    const blur = view.outgoing.findLast(
      (message) => message.event_name === "native_component_command",
    );
    if (blur?.event_name !== "native_component_command") throw new Error("No command was sent.");
    expect(blur).toMatchObject({ name: "blur" });
    view.send({
      event_name: "native_component_reply",
      request_id: blur.request_id,
      ok: false,
      error: "No keyboard.",
    });
    await act(async () => {});
    expect(document.activeElement).not.toBe(input);
  });
});
