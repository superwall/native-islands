import { defineNativeComponent } from "native-islands/react";

/**
 * Components the app registers itself. The host only knows a name, a version
 * and the props below; the web children are what every other host shows.
 */
export const Rating = defineNativeComponent<{
  props: { value: number; max: number; tint?: string };
  events: { change: number };
}>("rating", { colorProps: ["tint"] });

export const RatingV2 = defineNativeComponent<{
  props: { value: number; max: number; halfStars: boolean };
}>("rating", { version: 2 });

export const Confetti = defineNativeComponent<{ props: { intensity: number } }>("confetti");

export const SilentBadge = defineNativeComponent<{ props: { label: string } }>("silentBadge");

export const Stars = ({ value, max }: { value: number; max: number }) => (
  <span
    role="img"
    aria-label={`${value} of ${max} stars`}
    style={{ fontSize: "1.25rem", letterSpacing: 2 }}
  >
    {"★".repeat(value)}
    {"☆".repeat(max - value)}
  </span>
);
