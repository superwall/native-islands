import * as React from "react";
import { createPortal } from "react-dom";

export const SHEET_CLOSE_MS = 260;

type SheetProps = {
  open: boolean;
  label: string;
  placement?: "bottom" | "center";
  onDismiss?: () => void;
  children: React.ReactNode;
};

/**
 * A modal sheet drawn outside the pages, so WebKit gives it a layer above
 * every page's scroll view and it covers the native views on the page under
 * it in the same frame, as it slides in and out. It stays mounted while it
 * closes, then unmounts.
 */
export const Sheet = ({ open, label, placement = "bottom", onDismiss, children }: SheetProps) => {
  const [shown, setShown] = React.useState(open);
  const [closing, setClosing] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setShown(true);
      setClosing(false);
      return;
    }
    if (!shown) return;
    setClosing(true);
    const timer = setTimeout(() => {
      setShown(false);
      setClosing(false);
    }, SHEET_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open, shown]);

  if (!shown) return null;
  return createPortal(
    <div
      className={`overlay overlay--${placement}`}
      data-state={closing ? "closing" : "open"}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <button
        type="button"
        className="overlay-backdrop"
        aria-label="Dismiss"
        tabIndex={-1}
        onClick={onDismiss}
      />
      <div className={`sheet sheet--${placement}`}>{children}</div>
    </div>,
    document.body,
  );
};
