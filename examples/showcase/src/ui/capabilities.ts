import type { MapRegion, PermissionStatus } from "native-islands/components";

/** A region's centre the way Maps writes it, such as `37.8199° N, 122.4783° W`. */
export const formatCentre = ({ latitude, longitude }: Pick<MapRegion, "latitude" | "longitude">) =>
  `${Math.abs(latitude).toFixed(4)}° ${latitude < 0 ? "S" : "N"}, ` +
  `${Math.abs(longitude).toFixed(4)}° ${longitude < 0 ? "W" : "E"}`;

/** A playback position as `m:ss`. */
export const formatClock = (seconds: number): string => {
  const whole = Number.isFinite(seconds) ? Math.max(Math.floor(seconds), 0) : 0;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

export const STATUS_TITLES: Record<PermissionStatus, string> = {
  notDetermined: "Not asked yet",
  granted: "Allowed",
  limited: "Limited",
  denied: "Denied",
  restricted: "Restricted",
};

const ACTIVITIES: Record<string, string> = {
  CopyToPasteboard: "Copy",
  Message: "Messages",
  Mail: "Mail",
  AirDrop: "AirDrop",
  AddToReadingList: "Reading List",
  SaveToCameraRoll: "Save to Photos",
  Print: "Print",
};

/** What the share sheet reports, such as `com.apple.UIKit.activity.Mail`, in a word. */
export const describeActivity = (activity: string | null): string => {
  if (activity === null) return "Cancelled";
  if (activity === "done") return "Shared";
  const name = activity.split(".").at(-1) ?? activity;
  return (
    ACTIVITIES[name.replace(/^PostTo/, "")] ??
    name
      .replace(/^PostTo/, "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .trim()
  );
};
