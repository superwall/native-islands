import { z } from "zod";
import {
  NATIVE_PROTOCOL_VERSION,
  NativeComponentLimits,
  NativeErrorReasonSchema,
  NativeOperationSchema,
  NativeRequestIdSchema,
  NativeSizeSchema,
  NativeStateValuesSchema,
} from "./schemas";

const islandId = z.string().min(1).max(NativeComponentLimits.maxIdLength);
const sequence = z.number().int().positive();

export const NativeComponentBatchSchema = z.object({
  event_name: z.literal("native_component_batch"),
  protocol: z.literal(NATIVE_PROTOCOL_VERSION),
  sequence,
  operations: z
    .array(NativeOperationSchema)
    .min(1)
    .max(NativeComponentLimits.maxOperationsPerBatch),
});

export const NativeComponentCommandSchema = z.object({
  event_name: z.literal("native_component_command"),
  id: islandId,
  request_id: NativeRequestIdSchema,
  name: z.string().min(1),
  args: z.unknown().optional(),
});

export const NativeComponentResponseSchema = z.object({
  event_name: z.literal("native_component_response"),
  id: islandId,
  request_id: NativeRequestIdSchema,
  ok: z.boolean(),
  value: z.unknown().optional(),
  error: z.string().optional(),
});

export const NativeIslandsReadySchema = z.object({
  event_name: z.literal("native_islands_ready"),
  sequence: z.number().int().nonnegative(),
});

export const ToHostMessageSchema = z.discriminatedUnion("event_name", [
  NativeComponentBatchSchema,
  NativeIslandsReadySchema,
  NativeComponentCommandSchema,
  NativeComponentResponseSchema,
]);

export const NativeComponentAckSchema = z.object({
  event_name: z.literal("native_component_ack"),
  sequence,
  ids: z.array(z.string()),
});

export const NativeComponentErrorSchema = z.object({
  event_name: z.literal("native_component_error"),
  id: z.string(),
  reason: NativeErrorReasonSchema,
  message: z.string().optional(),
  sequence: sequence.optional(),
});

export const NativeComponentEventSchema = z.object({
  event_name: z.literal("native_component_event"),
  id: z.string(),
  name: z.string().min(1),
  payload: z.unknown().optional(),
  sequence: sequence.optional(),
});

export const NativeComponentSizeSchema = z.object({
  event_name: z.literal("native_component_size"),
  id: z.string(),
  size: NativeSizeSchema,
  sequence: sequence.optional(),
});

export const NativeComponentResetSchema = z.object({
  event_name: z.literal("native_component_reset"),
});

export const NativeComponentStateSchema = z.object({
  event_name: z.literal("native_component_state"),
  id: z.string(),
  revision: z.number().int().positive(),
  values: NativeStateValuesSchema,
  replace: z.boolean().optional(),
  sequence: sequence.optional(),
});

export const NativeComponentRequestSchema = z.object({
  event_name: z.literal("native_component_request"),
  id: z.string(),
  request_id: NativeRequestIdSchema,
  name: z.string().min(1),
  payload: z.unknown().optional(),
  sequence: sequence.optional(),
});

export const NativeComponentReplySchema = z.object({
  event_name: z.literal("native_component_reply"),
  request_id: NativeRequestIdSchema,
  ok: z.boolean(),
  value: z.unknown().optional(),
  error: z.string().optional(),
});

export const ToPageMessageSchema = z.discriminatedUnion("event_name", [
  NativeComponentAckSchema,
  NativeComponentErrorSchema,
  NativeComponentEventSchema,
  NativeComponentSizeSchema,
  NativeComponentResetSchema,
  NativeComponentStateSchema,
  NativeComponentRequestSchema,
  NativeComponentReplySchema,
]);

export type TToHostMessage = z.infer<typeof ToHostMessageSchema>;
export type TToPageMessage = z.infer<typeof ToPageMessageSchema>;
export type TNativeComponentBatch = z.infer<typeof NativeComponentBatchSchema>;
export type TNativeIslandsReady = z.infer<typeof NativeIslandsReadySchema>;
export type TNativeComponentCommand = z.infer<typeof NativeComponentCommandSchema>;
export type TNativeComponentResponse = z.infer<typeof NativeComponentResponseSchema>;
export type TNativeComponentAck = z.infer<typeof NativeComponentAckSchema>;
export type TNativeComponentError = z.infer<typeof NativeComponentErrorSchema>;
export type TNativeComponentEvent = z.infer<typeof NativeComponentEventSchema>;
export type TNativeComponentSize = z.infer<typeof NativeComponentSizeSchema>;
export type TNativeComponentReset = z.infer<typeof NativeComponentResetSchema>;
export type TNativeComponentState = z.infer<typeof NativeComponentStateSchema>;
export type TNativeComponentRequest = z.infer<typeof NativeComponentRequestSchema>;
export type TNativeComponentReply = z.infer<typeof NativeComponentReplySchema>;
