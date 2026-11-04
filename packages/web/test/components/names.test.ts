import { describe, expect, it } from "vitest";
import swift from "../../../swift/Sources/NativeIslandsComponents/NativeIslandsComponents.swift?raw";
import * as components from "../../src/components";

/** The names `NativeIslandsComponents.Component` registers, read from its Swift source. */
const swiftNames = () => {
  const body = /enum Component: String[^{]*\{([\s\S]*?)\n\s*\/\/\/ The name/.exec(swift)?.[1] ?? "";
  return [...body.matchAll(/^\s*case (\w+)$/gm)].map((match) => match[1]).toSorted();
};

const webNames = () =>
  [
    ...new Set(
      Object.values(components).flatMap((value) =>
        typeof value === "function" && "componentName" in value ? [value.componentName] : [],
      ),
    ),
  ].toSorted();

describe("component names", () => {
  it("match the Swift library one for one", () => {
    expect(swiftNames()).toHaveLength(14);
    expect(webNames()).toEqual(swiftNames());
  });
});
