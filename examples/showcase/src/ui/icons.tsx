import * as React from "react";

/**
 * Web drawings of the SF Symbols the app uses, for the web versions of its
 * symbol islands. They only stand in for the real symbols, which the native
 * views draw.
 */
const PATHS: Record<string, React.ReactNode> = {
  "chevron.left": <path d="M15 4 7 12l8 8" fill="none" strokeWidth="2.6" />,
  "chevron.right": <path d="m9 4 8 8-8 8" fill="none" strokeWidth="2.6" />,
  magnifyingglass: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" strokeWidth="2.4" />
      <path d="m15.5 15.5 5 5" fill="none" strokeWidth="2.6" />
    </>
  ),
  "xmark.circle.fill": (
    <>
      <circle cx="12" cy="12" r="9.5" fill="currentColor" stroke="none" />
      <path
        d="m8.8 8.8 6.4 6.4M15.2 8.8l-6.4 6.4"
        fill="none"
        stroke="var(--cell)"
        strokeWidth="2"
      />
    </>
  ),
  iphone: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="3" fill="none" strokeWidth="2" />
      <path d="M10.5 5.5h3" fill="none" strokeWidth="1.8" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" strokeWidth="1.8" />
      <path
        d="M3 12h18M12 3c-3 3.2-3 14.8 0 18M12 3c3 3.2 3 14.8 0 18"
        fill="none"
        strokeWidth="1.6"
      />
    </>
  ),
  "square.dashed": (
    <rect
      x="3.5"
      y="3.5"
      width="17"
      height="17"
      rx="3"
      fill="none"
      strokeWidth="2"
      strokeDasharray="3 3"
    />
  ),
  checkmark: <path d="m4 12.5 5 5L20 6" fill="none" strokeWidth="2.6" />,
  "shippingbox.fill": (
    <>
      <path d="M12 2.5 3 7v10l9 4.5 9-4.5V7Z" fill="currentColor" stroke="none" />
      <path d="M3 7l9 4.5L21 7M12 11.5v10" fill="none" stroke="var(--cell)" strokeWidth="1.4" />
    </>
  ),
  sparkles: (
    <path
      d="M10 3c.6 4 2.5 5.9 6.5 6.5-4 .6-5.9 2.5-6.5 6.5-.6-4-2.5-5.9-6.5-6.5C7.5 8.9 9.4 7 10 3Zm8 10c.3 2 1.2 2.9 3.2 3.2-2 .3-2.9 1.2-3.2 3.2-.3-2-1.2-2.9-3.2-3.2 2-.3 2.9-1.2 3.2-3.2Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  "gearshape.fill": (
    <path
      fillRule="evenodd"
      d="M10.4 2h3.2l.5 2.6 1.7.8 2.2-1.5 2.3 2.3-1.5 2.2.8 1.7 2.4.5v3.2l-2.4.5-.8 1.7 1.5 2.2-2.3 2.3-2.2-1.5-1.7.8-.5 2.4h-3.2l-.5-2.4-1.7-.8-2.2 1.5-2.3-2.3 1.5-2.2-.8-1.7L2 13.6v-3.2l2.4-.5.8-1.7-1.5-2.2 2.3-2.3 2.2 1.5 1.7-.8ZM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  "circle.lefthalf.filled": (
    <>
      <circle cx="12" cy="12" r="9" fill="none" strokeWidth="2" />
      <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none" />
    </>
  ),
  "paintpalette.fill": (
    <path
      fillRule="evenodd"
      d="M12 3a9 9 0 0 0 0 18c1.4 0 2-1 1.6-2.1-.5-1.2.3-2.4 1.6-2.4H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3ZM7.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm4.5.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  "square.stack.3d.up.fill": (
    <>
      <path d="m12 3 9 4.5-9 4.5-9-4.5Z" fill="currentColor" stroke="none" />
      <path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5" fill="none" strokeWidth="2" />
    </>
  ),
  "info.circle": (
    <>
      <circle cx="12" cy="12" r="9" fill="none" strokeWidth="2" />
      <path d="M12 11v6M12 7.5v.5" fill="none" strokeWidth="2.4" />
    </>
  ),
  "hand.raised.fill": (
    <path
      d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10V4a1.5 1.5 0 0 1 3 0v6-4.5a1.5 1.5 0 0 1 3 0V13v-2.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-12.6 4.2L4.6 15.5a1.5 1.5 0 0 1 2.3-1.9L8 15Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  link: (
    <path
      d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"
      fill="none"
      strokeWidth="2"
    />
  ),
  "hand.tap.fill": (
    <>
      <path
        d="M9 13V6.5a1.5 1.5 0 0 1 3 0V12l5.2 1a2.5 2.5 0 0 1 2 2.9L18.5 21H10l-3.6-4.6a1.5 1.5 0 0 1 2.3-1.9L9 15Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M6.5 7.5a4 4 0 0 1 8 0" fill="none" strokeWidth="1.8" />
    </>
  ),
  "filemenu.and.selection": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" fill="none" strokeWidth="2" />
      <rect x="6" y="10.5" width="12" height="3.5" rx="1" fill="currentColor" stroke="none" />
      <path d="M6.5 7.5h6M6.5 17h8" fill="none" strokeWidth="1.8" />
    </>
  ),
  "switch.2": (
    <>
      <rect x="2.5" y="3.5" width="19" height="7" rx="3.5" fill="none" strokeWidth="1.8" />
      <circle cx="6.5" cy="7" r="2.2" fill="currentColor" stroke="none" />
      <rect x="2.5" y="13.5" width="19" height="7" rx="3.5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="17" r="2.2" fill="var(--cell)" stroke="none" />
    </>
  ),
  "rectangle.split.3x1.fill": (
    <>
      <rect x="2" y="6" width="20" height="12" rx="3" fill="currentColor" stroke="none" />
      <path d="M8.7 6v12M15.3 6v12" fill="none" stroke="var(--cell)" strokeWidth="1.6" />
    </>
  ),
  "slider.horizontal.3": <path d="M3 6h18M3 12h18M3 18h18" fill="none" strokeWidth="2" />,
  plusminus: <path d="M7 3v8M3 7h8M13 17h8M5 21 19 3" fill="none" strokeWidth="2" />,
  "list.bullet": (
    <path d="M9 6h12M9 12h12M9 18h12M4 6h.5M4 12h.5M4 18h.5" fill="none" strokeWidth="2.4" />
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="3" fill="none" strokeWidth="2" />
      <path d="M3 9.5h18M8 2.5v3M16 2.5v3" fill="none" strokeWidth="2" />
      <path d="M7.5 13h1M11.5 13h1M15.5 13h1M7.5 16.5h1M11.5 16.5h1" fill="none" strokeWidth="2" />
    </>
  ),
  "character.cursor.ibeam": (
    <>
      <path d="m3 19 4.5-13L12 19M4.6 14.5h5.8" fill="none" strokeWidth="2" />
      <path d="M17.5 4v16M15 4h5M15 20h5" fill="none" strokeWidth="1.8" />
    </>
  ),
  "gauge.with.dots.needle.67percent": (
    <>
      <circle cx="12" cy="12" r="9" fill="none" strokeWidth="2" />
      <path d="m12 13 4-5" fill="none" strokeWidth="2.4" />
      <path d="M7 15h.5M7 9.5h.5M12 6.5h.5M17 15h.5" fill="none" strokeWidth="2" />
    </>
  ),
  "star.fill": (
    <path
      d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  "lightbulb.fill": (
    <>
      <path
        d="M12 2.5a6.5 6.5 0 0 0-3.9 11.7c.6.5.9 1.1.9 1.8v.5h6v-.5c0-.7.3-1.3.9-1.8A6.5 6.5 0 0 0 12 2.5Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M9.5 19h5M10.5 21.5h3" fill="none" strokeWidth="1.8" />
    </>
  ),
  "chart.bar.fill": (
    <path
      d="M4 13h3.5v7H4ZM10.25 8h3.5v12h-3.5ZM16.5 4H20v16h-3.5Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  "chevron.up.chevron.down": <path d="m8 9 4-4 4 4M8 15l4 4 4-4" fill="none" strokeWidth="2.2" />,
  plus: <path d="M12 4v16M4 12h16" fill="none" strokeWidth="2.4" />,
  minus: <path d="M4 12h16" fill="none" strokeWidth="2.4" />,
  "heart.fill": (
    <path
      d="M12 20.5s-8-4.8-8-11A4.5 4.5 0 0 1 12 6.7a4.5 4.5 0 0 1 8 2.8c0 6.2-8 11-8 11Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  "square.and.arrow.up": (
    <path d="M12 3v12M8 7l4-4 4 4M8 10H6v10h12V10h-2" fill="none" strokeWidth="2" />
  ),
  trash: <path d="M4 6h16M9 6V3.5h6V6M6 6l1 14.5h10L18 6" fill="none" strokeWidth="2" />,
  ellipsis: <path d="M5.5 12h.5M12 12h.5M18 12h.5" fill="none" strokeWidth="3.4" />,
  "arrow.up.arrow.down": (
    <path d="M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4" fill="none" strokeWidth="2" />
  ),
  "sun.min": (
    <>
      <circle cx="12" cy="12" r="4" fill="none" strokeWidth="2" />
      <path
        d="M12 4.5v.5M12 19v.5M4.5 12h.5M19 12h.5M6.7 6.7l.3.3M17 17l.3.3M6.7 17.3l.3-.3M17 7l.3-.3"
        fill="none"
        strokeWidth="2.2"
      />
    </>
  ),
  "sun.max.fill": (
    <>
      <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"
        fill="none"
        strokeWidth="2"
      />
    </>
  ),
  "speaker.fill": <path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor" stroke="none" />,
  "speaker.wave.3.fill": (
    <>
      <path d="M3 9h3.5L11 5v14l-4.5-4H3Z" fill="currentColor" stroke="none" />
      <path
        d="M14 9.5a3.5 3.5 0 0 1 0 5M16.5 7a7 7 0 0 1 0 10M19 4.5a10.5 10.5 0 0 1 0 15"
        fill="none"
        strokeWidth="1.8"
      />
    </>
  ),
  "bell.fill": (
    <path
      d="M12 3a6 6 0 0 0-6 6v4l-2 3.5h16L18 13V9a6 6 0 0 0-6-6Zm-2.5 15.5a2.5 2.5 0 0 0 5 0Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  wifi: (
    <path
      d="M2.5 9a14 14 0 0 1 19 0M5.5 12.3a9.5 9.5 0 0 1 13 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01"
      fill="none"
      strokeWidth="2.4"
    />
  ),
  "bolt.fill": <path d="M13.5 2 5 13.5h6L10 22l9-12h-6Z" fill="currentColor" stroke="none" />,
  "play.fill": <path d="M7 4.5v15l12-7.5Z" fill="currentColor" stroke="none" />,
  "pause.fill": <path d="M6.5 4.5h4v15h-4ZM13.5 4.5h4v15h-4Z" fill="currentColor" stroke="none" />,
  "arrow.clockwise": <path d="M19 12a7 7 0 1 1-2-4.9M19 4v4h-4" fill="none" strokeWidth="2.2" />,
  "map.fill": (
    <path
      d="M3 6.5 8.5 4l7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20Z"
      fill="currentColor"
      stroke="var(--cell)"
      strokeWidth="1.4"
    />
  ),
  mappin: (
    <>
      <circle cx="12" cy="8" r="5" fill="currentColor" stroke="none" />
      <path d="M12 13v8" fill="none" strokeWidth="2.2" />
    </>
  ),
  "play.rectangle.fill": (
    <>
      <rect x="2" y="4.5" width="20" height="15" rx="3.5" fill="currentColor" stroke="none" />
      <path d="M10 8.8v6.4l5.4-3.2Z" fill="var(--cell)" stroke="none" />
    </>
  ),
  "camera.fill": (
    <>
      <path
        d="M4 7.5h3l1.6-2.5h6.8L17 7.5h3a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z"
        fill="currentColor"
        stroke="none"
      />
      <circle cx="12" cy="13.5" r="3.6" fill="none" stroke="var(--cell)" strokeWidth="1.8" />
    </>
  ),
  "photo.fill": (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="3" fill="currentColor" stroke="none" />
      <path d="m4.5 17.5 5-5.5 3.5 3.5 2.5-2.5 4 4.5Z" fill="var(--cell)" stroke="none" />
      <circle cx="16" cy="8.5" r="1.7" fill="var(--cell)" stroke="none" />
    </>
  ),
  "photo.on.rectangle": (
    <>
      <rect x="6" y="3" width="16" height="13" rx="2.5" fill="none" strokeWidth="1.8" />
      <path d="M3 7.5V18a3 3 0 0 0 3 3h11" fill="none" strokeWidth="1.8" />
      <path d="m8 14 4-4.5 3 3 2-2 3 3.5" fill="none" strokeWidth="1.8" />
    </>
  ),
  "mic.fill": (
    <>
      <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor" stroke="none" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v4" fill="none" strokeWidth="2" />
    </>
  ),
  "location.fill": <path d="M21 3 3 10.5l7.5 3 3 7.5Z" fill="currentColor" stroke="none" />,
  "house.fill": (
    <path d="M3 11 12 3.5l9 7.5v9.5h-6.5v-6h-5v6H3Z" fill="currentColor" stroke="none" />
  ),
  "building.2.fill": (
    <>
      <path d="M3 21V6l8-3v18Z" fill="currentColor" stroke="none" />
      <path d="M12.5 21V9l8.5 3v9Z" fill="currentColor" stroke="none" />
    </>
  ),
  "binoculars.fill": (
    <>
      <circle cx="6.5" cy="15.5" r="4.5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="15.5" r="4.5" fill="currentColor" stroke="none" />
      <path d="M5 11 7 4h3v8M19 11l-2-7h-3v8M10 12h4" fill="none" strokeWidth="2" />
    </>
  ),
  "ferry.fill": (
    <>
      <path d="M2.5 15h19l-2.5 4.5H5Z" fill="currentColor" stroke="none" />
      <path d="M6 14.5V9h12v5.5M9 9V5.5h6V9" fill="none" strokeWidth="2" />
    </>
  ),
  "pip.enter": (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="3" fill="none" strokeWidth="1.8" />
      <rect x="12" y="12" width="7" height="5.5" rx="1.2" fill="currentColor" stroke="none" />
    </>
  ),
};

export const WebSymbol = ({ name, className }: { name: string; className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {PATHS[name] ?? <circle cx="12" cy="12" r="8" fill="currentColor" stroke="none" />}
  </svg>
);

export const hasWebSymbol = (name: string): boolean => Object.hasOwn(PATHS, name);
