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
  color: z.string().max(64),
});

export type TNativeShade = z.infer<typeof NativeShadeSchema>;

export const NativeTransformSchema = z.object({
  a: z.number().finite(),
  b: z.number().finite(),
  c: z.number().finite(),
  d: z.number().finite(),
});

export type TNativeTransform = z.infer<typeof NativeTransformSchema>;

export const NativeMotionKeyframeSchema = z.object({
  offset: z.number().min(0).max(1),
  x: finite,
  y: finite,
});

export const NativeEasingSchema = z.tuple([finite, finite, finite, finite]);

const offsetsOf = (keyframes: readonly { offset: number }[]) =>
  keyframes.map((frame) => frame.offset);

const ascending = (keyframes: readonly { offset: number }[]) =>
  offsetsOf(keyframes).every(
    (offset, index, offsets) => offset >= Math.max(0, ...offsets.slice(0, index)),
  );

const MotionKeyframesSchema = z
  .array(NativeMotionKeyframeSchema)
  .min(2)
  .max(16)
  .refine(ascending, "Keyframe offsets must not go down.");

/**
 * A slide the host runs on the native view itself, as WebKit runs the page's
 * CSS animation: the island's `frame` is where it rests, and each keyframe is
 * an offset from there. `elapsed` is how far in it was when measured, in ms.
 * `cover` is a box above the island that slides with it, in the island's own
 * coordinates, which the host cuts out of it as it moves.
 */
export const NativeMotionSchema = z
  .object({
    keyframes: MotionKeyframesSchema,
    easings: z
      .array(
        NativeEasingSchema.refine(
          ([x1, , x2]) => x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1,
          "An easing's control points must lie within the slide's time.",
        ),
      )
      .max(15)
      .optional(),
    duration: z.number().positive().max(10_000),
    elapsed: z.number().min(-10_000).max(10_000),
    fill: z.enum(["none", "forwards", "backwards", "both"]).optional(),
    cover: z
      .object({
        frame: NativeFrameSchema,
        keyframes: MotionKeyframesSchema,
      })
      .optional(),
  })
  .refine(
    ({ keyframes, easings }) => !easings || easings.length === keyframes.length - 1,
    "A slide needs one easing per segment.",
  )
  .refine(
    ({ keyframes, cover }) =>
      !cover || offsetsOf(cover.keyframes).join() === offsetsOf(keyframes).join(),
    "A cover's keyframes must fall at the slide's own offsets.",
  );

export type TNativeMotion = z.infer<typeof NativeMotionSchema>;
export type TNativeMotionKeyframe = z.infer<typeof NativeMotionKeyframeSchema>;

export const NativeMountOperationSchema = z.object({
  op: z.literal("mount"),
  id: componentId,
  component: componentName,
  version: z.number().int().positive(),
  props: NativePropsSchema,
  frame: NativeFrameSchema,
  anchor: NativeAnchorSchema,
  sticky: NativeStickySchema.optional(),
  clip: NativeFrameSchema.optional(),
  holes: z.array(NativeFrameSchema).max(8).optional(),
  shades: z.array(NativeShadeSchema).max(8).optional(),
  transform: NativeTransformSchema.optional(),
  opacity: z.number().min(0).max(1).optional(),
  motion: NativeMotionSchema.optional(),
  visible: z.boolean(),
  order: z.number().int().nonnegative(),
  sizing: z.enum(["web", "native"]),
  accessibility: NativeAccessibilitySchema.optional(),
  state_revision: z.number().int().nonnegative().optional(),
  reuse: componentId.optional(),
});

export const NativeUpdateOperationSchema = z.object({
  op: z.literal("update"),
  id: componentId,
  props: NativePropsSchema.optional(),
  frame: NativeFrameSchema.optional(),
  anchor: NativeAnchorSchema.optional(),
  sticky: NativeStickySchema.optional(),
  clip: NativeFrameSchema.optional(),
  holes: z.array(NativeFrameSchema).max(8).optional(),
  shades: z.array(NativeShadeSchema).max(8).optional(),
  transform: NativeTransformSchema.optional(),
  opacity: z.number().min(0).max(1).optional(),
  motion: NativeMotionSchema.optional(),
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
  "motion",
  "reuse",
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
