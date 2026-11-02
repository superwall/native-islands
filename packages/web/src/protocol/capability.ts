import {
  NATIVE_CAPABILITY_GLOBAL,
  NativeAnchorTypeSchema,
  NativeCapabilitySchema,
  NativeComponentLimits,
  NativeComponentVersionSchema,
  NATIVE_FEATURES,
  type TNativeAnchorType,
  type TNativeFeature,
} from "./schemas";
import { hostWindow } from "../bridge/transport";

export type NativeCapability = {
  protocol: number;
  components: Readonly<Record<string, number>>;
  anchors?: readonly TNativeAnchorType[];
  features: readonly TNativeFeature[];
};

export type NativeCapabilityResult =
  | { status: "absent" }
  | { status: "invalid"; reason: string }
  | { status: "available"; capability: NativeCapability; ignored: readonly string[] };

export type NativeSupport =
  | "supported"
  | "unavailable"
  | "unknown_component"
  | "unsupported_version";

export const nativeCapabilityFromGlobal = (): unknown =>
  typeof window === "undefined" ? undefined : hostWindow()[NATIVE_CAPABILITY_GLOBAL];

const isNativeFeature = (feature: string): feature is TNativeFeature =>
  NATIVE_FEATURES.some((known) => known === feature);

const validName = (name: string) =>
  name.length > 0 && name.length <= NativeComponentLimits.maxComponentNameLength;

export const readNativeCapability = (value: unknown): NativeCapabilityResult => {
  if (value === undefined || value === null) return { status: "absent" };
  const parsed = NativeCapabilitySchema.safeParse(value);
  if (!parsed.success) {
    return {
      status: "invalid",
      reason: parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "capability"}: ${issue.message}`)
        .join("; "),
    };
  }
  const ignored: string[] = [];
  const components: Record<string, number> = Object.create(null);
  for (const [name, version] of Object.entries(parsed.data.components)) {
    const known = NativeComponentVersionSchema.safeParse(version);
    if (validName(name) && known.success) {
      components[name] = known.data;
    } else {
      ignored.push(`component ${JSON.stringify(name)}`);
    }
  }
  let anchors: TNativeAnchorType[] | undefined;
  if (parsed.data.anchors) {
    anchors = [];
    for (const anchor of parsed.data.anchors) {
      const known = NativeAnchorTypeSchema.safeParse(anchor);
      if (known.success) anchors.push(known.data);
      else ignored.push(`anchor ${JSON.stringify(anchor)}`);
    }
  }
  const features: TNativeFeature[] = [];
  for (const feature of parsed.data.features ?? []) {
    if (isNativeFeature(feature)) {
      features.push(feature);
    } else {
      ignored.push(`feature ${JSON.stringify(feature)}`);
    }
  }
  return {
    status: "available",
    capability: {
      protocol: parsed.data.protocol,
      components,
      ...(anchors === undefined ? {} : { anchors }),
      features,
    },
    ignored,
  };
};

export const nativeSupport = (
  result: NativeCapabilityResult,
  component: string,
  version: number,
): NativeSupport => {
  if (result.status !== "available") return "unavailable";
  const registered = result.capability.components[component];
  if (registered === undefined) return "unknown_component";
  return registered >= version ? "supported" : "unsupported_version";
};

export const supportsAnchor = (result: NativeCapabilityResult, anchor: TNativeAnchorType) =>
  result.status === "available" &&
  (result.capability.anchors === undefined || result.capability.anchors.includes(anchor));

export const supportsFeature = (result: NativeCapabilityResult, feature: TNativeFeature) =>
  result.status === "available" && result.capability.features.includes(feature);

export const describeNativeCapability = (result: NativeCapabilityResult): string | undefined => {
  if (result.status === "invalid") {
    return `The host's native island capability is malformed, so every island shows its web version: ${result.reason}.`;
  }
  if (result.status === "available" && result.ignored.length > 0) {
    return `Ignored parts of the host's native island capability this page does not understand: ${result.ignored.join(", ")}.`;
  }
  return undefined;
};
