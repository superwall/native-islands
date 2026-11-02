import type { NativeSupport } from "../../protocol/capability";
import { useNativeIslands } from "../provider/context";

export const useNativeSupport = (component: string, version = 1): NativeSupport =>
  useNativeIslands().supports(component, version);
