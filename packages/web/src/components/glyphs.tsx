/**
 * The few glyphs the web versions draw themselves: the chrome of a control,
 * such as a stepper's minus and plus. Symbols a page chooses come from the
 * page, through each component's `icon`.
 */

export type GlyphName =
  | "plus"
  | "minus"
  | "checkmark"
  | "xmark"
  | "chevron.left"
  | "chevron.right"
  | "chevron.up.chevron.down";

const PATHS: Record<GlyphName, string> = {
  plus: "M10 4v12M4 10h12",
  minus: "M4 10h12",
  checkmark: "m4.5 10.5 3.5 3.5 7.5-8",
  xmark: "m5.5 5.5 9 9m0-9-9 9",
  "chevron.left": "M12.5 4 6.5 10l6 6",
  "chevron.right": "m7.5 4 6 6-6 6",
  "chevron.up.chevron.down": "m6.5 7.5 3.5-3.5 3.5 3.5m-7 5 3.5 3.5 3.5-3.5",
};

export const Glyph = ({ name, className }: { name: GlyphName; className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    data-glyph={name}
  >
    <path d={PATHS[name]} />
  </svg>
);
