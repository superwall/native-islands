import { describe, expect, it } from "bun:test";
import { describeActivity, formatCentre, formatClock } from "../src/ui/capabilities";

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
