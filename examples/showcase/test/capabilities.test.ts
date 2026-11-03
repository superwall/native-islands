import { describe, expect, it } from "bun:test";
import {
  describeActivity,
  formatCentre,
  formatClock,
  fromBrowser,
  projectPlaces,
} from "../src/ui/capabilities";
import { PLACES } from "../src/tabs/capabilities/location";

const place = (id: string, latitude: number, longitude: number) => ({
  id,
  title: id,
  latitude,
  longitude,
});

describe("projectPlaces", () => {
  it("fits the places inside the margin, north up and west left", () => {
    const spots = projectPlaces([place("nw", 10, -20), place("se", 0, 0)], 10);
    expect(spots).toEqual([
      { id: "nw", x: 10, y: 10 },
      { id: "se", x: 90, y: 90 },
    ]);
  });

  it("centres a place on an axis the places do not span", () => {
    expect(projectPlaces([place("a", 5, 5), place("b", 5, 6)], 10)).toEqual([
      { id: "a", x: 10, y: 50 },
      { id: "b", x: 90, y: 50 },
    ]);
  });

  it("returns nothing for no places", () => {
    expect(projectPlaces([])).toEqual([]);
  });

  it("keeps every place of the Maps demo inside the map", () => {
    for (const spot of projectPlaces(PLACES)) {
      expect(spot.x).toBeGreaterThanOrEqual(15);
      expect(spot.x).toBeLessThanOrEqual(85);
      expect(spot.y).toBeGreaterThanOrEqual(15);
      expect(spot.y).toBeLessThanOrEqual(85);
    }
  });
});

describe("formatCentre", () => {
  it("writes hemispheres instead of signs", () => {
    expect(formatCentre({ latitude: 37.81994, longitude: -122.47826 })).toBe(
      "37.8199° N, 122.4783° W",
    );
    expect(formatCentre({ latitude: -33.8568, longitude: 151.2153 })).toBe(
      "33.8568° S, 151.2153° E",
    );
  });
});

describe("formatClock", () => {
  it("writes minutes and padded seconds", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(9.9)).toBe("0:09");
    expect(formatClock(605)).toBe("10:05");
  });

  it("reads an unknown or negative time as zero", () => {
    expect(formatClock(Number.NaN)).toBe("0:00");
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe("0:00");
    expect(formatClock(-3)).toBe("0:00");
  });
});

describe("fromBrowser", () => {
  it("maps permission and notification states to the app's statuses", () => {
    expect(fromBrowser("granted")).toBe("granted");
    expect(fromBrowser("denied")).toBe("denied");
    expect(fromBrowser("prompt")).toBe("notDetermined");
    expect(fromBrowser("default")).toBe("notDetermined");
  });
});

describe("describeActivity", () => {
  it("names the share sheet's activities in a word", () => {
    expect(describeActivity(null)).toBe("Cancelled");
    expect(describeActivity("done")).toBe("Shared");
    expect(describeActivity("com.apple.UIKit.activity.CopyToPasteboard")).toBe("Copy");
    expect(describeActivity("com.apple.UIKit.activity.Message")).toBe("Messages");
    expect(describeActivity("com.apple.UIKit.activity.PostToTwitter")).toBe("Twitter");
    expect(describeActivity("com.apple.UIKit.activity.MarkupAsPDF")).toBe("Markup As PDF");
    expect(describeActivity("net.example.ShareExtension")).toBe("Share Extension");
  });
});
