import * as React from "react";
import { SystemSymbol } from "./controls";
import { WebSymbol } from "./icons";

export const Section = ({
  header,
  footer,
  children,
}: React.PropsWithChildren<{ header?: string; footer?: React.ReactNode }>) => (
  <>
    {header && <h2 className="list-header">{header}</h2>}
    <div className="list-section" role="list">
      {children}
    </div>
    {footer && <p className="list-footer">{footer}</p>}
  </>
);

type RowProps = {
  title: string;
  subtitle?: string;
  symbol?: string;
  tint?: string;
  detail?: React.ReactNode;
  accessory?: React.ReactNode;
  checked?: boolean;
  /** Shows a chevron: the row opens another screen. */
  disclosure?: boolean;
  leading?: React.ReactNode;
  onPress?: () => void;
};

export const Row = ({
  title,
  subtitle,
  symbol,
  tint,
  detail,
  accessory,
  checked,
  disclosure,
  leading,
  onPress,
}: RowProps) => {
  const content = (
    <>
      {leading}
      {symbol && <SystemSymbol name={symbol} tint={tint} className="row-icon" />}
      <span className="row-text">
        <span className="row-title">{title}</span>
        {subtitle && (
          <>
            <br />
            <span className="row-subtitle">{subtitle}</span>
          </>
        )}
      </span>
      {detail !== undefined && <span className="row-detail">{detail}</span>}
      {accessory}
      {checked && <WebSymbol name="checkmark" className="row-check" />}
      {disclosure && <WebSymbol name="chevron.right" className="row-chevron" />}
    </>
  );
  const hasIcon = symbol || leading ? "" : undefined;
  return onPress ? (
    <button
      type="button"
      role="listitem"
      className="row"
      data-pressable=""
      data-has-icon={hasIcon}
      onClick={onPress}
    >
      {content}
    </button>
  ) : (
    <div className="row" role="listitem" data-has-icon={hasIcon}>
      {content}
    </div>
  );
};

/** A card that puts the control on show, with what it does under it. */
export const Stage = ({
  caption,
  children,
  tall,
}: React.PropsWithChildren<{ caption?: React.ReactNode; tall?: boolean }>) => (
  <>
    <div className="stage" data-tall={tall ? "" : undefined}>
      {children}
    </div>
    {caption && <p className="list-footer">{caption}</p>}
  </>
);

/** A row showing a value as the page holds it, to prove the native control reported it. */
export const Readout = ({ title = "Page sees", value }: { title?: string; value: string }) => (
  <div className="row readout-row" role="listitem">
    <span className="row-title">{title}</span>
    <code className="readout" aria-live="polite">
      {value}
    </code>
  </div>
);
