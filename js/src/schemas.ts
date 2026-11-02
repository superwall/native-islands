import { z } from "zod";

export const NATIVE_PROTOCOL_VERSION = 1;

export const NATIVE_CAPABILITY_GLOBAL = "__NATIVE_ISLANDS__";

export const NATIVE_MESSAGE_HANDLER = "nativeIslands";

export const NativeComponentLimits = {
  maxIslands: 256,
  maxOperationsPerBatch: 256,
  maxIdLength: 128,
  maxComponentNameLength: 64,
} as const;

const finite = z.number().finite();

export const NativeFrameSchema = z.object({
  x: finite,
  y: finite,
  width: finite.nonnegative(),
  height: finite.nonnegative(),
});

export const NativeSizeSchema = z.object({
  width: finite.nonnegative(),
  height: finite.nonnegative(),
});

export const NativeAnchorTypeSchema = z.enum(["page", "scroller", "screen"]);

export const NativeScrollerSchema = z.object({
  id: z.string().min(1),
  frame: NativeFrameSchema,
  content_size: NativeSizeSchema,
  scroll_offset: z.object({ x: finite, y: finite }),
});

export const NativeAnchorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("page") }),
  z.object({ type: z.literal("screen") }),
  z.object({ type: z.literal("scroller"), scroller: NativeScrollerSchema }),
]);

/**
 * A `position: sticky` box inside a scroller, so the host can keep the island
 * stuck itself as the scroller scrolls. Rects are in the scroller's content
 * coordinates: `box` is the sticky box where it sits unstuck, `bounds` is how
 * far it may travel (its containing block, less its margins).
 */
export const NativeStickySchema = z.object({
  top: finite.optional(),
  bottom: finite.optional(),
  box: NativeFrameSchema,
  bounds: NativeFrameSchema,
});

export const NativePropsSchema = z.record(z.string(), z.unknown());

export const NativeAccessibilitySchema = z.object({
  label: z.string().optional(),
  hint: z.string().optional(),
  value: z.string().optional(),
  traits: z.array(z.string()).optional(),
  hidden: z.boolean().optional(),
});

const componentId = z.string().min(1).max(NativeComponentLimits.maxIdLength);
const componentName = z.string().min(1).max(NativeComponentLimits.maxComponentNameLength);

export const NativeShadeSchema = NativeFrameSchema.extend({
  /** An `rgb()` or `rgba()` colour. */
  color: z.string().max(64),
});

export type TNativeShade = z.infer<typeof NativeShadeSchema>;

/**
 * The linear part of a 2D transform, as CSS `matrix(a, b, c, d, …)` writes it,
 * applied about the frame's centre.
 */
export const NativeTransformSchema = z.object({
  a: z.number().finite(),
  b: z.number().finite(),
  c: z.number().finite(),
  d: z.number().finite(),
});

export type TNativeTransform = z.infer<typeof NativeTransformSchema>;

export const NativeMountOperationSchema = z.object({
  op: z.literal("mount"),
  id: componentId,
  component: componentName,
  version: z.number().int().positive(),
  props: NativePropsSchema,
  frame: NativeFrameSchema,
  anchor: NativeAnchorSchema,
  /** Keeps the island stuck like its sticky box. Applies to the frame it comes with. */
  sticky: NativeStickySchema.optional(),
  /** The part of the island to draw, in its own coordinates. Applies to the frame it comes with. */
  clip: NativeFrameSchema.optional(),
  /** Parts of the island the page covers, cut out of it, in its own coordinates. Applies to the frame it comes with. */
  holes: z.array(NativeFrameSchema).max(8).optional(),
  /** See-through parts of the page over the island, laid over it in their colour, in its own coordinates. Applies to the frame it comes with. */
  shades: z.array(NativeShadeSchema).max(8).optional(),
  /** Rotates, scales or skews the island about its frame's centre; the frame is then its untransformed box. Applies to the frame it comes with. */
  transform: NativeTransformSchema.optional(),
  /** How opaque the page draws the island, from 0 to 1. Applies to the frame it comes with. */
  opacity: z.number().min(0).max(1).optional(),
  visible: z.boolean(),
  order: z.number().int().nonnegative(),
  sizing: z.enum(["web", "native"]),
  accessibility: NativeAccessibilitySchema.optional(),
  state_revision: z.number().int().nonnegative().optional(),
});

export const NativeUpdateOperationSchema = z.object({
  op: z.literal("update"),
  id: componentId,
  props: NativePropsSchema.optional(),
  frame: NativeFrameSchema.optional(),
  anchor: NativeAnchorSchema.optional(),
  /** Keeps the island stuck like its sticky box. Applies to the frame it comes with. */
  sticky: NativeStickySchema.optional(),
  /** The part of the island to draw, in its own coordinates. Applies to the frame it comes with. */
  clip: NativeFrameSchema.optional(),
  /** Parts of the island the page covers, cut out of it, in its own coordinates. Applies to the frame it comes with. */
  holes: z.array(NativeFrameSchema).max(8).optional(),
  /** See-through parts of the page over the island, laid over it in their colour, in its own coordinates. Applies to the frame it comes with. */
  shades: z.array(NativeShadeSchema).max(8).optional(),
  /** Rotates, scales or skews the island about its frame's centre; the frame is then its untransformed box. Applies to the frame it comes with. */
  transform: NativeTransformSchema.optional(),
  /** How opaque the page draws the island, from 0 to 1. Applies to the frame it comes with. */
  opacity: z.number().min(0).max(1).optional(),
  visible: z.boolean().optional(),
  order: z.number().int().nonnegative().optional(),
  accessibility: NativeAccessibilitySchema.optional(),
  state_revision: z.number().int().nonnegative().optional(),
});

export const NativeUnmountOperationSchema = z.object({
  op: z.literal("unmount"),
  id: componentId,
});

export const NativeOperationSchema = z.discriminatedUnion("op", [
  NativeMountOperationSchema,
  NativeUpdateOperationSchema,
  NativeUnmountOperationSchema,
]);

export const NativeErrorReasonSchema = z.enum([
  "unknown_component",
  "unsupported_version",
  "invalid_props",
  "anchor_not_found",
  "render_failed",
  "limit_exceeded",
  "duplicate_id",
]);

export const NativeCapabilitySchema = z.object({
  protocol: z.number().int().positive(),
  components: z.record(z.string(), z.unknown()),
  anchors: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
});

export const NATIVE_FEATURES = [
  "state",
  "requests",
  "commands",
  "layered",
  "sticky",
  "clip",
  "transform",
] as const;

export const NativeStateValuesSchema = z.record(z.string(), z.unknown());

export const NativeRequestIdSchema = z.string().min(1).max(NativeComponentLimits.maxIdLength);

export const NativeComponentVersionSchema = z.number().int().positive();

export type TNativeFrame = z.infer<typeof NativeFrameSchema>;
export type TNativeSize = z.infer<typeof NativeSizeSchema>;
export type TNativeAnchorType = z.infer<typeof NativeAnchorTypeSchema>;
export type TNativeScroller = z.infer<typeof NativeScrollerSchema>;
export type TNativeSticky = z.infer<typeof NativeStickySchema>;
export type TNativeAnchor = z.infer<typeof NativeAnchorSchema>;
export type TNativeProps = z.infer<typeof NativePropsSchema>;
export type TNativeAccessibility = z.infer<typeof NativeAccessibilitySchema>;
export type TNativeMountOperation = z.infer<typeof NativeMountOperationSchema>;
export type TNativeUpdateOperation = z.infer<typeof NativeUpdateOperationSchema>;
export type TNativeUnmountOperation = z.infer<typeof NativeUnmountOperationSchema>;
export type TNativeOperation = z.infer<typeof NativeOperationSchema>;
export type TNativeErrorReason = z.infer<typeof NativeErrorReasonSchema>;
export type TNativeFeature = (typeof NATIVE_FEATURES)[number];
export type TNativeStateValues = z.infer<typeof NativeStateValuesSchema>;
export type TNativeCapability = z.infer<typeof NativeCapabilitySchema>;
