import * as React from "react";
import type { NativeCommonProps, NativeHandle } from "../react/components/Native";
import { ISLAND_PHASE_ATTRIBUTE } from "../layout/attributes";
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
  name,
  items,
  onSelect,
}: {
  label: React.ReactNode;
  name: string | undefined;
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
        aria-label={name}
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
      const name = item.accessibilityLabel || item.title || item.systemImage;
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
            <WebItemMenu label={label} name={name} items={item.items ?? []} onSelect={onSelect} />
          ) : (
            <button
              type="button"
              className="ni-bar-button"
              aria-label={name}
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
        className="ni-glass ni-glass--circle ni-search-tab"
        aria-label="Search"
        aria-current={selected ? "page" : undefined}
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

/**
 * One tab's content. Tabs that are not selected wait below, each at its own
 * spot, instead of `display: none`: hiding a scrolling area makes WebKit drop
 * its native scroll view, and the islands in it with it. Parked, they keep
 * their scroll views and their islands, so a tab comes back drawn. They wait
 * below, never beside: a `NavigationStack` parks pushed screens beside it,
 * and the host tells scrolling areas apart by size and place.
 */
const TabPage = ({
  index,
  selected,
  label,
  children,
}: React.PropsWithChildren<{ index: number; selected: boolean; label: string }>) => (
  <section
    className="ni-tab-view-page"
    data-selected={selected}
    style={selected ? undefined : { top: `${(index + 1) * 200}%` }}
    aria-label={label}
    aria-hidden={selected ? undefined : true}
    inert={selected ? undefined : true}
  >
    {children}
  </section>
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
      {tabs.map((tab, index) => (
        <TabPage key={tab.id} index={index} selected={tab.id === selectedId} label={tab.title}>
          {tab.content}
        </TabPage>
      ))}
      {search && (
        <TabPage index={tabs.length} selected={searching} label="Search">
          {search.content}
        </TabPage>
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

const startsWith = (path: readonly string[], prefix: readonly string[]) =>
  prefix.length <= path.length && prefix.every((id, index) => path[index] === id);

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && startsWith(a, b);

/**
 * A stack of screen ids for a `NavigationStack`: `push`, `pop`, `popToRoot`
 * and `popTo(id)`, plus `forward()`, which pushes again what the last pops
 * took off, as a browser's Forward does, while `canGoForward`.
 */
export const useNavigationPath = (root: string) => {
  const [state, setState] = React.useState<{
    path: readonly string[];
    ahead: readonly string[];
  }>({ path: [root], ahead: [] });
  const go = React.useCallback(
    (next: (path: readonly string[]) => readonly string[]) =>
      setState(({ path, ahead }) => {
        const to = next(path);
        if (sameIds(to, path)) return { path, ahead };
        if (to.length >= path.length) return { path: to, ahead: [] };
        // A stack of what pops took off, the next screen Forward pushes last.
        // Built by hand: `toReversed()` is missing from older WebKit.
        const popped: string[] = [];
        for (const id of path.slice(to.length)) popped.unshift(id);
        return { path: to, ahead: [...ahead, ...popped] };
      }),
    [],
  );
  return {
    path: state.path,
    canGoForward: state.ahead.length > 0,
    setPath: React.useCallback((path: readonly string[]) => go(() => path), [go]),
    push: React.useCallback((screen: string) => go((path) => [...path, screen]), [go]),
    pop: React.useCallback(() => go((path) => (path.length > 1 ? path.slice(0, -1) : path)), [go]),
    popToRoot: React.useCallback(() => go((path) => path.slice(0, 1)), [go]),
    popTo: React.useCallback(
      (screen: string) =>
        go((path) => {
          const index = path.indexOf(screen);
          return index < 0 ? path : path.slice(0, index + 1);
        }),
      [go],
    ),
    forward: React.useCallback(
      () =>
        setState((current) => {
          const next = current.ahead.at(-1);
          return next === undefined
            ? current
            : { path: [...current.path, next], ahead: current.ahead.slice(0, -1) };
        }),
      [],
    ),
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

/** How long a push or a pop slides, as UINavigationController does. */
export const NAVIGATION_SLIDE_MS = 500;

/** How long a pushed screen waits off to the side for its islands before it slides in anyway. */
export const NAVIGATION_MOUNT_WAIT_MS = 250;

type Place = "top" | "below" | "parked" | "away";

type Motion = "push-in" | "push-under" | "pop-out" | "pop-under";

type Transition =
  | { kind: "push"; stage: "mounting" | "moving"; key: number }
  | { kind: "pop"; stage: "moving"; key: number; to: readonly string[] };

const placeOf = (
  index: number,
  shown: readonly string[],
  transition: Transition | undefined,
): { place: Place; motion?: Motion } => {
  const last = shown.length - 1;
  if (transition?.kind === "push") {
    if (index === last)
      return transition.stage === "moving"
        ? { place: "top", motion: "push-in" }
        : { place: "parked" };
    if (index === last - 1)
      return transition.stage === "moving"
        ? { place: "below", motion: "push-under" }
        : { place: "top" };
    return { place: "away" };
  }
  if (transition?.kind === "pop") {
    if (index === last) return { place: "top", motion: "pop-out" };
    if (index === transition.to.length - 1) return { place: "below", motion: "pop-under" };
    return { place: "away" };
  }
  if (index === last) return { place: "top" };
  return { place: index === last - 1 ? "below" : "away" };
};

const nextFrames = (frames: number, done: () => void) => {
  let frame = 0;
  const step = (left: number) => {
    frame = requestAnimationFrame(() => (left > 1 ? step(left - 1) : done()));
  };
  step(frames);
  return () => cancelAnimationFrame(frame);
};

/**
 * A navigation stack the page drives: the screen on top of `path`, sliding in
 * on a push and out on a pop, under one native navigation bar whose Back pops.
 *
 * Every screen on the path stays mounted, so Back is instant and its islands
 * are already drawn. A pushed screen first waits off to the side until its
 * islands are placed (a few frames, at most `NAVIGATION_MOUNT_WAIT_MS`),
 * then slides in with `data-island-phase` set, so its native views slide
 * with it instead of showing their web versions.
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
  const [shown, setShown] = React.useState<readonly string[]>(path);
  const [transition, setTransition] = React.useState<Transition>();
  const [scrolled, setScrolled] = React.useState(false);
  const counter = React.useRef(0);
  // Where each pushed screen waits off to the side. The host tells scrolling
  // areas apart by size and place, so no two screens ever wait at the same
  // spot, not even a screen pushed again where one just popped from.
  const parking = React.useRef(new Map<string, number>());
  const parkedAt = (key: string) => {
    let slot = parking.current.get(key);
    if (slot === undefined) {
      slot = (counter.current % 32) + 1;
      parking.current.set(key, slot);
    }
    return slot;
  };
  const reduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  React.useLayoutEffect(() => {
    const target = transition?.kind === "pop" ? transition.to : shown;
    if (sameIds(path, target)) return;
    counter.current += 1;
    const key = counter.current;
    setScrolled(false);
    if (reduced) {
      setShown(path);
      setTransition(undefined);
    } else if (path.length > shown.length && startsWith(path, shown) && !transition) {
      setShown(path);
      setTransition({ kind: "push", stage: "mounting", key });
    } else if (path.length < shown.length && startsWith(shown, path) && !transition) {
      setTransition({ kind: "pop", stage: "moving", key, to: path });
    } else {
      setShown(path);
      setTransition(undefined);
    }
  }, [path, shown, transition, reduced]);

  React.useEffect(() => {
    if (transition?.kind !== "push" || transition.stage !== "mounting") return;
    const { key } = transition;
    let moved = false;
    // The frames or the wait, whichever comes first.
    const move = () => {
      if (moved) return;
      moved = true;
      setTransition({ kind: "push", stage: "moving", key });
    };
    // One frame to measure the new screen's islands, one for their frames to
    // reach the host, one for the host to place them.
    const cancel = nextFrames(3, move);
    const timer = setTimeout(move, NAVIGATION_MOUNT_WAIT_MS);
    return () => {
      cancel();
      clearTimeout(timer);
    };
  }, [transition]);

  React.useEffect(() => {
    if (transition?.stage !== "moving") return;
    const timer = setTimeout(() => {
      if (transition.kind === "pop") setShown(transition.to);
      setTransition(undefined);
    }, NAVIGATION_SLIDE_MS);
    return () => clearTimeout(timer);
  }, [transition]);

  for (const key of parking.current.keys()) {
    if (!shown.some((id, index) => `${index}-${id}` === key)) parking.current.delete(key);
  }
  const current = transition?.kind === "pop" ? transition.to : path;
  const top = current.at(-1) ?? "";
  const screen = screens[top];
  return (
    <div className="ni-navigation-stack">
      <header className="ni-navigation-stack-bar">
        <NavigationBar
          title={screen?.title ?? ""}
          titleShown={!screen?.largeTitle || scrolled}
          showsBack={current.length > 1}
          leading={screen?.leading}
          trailing={screen?.trailing}
          tint={tint}
          icon={icon}
          native={native}
          onBack={() => onPathChange(current.slice(0, -1))}
          onSelect={(id) => onSelect?.(id, top)}
        />
      </header>
      {shown.map((id, index) => {
        const entry = screens[id];
        if (!entry) return null;
        const { place, motion } = placeOf(index, shown, transition);
        // Islands on an inert screen keep the frame they were last measured
        // at, so a pushed screen goes live while it waits off to the side,
        // and nothing is live while screens slide.
        const live =
          transition?.kind === "push" && transition.stage === "mounting"
            ? place === "parked" || place === "top"
            : place === "top" && !transition;
        const key = `${index}-${id}`;
        return (
          <section
            key={key}
            className="ni-navigation-stack-screen"
            // Out of sight, a screen waits at its own spot rather than hidden:
            // hiding a scrolling area makes WebKit drop its native scroll view
            // and the islands in it, so Back would show an empty screen.
            style={
              place === "parked" || place === "away"
                ? { left: `${parkedAt(key) * 100}%` }
                : undefined
            }
            data-place={place}
            data-motion={motion}
            aria-hidden={live ? undefined : true}
            inert={live ? undefined : true}
            {...(motion ? { [ISLAND_PHASE_ATTRIBUTE]: motion } : {})}
          >
            <div
              className="ni-navigation-stack-scroll"
              onScroll={
                entry.largeTitle && index === shown.length - 1
                  ? (event) => setScrolled(event.currentTarget.scrollTop > 40)
                  : undefined
              }
            >
              <div className="ni-navigation-stack-content">
                {entry.largeTitle && <h1 className="ni-large-title">{entry.title}</h1>}
                {entry.render()}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
};
