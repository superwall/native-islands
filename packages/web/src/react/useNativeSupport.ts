import type { NativeSupport } from "../capability";
import { useNativeIslands } from "./context";

/**
 * Whether the host offers `component` at `version` (default `1`) or later:
 * `"supported"`, `"unavailable"`, `"unknown_component"` or `"unsupported_version"`.
 */
export const useNativeSupport = (component: string, version = 1): NativeSupport =>
  useNativeIslands().supports(component, version);
