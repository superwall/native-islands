import type { MapPlace, MapRegion, PermissionStatus } from "../islands/definitions";

/**
 * Where each place sits on the web map, as percentages of its box: the
 * places' bounding box fitted inside `margin` of each edge, north up.
 */
export const projectPlaces = (
  places: readonly MapPlace[],
  margin = 15,
): { id: string; x: number; y: number }[] => {
  if (places.length === 0) return [];
  const latitudes = places.map((place) => place.latitude);
  const longitudes = places.map((place) => place.longitude);
  const [south, north] = [Math.min(...latitudes), Math.max(...latitudes)];
  const [west, east] = [Math.min(...longitudes), Math.max(...longitudes)];
  const span = 100 - margin * 2;
  const along = (value: number, low: number, high: number) =>
    high === low ? 50 : margin + ((value - low) / (high - low)) * span;
  return places.map((place) => ({
    id: place.id,
    x: along(place.longitude, west, east),
    y: 100 - along(place.latitude, south, north),
  }));
};

/** A region's centre the way Maps writes it, such as `37.8199° N, 122.4783° W`. */
export const formatCentre = ({ latitude, longitude }: Pick<MapRegion, "latitude" | "longitude">) =>
  `${Math.abs(latitude).toFixed(4)}° ${latitude < 0 ? "S" : "N"}, ` +
  `${Math.abs(longitude).toFixed(4)}° ${longitude < 0 ? "W" : "E"}`;

/** A playback position as `m:ss`. */
export const formatClock = (seconds: number): string => {
  const whole = Number.isFinite(seconds) ? Math.max(Math.floor(seconds), 0) : 0;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** A browser permission state, or `Notification.permission`, as the app's status. */
export const fromBrowser = (state: string): PermissionStatus => {
  switch (state) {
    case "granted":
      return "granted";
    case "denied":
      return "denied";
    default:
      return "notDetermined";
  }
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
