import { vi } from "vitest";

export const rectAttribute = (x: number, y: number, width: number, height: number) =>
  `${x},${y},${width},${height}`;

export const mockLayout = () =>
  vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      const [x = 0, y = 0, width = 0, height = 0] = (this.dataset.rect ?? "0,0,0,0")
        .split(",")
        .map(Number);
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

let overrides = new WeakMap<Element, Record<string, string>>();
let styleSpy: unknown;

export const overrideStyle = (element: Element, values: Record<string, string>) => {
  overrides.set(element, { ...overrides.get(element), ...values });
  if (styleSpy) return;
  const original = window.getComputedStyle.bind(window);
  styleSpy = vi.spyOn(window, "getComputedStyle").mockImplementation((target, pseudo) => {
    const style = original(target, pseudo);
    const extra = overrides.get(target);
    if (!extra) return style;
    return new Proxy(style, {
      get: (base, key) => {
        if (typeof key === "string" && key in extra) return extra[key];
        const value = Reflect.get(base, key, base);
        return typeof value === "function" ? value.bind(base) : value;
      },
    });
  });
};

export const resetStyleOverrides = () => {
  overrides = new WeakMap();
  styleSpy = undefined;
};

export const setScrollGeometry = (
  element: HTMLElement,
  geometry: Partial<
    Record<
      | "scrollTop"
      | "scrollLeft"
      | "scrollHeight"
      | "scrollWidth"
      | "clientHeight"
      | "clientWidth"
      | "clientTop"
      | "clientLeft",
      number
    >
  >,
) => {
  for (const [key, value] of Object.entries(geometry)) {
    Object.defineProperty(element, key, { value, configurable: true, writable: true });
  }
};
