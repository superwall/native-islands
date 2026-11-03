import * as React from "react";

/**
 * Web drawings of the SF Symbols the app uses, for the web versions of its
 * symbol islands. They only stand in for the real symbols, which the native
 * views draw.
 */
const PATHS: Record<string, React.ReactNode> = {
  "chevron.left": <path d="M15 4 7 12l8 8" fill="none" strokeWidth="2.6" />,
  "chevron.right": <path d="m9 4 8 8-8 8" fill="none" strokeWidth="2.6" />,
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
