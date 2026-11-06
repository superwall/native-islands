import * as React from "react";
import type { NativeCommonProps, NativeHandle } from "../react/components/Native";
import { cssVariables } from "./geometry";
import { Glyph, type GlyphName } from "./glyphs";
import {
  NativeNavigationBar,
  NativeSearchField,
  NativeSearchTab,
  NativeTabAccessory,
  NativeTabBar,
  NativeToolbar,
  type BarItem,
  type MenuItem,
  type Tab,
  type TextFieldCommands,
} from "./specs";

/**
 * App chrome the page drives: a tab bar, its Search tab and bottom
 * accessory, a navigation bar, a toolbar and a search field. Every tab, item
 * and button is a prop, so a new one needs no app update.
 */

/** Draws a symbol in the web versions; without one, items show their titles. */
export type SymbolRenderer = (systemImage: string) => React.ReactNode;

const GLYPHS: Readonly<Record<string, GlyphName>> = {
  plus: "plus",
  minus: "minus",
  checkmark: "checkmark",
  xmark: "xmark",
  "chevron.left": "chevron.left",
  "chevron.right": "chevron.right",
};

const symbolOf = (systemImage: string | undefined, render?: SymbolRenderer): React.ReactNode => {
  if (systemImage === undefined) return null;
  if (render) return render(systemImage);
  const glyph = GLYPHS[systemImage];
  return glyph ? <Glyph name={glyph} /> : null;
};

type Button = Extract<BarItem, { id: string; kind?: "button" | "menu" }>;

const isButton = (item: BarItem): item is Button =>
  item.kind !== "spacer" && item.kind !== "flexibleSpace";

/** A web menu of `items`, opened by its label. */
const WebItemMenu = ({
  label,
  items,
  onSelect,
}: {
  label: React.ReactNode;
  items: readonly MenuItem[];
  onSelect: (id: string) => void;
}) => {
  const [open, setOpen] = React.useState(false);
  const flat = (entries: readonly MenuItem[]): MenuItem[] =>
    entries.flatMap((item) => (item.children ? flat(item.children) : [item]));
  return (
    <span className="ni-bar-menu">
      <button
        type="button"
        className="ni-bar-button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {label}
      </button>
      {open && (
        <span className="ni-menu-list" role="menu">
          {flat(items).map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="ni-menu-item"
              data-destructive={item.destructive ? "" : undefined}
              onClick={() => {
                setOpen(false);
                onSelect(item.id);
              }}
            >
              {item.title}
              {item.checked && <Glyph name="checkmark" />}
            </button>
          ))}
        </span>
      )}
    </span>
  );
};

/** The web version of a run of bar items, grouped as the native bar groups them. */
export const WebBarItems = ({
  items,
  onSelect,
  icon,
}: {
  items: readonly BarItem[];
  onSelect: (id: string) => void;
  icon?: SymbolRenderer;
}) => (
  <span className="ni-bar-items">
    {items.map((item, index) => {
      if (!isButton(item)) {
        return (
          <span key={item.id ?? `space-${index}`} className="ni-bar-space" data-kind={item.kind} />
        );
      }
      const symbol = symbolOf(item.systemImage, icon);
      const label = (
        <>
          {symbol && <span className="ni-icon">{symbol}</span>}
          {(item.title || !symbol) && <span>{item.title ?? item.systemImage}</span>}
        </>
      );
      return (
        <span
          key={item.id}
          className="ni-glass ni-glass--pill ni-bar-item"
          data-prominent={item.prominent ? "" : undefined}
          style={cssVariables({ "--ni-tint": item.tint })}
        >
          {item.kind === "menu" || item.items ? (
            <WebItemMenu label={label} items={item.items ?? []} onSelect={onSelect} />
          ) : (
            <button
              type="button"
              className="ni-bar-button"
              aria-label={item.title ?? item.systemImage}
              disabled={item.disabled}
              onClick={() => onSelect(item.id)}
            >
              {label}
            </button>
          )}
        </span>
      );
    })}
  </span>
);

/** A toolbar: buttons and menus grouped on glass, with `spacer` and `flexibleSpace` between groups. */
export const Toolbar = ({
  items,
  tint,
  icon,
  onSelect,
  children,
  ...common
}: NativeCommonProps & {
  items: readonly BarItem[];
  tint?: string;
  icon?: SymbolRenderer;
  onSelect?: (id: string) => void;
}) => {
  const select = (id: string) => onSelect?.(id);
  return (
    <NativeToolbar items={items} tint={tint} onSelect={({ id }) => select(id)} {...common}>
      {children ?? (
        <div className="ni-toolbar" role="toolbar">
          <WebBarItems items={items} onSelect={select} icon={icon} />
        </div>
      )}
    </NativeToolbar>
  );
};

/**
 * A navigation bar: Back while `showsBack`, the inline title, and `leading`
 * and `trailing` items. It stays put while the page slides screens under it.
 */
export const NavigationBar = ({
  title,
  titleShown = true,
  showsBack = false,
  backTitle,
  leading = [],
  trailing = [],
  tint,
  icon,
  onBack,
  onSelect,
  children,
  ...common
}: NativeCommonProps & {
  title: string;
  titleShown?: boolean;
  showsBack?: boolean;
  backTitle?: string;
  leading?: readonly BarItem[];
  trailing?: readonly BarItem[];
  tint?: string;
  icon?: SymbolRenderer;
  onBack?: () => void;
  onSelect?: (id: string) => void;
}) => {
  const select = (id: string) => onSelect?.(id);
  return (
    <NativeNavigationBar
      title={title}
      titleShown={titleShown}
      showsBack={showsBack}
      backTitle={backTitle}
      leading={leading}
      trailing={trailing}
      tint={tint}
      onBack={onBack}
      onSelect={({ id }) => select(id)}
      {...common}
    >
      {children ?? (
        <div className="ni-navbar" style={cssVariables({ "--ni-tint": tint })}>
          <div className="ni-navbar-leading">
            {showsBack && (
              <button
                type="button"
                className="ni-glass ni-glass--pill ni-navbar-back"
                aria-label="Back"
                onClick={onBack}
              >
                <Glyph name="chevron.left" />
                {backTitle}
              </button>
            )}
            <WebBarItems items={leading} onSelect={select} icon={icon} />
          </div>
          <div className="ni-navbar-title" data-shown={titleShown ? "" : undefined}>
            {title}
          </div>
          <div className="ni-navbar-trailing">
            <WebBarItems items={trailing} onSelect={select} icon={icon} />
          </div>
        </div>
      )}
    </NativeNavigationBar>
  );
};

/** A floating tab bar, the system `UITabBar` with its Liquid Glass lens, from `tabs`. */
export const TabBar = ({
  tabs,
  selectedId,
  tint,
  glassGroup,
  icon,
  onSelect,
  children,
  ...common
}: NativeCommonProps & {
  tabs: readonly Tab[];
  /** None of the tabs is selected for an id it doesn't have, such as while Search shows. */
  selectedId: string;
  tint?: string;
  glassGroup?: string;
  icon?: SymbolRenderer;
  onSelect: (id: string) => void;
}) => (
  <NativeTabBar
    tabs={tabs}
    selectedId={selectedId}
    selectedIndex={tabs.findIndex((tab) => tab.id === selectedId)}
    tint={tint}
    glassGroup={glassGroup}
    onSelect={({ id }) => onSelect(id)}
    accessibility={{ label: "Tab Bar" }}
    {...common}
  >
    {children ?? (
      <div className="ni-tab-bar" role="tablist" style={cssVariables({ "--ni-tint": tint })}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className="ni-tab"
            aria-selected={tab.id === selectedId}
            onClick={() => onSelect(tab.id)}
          >
            <span className="ni-icon">{symbolOf(tab.systemImage, icon)}</span>
            {tab.title}
            {tab.badge !== undefined && <span className="ni-badge">{tab.badge}</span>}
          </button>
        ))}
      </div>
    )}
  </NativeTabBar>
);

/** The Search tab of iOS 26: a glass circle beside the tab bar. */
export const SearchTab = ({
  selected,
  tint,
  icon,
  onPress,
  children,
  ...common
}: NativeCommonProps & {
  selected: boolean;
  tint?: string;
  icon?: React.ReactNode;
  onPress: () => void;
}) => (
  <NativeSearchTab
    selected={selected}
    tint={tint}
    onPress={onPress}
    accessibility={{ label: "Search", traits: selected ? ["selected"] : undefined }}
    {...common}
  >
    {children ?? (
      <button
        type="button"
        role="tab"
        className="ni-glass ni-glass--circle ni-search-tab"
        aria-label="Search"
        aria-selected={selected}
        style={cssVariables({ "--ni-tint": tint })}
        onClick={onPress}
      >
        {icon ?? "⌕"}
      </button>
    )}
  </NativeSearchTab>
);

/** The handle of a search field: `focus()` and `blur()`. */
export type SearchFieldHandle = { focus: () => void; blur: () => void };

/** A search field on a glass capsule, as a search tab shows it; what is typed flows as state. */
export const SearchField = ({
  text,
  placeholder = "Search",
  tint,
  glassGroup,
  onChange,
  onSubmit,
  handle,
  children,
  ...common
}: NativeCommonProps & {
  text: string;
  placeholder?: string;
  tint?: string;
  glassGroup?: string;
  onChange: (text: string) => void;
  onSubmit?: (text: string) => void;
  handle?: React.Ref<SearchFieldHandle>;
}) => {
  const island = React.useRef<NativeHandle<TextFieldCommands>>(null);
  const input = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(
    handle,
    () => ({
      focus: () => {
        input.current?.focus();
        void island.current?.command("focus").catch(() => {});
      },
      blur: () => {
        input.current?.blur();
        void island.current?.command("blur").catch(() => {});
      },
    }),
    [],
  );
  return (
    <NativeSearchField
      ref={island}
      text={text}
      placeholder={placeholder}
      tint={tint}
      glassGroup={glassGroup}
      onTextChange={onChange}
      onSubmit={({ text: submitted }) => onSubmit?.(submitted)}
      accessibility={{ label: placeholder }}
      {...common}
    >
      {children ?? (
        <form
          className="ni-glass ni-glass--pill ni-search-field"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit?.(text);
          }}
        >
          <input
            ref={input}
            type="search"
            value={text}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        </form>
      )}
    </NativeSearchField>
  );
};

/** The bottom accessory of a tab view, such as a mini player: a glass capsule above the tab bar. */
export const TabAccessory = ({
  title,
  subtitle,
  systemImage,
  actions = [],
  tint,
  icon,
  onPress,
  onAction,
  children,
  ...common
}: NativeCommonProps & {
  title: string;
  subtitle?: string;
  systemImage?: string;
  actions?: readonly BarItem[];
  tint?: string;
  icon?: SymbolRenderer;
  onPress?: () => void;
  onAction?: (id: string) => void;
}) => (
  <NativeTabAccessory
    title={title}
    subtitle={subtitle}
    systemImage={systemImage}
    actions={actions}
    tint={tint}
    onPress={onPress}
    onAction={({ id }) => onAction?.(id)}
    accessibility={{ label: subtitle ? `${title}, ${subtitle}` : title }}
    {...common}
  >
    {children ?? (
      <div className="ni-glass ni-glass--pill ni-tab-accessory">
        <button type="button" className="ni-tab-accessory-main" onClick={onPress}>
          {systemImage && (
            <span className="ni-tab-accessory-art">{symbolOf(systemImage, icon)}</span>
          )}
          <span className="ni-tab-accessory-text">
            <span className="ni-tab-accessory-title">{title}</span>
            {subtitle && <span className="ni-tab-accessory-subtitle">{subtitle}</span>}
          </span>
        </button>
        <WebBarItems items={actions} onSelect={(id) => onAction?.(id)} icon={icon} />
      </div>
    )}
  </NativeTabAccessory>
);

export type TabViewTab = Tab & { content: React.ReactNode };

/**
 * A tab view, as SwiftUI's: the selected tab's content, with the floating
 * tab bar, an optional Search tab and an optional bottom accessory over it.
 * Every tab keeps its content mounted, so going back to one is instant.
 */
export const TabView = ({
  tabs,
  selectedId,
  onSelect,
  search,
  accessory,
  tint,
  icon,
  native,
}: {
  tabs: readonly TabViewTab[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Adds the Search tab, showing `content` while selected. */
  search?: { content: React.ReactNode };
  /** A bottom accessory above the bar. */
  accessory?: React.ReactNode;
  tint?: string;
  icon?: SymbolRenderer;
  native?: boolean;
}) => {
  const searching = search !== undefined && selectedId === "search";
  return (
    <div className="ni-tab-view">
      {tabs.map((tab) => (
        <section
          key={tab.id}
          className="ni-tab-view-page"
          hidden={tab.id !== selectedId}
          aria-label={tab.title}
        >
          {tab.content}
        </section>
      ))}
      {search && (
        <section className="ni-tab-view-page" hidden={!searching} aria-label="Search">
          {search.content}
        </section>
      )}
      <div className="ni-tab-view-bottom">
        {accessory && <div className="ni-tab-view-accessory">{accessory}</div>}
        <nav className="ni-tab-view-bar">
          <div className="ni-tab-view-tabs">
            <TabBar
              tabs={tabs.map(({ content: _content, ...tab }) => tab)}
              selectedId={selectedId}
              tint={tint}
              icon={icon}
              native={native}
              glassGroup="ni-tab-view"
              onSelect={onSelect}
            />
          </div>
          {search && (
            <SearchTab
              selected={searching}
              tint={tint}
              native={native}
              icon={symbolOf("magnifyingglass", icon)}
              onPress={() => onSelect("search")}
            />
          )}
        </nav>
      </div>
    </div>
  );
};

/** A stack of screen ids: `push`, `pop` and `popToRoot`, for a `NavigationStack`. */
export const useNavigationPath = (root: string) => {
  const [path, setPath] = React.useState<readonly string[]>([root]);
  return {
    path,
    setPath,
    push: React.useCallback((screen: string) => setPath((current) => [...current, screen]), []),
    pop: React.useCallback(
      () => setPath((current) => (current.length > 1 ? current.slice(0, -1) : current)),
      [],
    ),
    popToRoot: React.useCallback(() => setPath((current) => current.slice(0, 1)), []),
  };
};

export type NavigationScreen = {
  title: string;
  /** Shows the title large at the top of the screen, and inline once it scrolls away. */
  largeTitle?: boolean;
  leading?: readonly BarItem[];
  trailing?: readonly BarItem[];
  render: () => React.ReactNode;
};

/**
 * A navigation stack the page drives: the screen on top of `path`, sliding in
 * on a push and out on a pop, under one native navigation bar whose Back pops.
 * The screen below stays mounted, so Back is instant.
 */
export const NavigationStack = ({
  path,
  onPathChange,
  screens,
  tint,
  icon,
  native,
  onSelect,
}: {
  path: readonly string[];
  onPathChange: (path: readonly string[]) => void;
  screens: Readonly<Record<string, NavigationScreen>>;
  tint?: string;
  icon?: SymbolRenderer;
  native?: boolean;
  /** A bar item was chosen on the screen on top. */
  onSelect?: (id: string, screen: string) => void;
}) => {
  const top = path.at(-1) ?? "";
  const screen = screens[top];
  const [scrolled, setScrolled] = React.useState(false);
  const previous = React.useRef(path.length);
  const direction = path.length >= previous.current ? "push" : "pop";
  React.useEffect(() => {
    previous.current = path.length;
    setScrolled(false);
  }, [path.length]);
  return (
    <div className="ni-navigation-stack">
      <header className="ni-navigation-stack-bar">
        <NavigationBar
          title={screen?.title ?? ""}
          titleShown={!screen?.largeTitle || scrolled}
          showsBack={path.length > 1}
          leading={screen?.leading}
          trailing={screen?.trailing}
          tint={tint}
          icon={icon}
          native={native}
          onBack={() => onPathChange(path.slice(0, -1))}
          onSelect={(id) => onSelect?.(id, top)}
        />
      </header>
      {path.map((id, index) => {
        const entry = screens[id];
        const onTop = index === path.length - 1;
        if (!entry || index < path.length - 2) return null;
        return (
          <div
            key={`${index}-${id}`}
            className="ni-navigation-stack-screen"
            data-place={onTop ? "top" : "below"}
            data-motion={onTop ? direction : undefined}
            aria-hidden={onTop ? undefined : true}
            inert={onTop ? undefined : true}
            onScroll={
              onTop && entry.largeTitle
                ? (event) => setScrolled(event.currentTarget.scrollTop > 40)
                : undefined
            }
          >
            {entry.largeTitle && <h1 className="ni-large-title">{entry.title}</h1>}
            {entry.render()}
          </div>
        );
      })}
    </div>
  );
};
