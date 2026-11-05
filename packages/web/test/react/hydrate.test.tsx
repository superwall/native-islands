import { act } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineNativeComponent, NativeIslandsProvider, useNativeSupport } from "../../src/react";
import { CAPABILITY, installCapability, mockLayout, removeCapability } from "../support/react";

const Rating = defineNativeComponent<{ props: { value: number } }>("rating");

const Support = () => <output>{useNativeSupport("rating")}</output>;

const Page = () => (
  <NativeIslandsProvider>
    <Rating value={3}>
      <span>web rating</span>
    </Rating>
    <Support />
  </NativeIslandsProvider>
);

let root: Root | undefined;

beforeEach(() => {
  mockLayout();
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  removeCapability();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("hydrating server HTML in a host app", () => {
  it("matches the server, then reads the host's real support", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Page />);
    document.body.append(container);
    expect(container.querySelector("output")?.textContent).toBe("unavailable");

    installCapability({ ...CAPABILITY, components: { ...CAPABILITY.components, rating: 1 } });
    const onRecoverableError = vi.fn();
    await act(async () => {
      root = hydrateRoot(container, <Page />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.querySelector("output")?.textContent).toBe("supported");
  });
});
