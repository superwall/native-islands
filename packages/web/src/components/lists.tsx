import * as React from "react";
import type { NativeCommonProps } from "../react/components/Native";
import { cssVariables } from "./geometry";
import { Glyph } from "./glyphs";
import {
  NativeList,
  type ListAction,
  type ListRow,
  type ListSection,
  type ListStyle,
  type SelectionMode,
} from "./specs";
import type { SymbolRenderer } from "./chrome";

/**
 * A native list whose rows are props: sections of rows with symbols,
 * values, badges and accessories, swipe actions, selection, edit mode with
 * drag to reorder and delete, and rows with `children` as disclosure groups,
 * nested into an outline. Rows hold text and symbols only, never web
 * content; for rows of your own markup, lay them out on the page.
 *
 * The web version draws the same rows; once the native list reports the
 * height its rows take, the web version takes exactly that height, so the
 * island always fits its rows on every iOS.
 */
export type ListProps = NativeCommonProps & {
  sections: readonly ListSection[];
  style?: ListStyle;
  selectionMode?: SelectionMode;
  selected?: readonly string[];
  onSelectedChange?: (selected: readonly string[]) => void;
  /** The ids of open disclosure groups. Defaults to none, kept by the list itself. */
  expanded?: readonly string[];
  onExpandedChange?: (expanded: readonly string[]) => void;
  editing?: boolean;
  reorderable?: boolean;
  deletable?: boolean;
  /** The sections after a reorder or a delete, to keep as the new props. */
  onSectionsChange?: (sections: readonly ListSection[]) => void;
  onPress?: (id: string) => void;
  onAction?: (row: string, action: string) => void;
  tint?: string;
  icon?: SymbolRenderer;
};

const toggle = (list: readonly string[], id: string): string[] =>
  list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];

/** A section with one row moved, as both versions reorder. */
export const moveRow = (
  sections: readonly ListSection[],
  sectionId: string,
  from: number,
  to: number,
): ListSection[] =>
  sections.map((section) => {
    if (section.id !== sectionId) return section;
    const rows = [...section.rows];
    const [row] = rows.splice(from, 1);
    if (row) rows.splice(Math.max(0, Math.min(to, rows.length)), 0, row);
    return { ...section, rows };
  });

/** A section without the rows of `ids`. */
export const deleteRows = (
  sections: readonly ListSection[],
  sectionId: string,
  ids: readonly string[],
): ListSection[] =>
  sections.map((section) =>
    section.id === sectionId
      ? { ...section, rows: section.rows.filter((row) => !ids.includes(row.id)) }
      : section,
  );

type RowContext = {
  selected: readonly string[];
  expanded: readonly string[];
  selectionMode: SelectionMode;
  editing: boolean;
  icon?: SymbolRenderer;
  press: (row: ListRow) => void;
  expand: (id: string) => void;
  act: (row: string, action: ListAction) => void;
};

const WebRow = ({
  row,
  depth,
  context,
  edit,
}: {
  row: ListRow;
  depth: number;
  context: RowContext;
  edit?: React.ReactNode;
}) => {
  const open = context.expanded.includes(row.id);
  const checked = context.selectionMode !== "none" && context.selected.includes(row.id);
  const actions = [...(row.leadingActions ?? []), ...(row.trailingActions ?? [])];
  return (
    <>
      <div
        className="ni-list-row"
        role="listitem"
        data-depth={depth || undefined}
        style={cssVariables({ "--ni-depth": String(depth) })}
      >
        {edit}
        <button
          type="button"
          className="ni-list-row-main"
          disabled={row.disabled}
          aria-pressed={context.selectionMode === "none" ? undefined : checked}
          aria-expanded={row.children ? open : undefined}
          onClick={() => context.press(row)}
        >
          {row.systemImage && (
            <span
              className="ni-list-icon"
              data-filled={row.iconTint ? "" : undefined}
              style={cssVariables({ "--ni-icon-tint": row.iconTint })}
            >
              {context.icon?.(row.systemImage)}
            </span>
          )}
          <span className="ni-list-text">
            <span className="ni-list-title" data-role={row.role}>
              {row.title}
            </span>
            {row.subtitle && <span className="ni-list-subtitle">{row.subtitle}</span>}
          </span>
          {row.value && <span className="ni-list-value">{row.value}</span>}
          {row.badge !== undefined && <span className="ni-badge">{row.badge}</span>}
          {checked && <Glyph name="checkmark" className="ni-list-check" />}
          {row.accessory === "chevron" && (
            <Glyph name="chevron.right" className="ni-list-chevron" />
          )}
          {row.accessory === "info" && (
            <span className="ni-list-info" aria-hidden="true">
              ⓘ
            </span>
          )}
        </button>
        {row.children && (
          <button
            type="button"
            className="ni-list-disclosure"
            aria-expanded={open}
            aria-label={open ? `Collapse ${row.title}` : `Expand ${row.title}`}
            onClick={() => context.expand(row.id)}
          >
            <Glyph name="chevron.right" />
          </button>
        )}
        {!context.editing && actions.length > 0 && (
          <span className="ni-list-actions">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="ni-list-action"
                data-role={action.role}
                style={cssVariables({ "--ni-tint": action.tint })}
                onClick={() => context.act(row.id, action)}
              >
                {action.title}
              </button>
            ))}
          </span>
        )}
      </div>
      {open &&
        row.children?.map((child) => (
          <WebRow key={child.id} row={child} depth={depth + 1} context={context} />
        ))}
    </>
  );
};

export const List = ({
  sections,
  style = "insetGrouped",
  selectionMode = "none",
  selected = [],
  onSelectedChange,
  expanded: expandedProp,
  onExpandedChange,
  editing = false,
  reorderable = false,
  deletable = false,
  onSectionsChange,
  onPress,
  onAction,
  tint,
  icon,
  children,
  ...common
}: ListProps) => {
  const [ownExpanded, setOwnExpanded] = React.useState<readonly string[]>([]);
  const [nativeHeight, setNativeHeight] = React.useState<number>();
  const expanded = expandedProp ?? ownExpanded;
  const setExpanded = (next: readonly string[]) => {
    setOwnExpanded(next);
    onExpandedChange?.(next);
  };
  const select = (id: string) => {
    if (selectionMode === "single") onSelectedChange?.([id]);
    if (selectionMode === "multiple") onSelectedChange?.(toggle(selected, id));
  };
  const context: RowContext = {
    selected,
    expanded,
    selectionMode,
    editing,
    icon,
    press: (row) => {
      if (row.children) setExpanded(toggle(expanded, row.id));
      select(row.id);
      onPress?.(row.id);
    },
    expand: (id) => setExpanded(toggle(expanded, id)),
    act: (row, action) => onAction?.(row, action.id),
  };
  const editControls = (section: ListSection, index: number, row: ListRow) =>
    editing && (deletable || reorderable) ? (
      <span className="ni-list-edit">
        {deletable && (
          <button
            type="button"
            className="ni-list-delete"
            aria-label={`Delete ${row.title}`}
            onClick={() => onSectionsChange?.(deleteRows(sections, section.id, [row.id]))}
          >
            <Glyph name="minus" />
          </button>
        )}
        {reorderable && (
          <button
            type="button"
            className="ni-list-move"
            aria-label={`Move ${row.title} up`}
            disabled={index === 0}
            onClick={() => onSectionsChange?.(moveRow(sections, section.id, index, index - 1))}
          >
            ≡
          </button>
        )}
      </span>
    ) : undefined;
  return (
    <NativeList
      sections={sections}
      style={style}
      selectionMode={selectionMode}
      selected={selected}
      expanded={expanded}
      editing={editing}
      reorderable={reorderable}
      deletable={deletable}
      tint={tint}
      onPress={({ id }) => onPress?.(id)}
      onAction={({ row, id }) => onAction?.(row, id)}
      onSelectedChange={(next) => onSelectedChange?.(next)}
      onExpandedChange={(next) => setExpanded(next)}
      onSectionsChange={(next) => onSectionsChange?.(next)}
      onContentHeightChange={setNativeHeight}
      {...common}
    >
      {children ?? (
        <div
          className="ni-list"
          data-style={style}
          style={{
            ...cssVariables({ "--ni-tint": tint }),
            ...(nativeHeight === undefined ? {} : { height: nativeHeight, overflow: "hidden" }),
          }}
        >
          {sections.map((section) => (
            <div key={section.id} className="ni-list-section">
              {section.header && <h3 className="ni-list-header">{section.header}</h3>}
              <div className="ni-list-rows" role="list" aria-label={section.header}>
                {section.rows.map((row, index) => (
                  <WebRow
                    key={row.id}
                    row={row}
                    depth={0}
                    context={context}
                    edit={editControls(section, index, row)}
                  />
                ))}
              </div>
              {section.footer && <p className="ni-list-footer">{section.footer}</p>}
            </div>
          ))}
        </div>
      )}
    </NativeList>
  );
};
