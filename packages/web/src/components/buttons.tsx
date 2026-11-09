import * as React from "react";
import type { NativeCommonProps } from "../react/components/Native";
import { cssVariables } from "./geometry";
import { Glyph } from "./glyphs";
import {
  NativeCloseButton,
  NativeGlassButton,
  NativeMenu,
  type MenuItem,
  type Prominence,
} from "./specs";

/**
 * Each component is a native island with a web version as its default
 * children. The web version sets the island's size and place, and is what a
 * browser or a host without the component shows. Pass children to replace it.
 */

type ButtonLook = {
  /** The text. Leave it out for a round button with only an icon. */
  title?: string;
  /** The SF Symbol drawn natively. */
  systemImage?: string;
  /** The web version's drawing of `systemImage`. */
  icon?: React.ReactNode;
  prominence?: Prominence;
  tint?: string;
  glassGroup?: string;
};

const labelOf = (label: string | undefined, title: string | undefined) => label ?? title;

/** A Liquid Glass button: a capsule with a title, or a circle around an icon on its own. */
export const GlassButton = ({
  title,
  systemImage,
  icon,
  prominence = "regular",
  tint,
  glassGroup,
  disabled,
  label,
  onPress,
  children,
  accessibility,
  ...common
}: ButtonLook &
  NativeCommonProps & {
    disabled?: boolean;
    /** The accessibility label, for a button with only an icon. Defaults to `title`. */
    label?: string;
    onPress?: () => void;
  }) => {
  const name = labelOf(label, title);
  return (
    <NativeGlassButton
      title={title}
      systemImage={systemImage}
      prominence={prominence}
      tint={tint}
      disabled={disabled}
      glassGroup={glassGroup}
      accessibility={accessibility ?? (name === undefined ? undefined : { label: name })}
      onPress={onPress}
      {...common}
    >
      {children ?? (
        <button
          type="button"
          className={title ? "ni-glass ni-glass--pill" : "ni-glass ni-glass--circle"}
          data-prominent={prominence === "prominent" ? "" : undefined}
          style={cssVariables({ "--ni-tint": tint })}
          aria-label={name}
          disabled={disabled}
          onClick={onPress}
        >
          {icon && <span className="ni-icon">{icon}</span>}
          {title}
        </button>
      )}
    </NativeGlassButton>
  );
};

/** The round glass close button of a sheet, with the system's cross. */
export const CloseButton = ({
  tint,
  glassGroup,
  label = "Close",
  onPress,
  children,
  accessibility,
  ...common
}: NativeCommonProps & {
  tint?: string;
  glassGroup?: string;
  label?: string;
  onPress?: () => void;
}) => (
  <NativeCloseButton
    tint={tint}
    glassGroup={glassGroup}
    accessibility={accessibility ?? { label }}
    onPress={onPress}
    {...common}
  >
    {children ?? (
      <button
        type="button"
        className="ni-glass ni-glass--circle"
        style={cssVariables({ "--ni-tint": tint })}
        aria-label={label}
        onClick={onPress}
      >
        <Glyph name="xmark" className="ni-icon" />
      </button>
    )}
  </NativeCloseButton>
);

const WebMenuItems = ({
  items,
  onSelect,
}: {
  items: readonly MenuItem[];
  onSelect: (id: string) => void;
}) => {
  const [opened, setOpened] = React.useState<string>();
  return (
    <>
      {items.map((item) => (
        <React.Fragment key={item.id}>
          <button
            type="button"
            role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
            className="ni-menu-item"
            data-destructive={item.destructive ? "" : undefined}
            aria-checked={item.checked}
            aria-expanded={item.children ? opened === item.id : undefined}
            onClick={() =>
              item.children
                ? setOpened(opened === item.id ? undefined : item.id)
                : onSelect(item.id)
            }
          >
            <span className="ni-menu-check">{item.checked && <Glyph name="checkmark" />}</span>
            <span className="ni-menu-title">{item.title}</span>
            {item.children && <Glyph name="chevron.right" className="ni-menu-chevron" />}
          </button>
          {item.children && opened === item.id && (
            <div className="ni-menu-submenu" role="group">
              <WebMenuItems items={item.children} onSelect={onSelect} />
            </div>
          )}
        </React.Fragment>
      ))}
    </>
  );
};

/** A glass button that opens a menu: UIMenu natively, a popover of the items on the web. */
export const Menu = ({
  title,
  systemImage,
  icon,
  prominence = "regular",
  tint,
  glassGroup,
  items,
  label,
  onSelect,
  children,
  accessibility,
  ...common
}: ButtonLook &
  NativeCommonProps & {
    /** Items with `children` open a submenu. */
    items: readonly MenuItem[];
    label?: string;
    onSelect: (id: string) => void;
  }) => {
  const [open, setOpen] = React.useState(false);
  const name = labelOf(label, title);
  const select = (id: string) => {
    setOpen(false);
    onSelect(id);
  };
  return (
    <NativeMenu
      title={title}
      systemImage={systemImage}
      prominence={prominence}
      tint={tint}
      glassGroup={glassGroup}
      items={items}
      accessibility={accessibility ?? (name === undefined ? undefined : { label: name })}
      onSelect={({ id }) => onSelect(id)}
      {...common}
    >
      {children ?? (
        <div className="ni-menu">
          <button
            type="button"
            className={title ? "ni-glass ni-glass--pill" : "ni-glass ni-glass--circle"}
            data-prominent={prominence === "prominent" ? "" : undefined}
            style={cssVariables({ "--ni-tint": tint })}
            aria-label={name}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {icon && <span className="ni-icon">{icon}</span>}
            {title}
          </button>
          {open && (
            <>
              <div className="ni-menu-backdrop" onClick={() => setOpen(false)} />
              <div className="ni-menu-popover" role="menu">
                <WebMenuItems items={items} onSelect={select} />
              </div>
            </>
          )}
        </div>
      )}
    </NativeMenu>
  );
};
