import { describe, expect, it } from "vitest";
import swift from "../../../swift/Sources/NativeIslandsComponents/NativeIslandsComponents.swift?raw";
import camera from "../../../swift/Sources/NativeIslandsCamera/NativeIslandsCamera.swift?raw";
import maps from "../../../swift/Sources/NativeIslandsMaps/NativeIslandsMaps.swift?raw";
import permissions from "../../../swift/Sources/NativeIslandsPermissions/NativeIslandsPermissions.swift?raw";
import * as components from "../../src/components";

/**
 * The names the Swift libraries register, read from their sources: the cases
 * of `NativeIslandsComponents.Component`, and the `name` of the other three.
 */
const swiftNames = () => {
  const body = /enum Component: String[^{]*\{([\s\S]*?)\n\s*\/\/\/ The name/.exec(swift)?.[1] ?? "";
  const cases = [...body.matchAll(/^\s*case (\w+)$/gm)].map((match) => match[1]);
  const singles = [maps, camera, permissions].map(
    (source) => /public static let name = "(\w+)"/.exec(source)?.[1],
  );
  return [...cases, ...singles].toSorted();
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
    expect(swiftNames()).toHaveLength(23);
    expect(webNames()).toEqual(swiftNames());
  });
});
