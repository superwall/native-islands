import { describe, expect, it } from "vitest";
import { NativeMotionSchema } from "../../src/protocol/schemas";

const slide = {
  keyframes: [
    { offset: 0, x: 400, y: 0 },
    { offset: 0.5, x: 100, y: 0 },
    { offset: 1, x: 0, y: 0 },
  ],
  easings: [
    [0.32, 0.72, 0, 1],
    [0, 0, 1, 1],
  ],
  duration: 500,
  elapsed: 0,
  cover: {
    frame: { x: 0, y: 0, width: 400, height: 800 },
    keyframes: [
      { offset: 0, x: 0, y: 0 },
      { offset: 0.5, x: 10, y: 0 },
      { offset: 1, x: 20, y: 0 },
    ],
  },
};

const accepts = (value: unknown) => NativeMotionSchema.safeParse(value).success;

describe("NativeMotionSchema", () => {
  it("accepts a slide the host can run, with or without easings and a cover", () => {
    expect(accepts(slide)).toBe(true);
    expect(accepts({ ...slide, easings: undefined, cover: undefined })).toBe(true);
  });

  it("refuses what the host refuses, so both sides of the contract agree", () => {
    const [first, second, third] = slide.keyframes;
    expect(accepts({ ...slide, keyframes: [first, third, second] })).toBe(false);
    expect(accepts({ ...slide, easings: [[0, 0, 1, 1]] })).toBe(false);
    expect(
      accepts({
        ...slide,
        easings: [
          [1.2, 0, 0, 1],
          [0, 0, 1, 1],
        ],
      }),
    ).toBe(false);
    expect(
      accepts({
        ...slide,
        easings: [
          [0, 0, -0.1, 1],
          [0, 0, 1, 1],
        ],
      }),
    ).toBe(false);
    expect(
      accepts({ ...slide, cover: { ...slide.cover, keyframes: slide.cover.keyframes.slice(1) } }),
    ).toBe(false);
    expect(
      accepts({
        ...slide,
        cover: {
          ...slide.cover,
          keyframes: [
            { offset: 0, x: 0, y: 0 },
            { offset: 0.6, x: 10, y: 0 },
            { offset: 1, x: 20, y: 0 },
          ],
        },
      }),
    ).toBe(false);
  });
});
