// @vitest-environment node
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defineNativeComponent,
  Native,
  NativeIslandsProvider,
  useNativeSupport,
} from "../../src/react";

const Rating = defineNativeComponent<{ props: { value: number } }>("rating");

const Support = () => <output>{useNativeSupport("rating")}</output>;

const Page = () => (
  <NativeIslandsProvider>
    <Rating value={3}>
      <span>web rating</span>
    </Rating>
    <Native component="glassButton">
      <button type="button">web button</button>
    </Native>
    <Support />
  </NativeIslandsProvider>
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NativeIslandsProvider on the server", () => {
  it("renders the web version of every island without a window, and logs nothing", () => {
    expect(typeof window).toBe("undefined");
    const logged = [
      vi.spyOn(console, "error").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
    ];
    const html = renderToString(<Page />);
    expect(html).toContain("web rating");
    expect(html).toContain("web button");
    expect(html.match(/data-island-mode="web"/g)).toHaveLength(2);
    expect(html).not.toMatch(/data-island-mode="(native|pending)"/);
    expect(html).toContain("<output>unavailable</output>");
    for (const spy of logged) expect(spy).not.toHaveBeenCalled();
  });
});
