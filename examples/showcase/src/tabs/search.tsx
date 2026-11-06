import * as React from "react";
import type { NativeHandle } from "native-islands/react";
import { searchScreens, useNav, useScreenShowing, type ScreenSpec } from "../app/nav";
import { BAR_TABS, type TabId } from "../app/navigation";
import { useAccent, useNativeEnabled } from "../app/preferences";
import { NativeSearchField } from "native-islands/components";
import { WebSymbol } from "../ui/icons";
import { Row, Section } from "../ui/List";

type SearchCommands = {
  focus: { args: undefined; result: void };
  blur: { args: undefined; result: void };
};

const TAB_TITLES: Record<TabId, string> = {
  components: "Components",
  capabilities: "Capabilities",
  settings: "Settings",
  search: "Search",
};

const SearchField = ({ text, onChange }: { text: string; onChange: (text: string) => void }) => {
  const island = React.useRef<NativeHandle<SearchCommands>>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const native = useNativeEnabled();
  const showing = useScreenShowing();
  const shown = React.useRef(showing);
  React.useEffect(() => {
    if (showing === shown.current) return;
    shown.current = showing;
    const name = showing ? "focus" : "blur";
    if (!native || !island.current) {
      if (showing) input.current?.focus();
      else input.current?.blur();
      return;
    }
    const handle = island.current;
    // The island takes focus only once it is shown on the tab, a frame or two after the switch.
    const timer = setTimeout(() => void handle.command(name).catch(() => {}), showing ? 150 : 0);
    return () => clearTimeout(timer);
  }, [showing, native]);
  return (
    <div className="search-bar">
      <NativeSearchField
        ref={island}
        text={text}
        placeholder="Components, maps, video…"
        tint={useAccent()}
        native={native}
        accessibility={{ label: "Search" }}
        onStateChange={({ text: next }) => next !== undefined && onChange(next)}
      >
        <label className="web-search">
          <WebSymbol name="magnifyingglass" className="web-search-glass" />
          <input
            ref={input}
            type="search"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            aria-label="Search"
            placeholder="Components, maps, video…"
            value={text}
            onChange={(event) => onChange(event.target.value)}
          />
          {text && (
            <button
              type="button"
              className="web-search-clear"
              aria-label="Clear text"
              onClick={() => onChange("")}
            >
              <WebSymbol name="xmark.circle.fill" />
            </button>
          )}
        </label>
      </NativeSearchField>
    </div>
  );
};

/** Results grouped by the tab each demo lives on, in the tab bar's order. */
const byTab = (found: readonly ScreenSpec[]) =>
  BAR_TABS.map((tab) => ({ tab, screens: found.filter((screen) => screen.tab === tab) })).filter(
    (group) => group.screens.length > 0,
  );

const Search = () => {
  const { screens, open } = useNav();
  const [query, setQuery] = React.useState("");
  const found = React.useMemo(() => searchScreens(screens, query), [screens, query]);
  return (
    <>
      <SearchField text={query} onChange={setQuery} />
      {found.length === 0 ? (
        <div className="no-results" role="status">
          <WebSymbol name="magnifyingglass" className="no-results-symbol" />
          <p className="no-results-title">No Results for “{query.trim()}”</p>
          <p className="no-results-text">Check the spelling or try a new search.</p>
        </div>
      ) : (
        byTab(found).map((group) => (
          <Section key={group.tab} header={TAB_TITLES[group.tab]}>
            {group.screens.map((screen) => (
              <Row
                key={screen.id}
                title={screen.title}
                subtitle={screen.section}
                symbol={screen.symbol}
                disclosure
                onPress={() => open(screen.id)}
              />
            ))}
          </Section>
        ))
      )}
    </>
  );
};

export const searchScreen: ScreenSpec = {
  id: "search",
  tab: "search",
  title: "Search",
  symbol: "magnifyingglass",
  largeTitle: true,
  Component: Search,
};
