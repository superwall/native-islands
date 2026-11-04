import { useAccent, useNativeEnabled } from "../app/preferences";
import { BAR_TABS, type TabId } from "../app/navigation";
import { NativeSearchTab, NativeTabBar } from "../islands/definitions";
import { WebSymbol } from "./icons";

type BarTab = (typeof BAR_TABS)[number];

const TITLES: Record<BarTab, string> = {
  components: "Components",
  capabilities: "Capabilities",
  settings: "Settings",
};

const SYMBOLS: Record<BarTab, string> = {
  components: "shippingbox.fill",
  capabilities: "sparkles",
  settings: "gearshape.fill",
};

/**
 * The floating Liquid Glass tab bar of iOS 26, drawn natively over the
 * pages, with Search as its own glass button beside it.
 */
export const TabBar = ({
  selected,
  onSelect,
}: {
  selected: TabId;
  onSelect: (tab: TabId) => void;
}) => {
  const select = (index: number) => {
    const tab = BAR_TABS[index];
    if (tab) onSelect(tab);
  };
  const accent = useAccent();
  const native = useNativeEnabled();
  const searching = selected === "search";
  return (
    <nav className="tab-bar">
      <div className="tab-bar-tabs">
        <NativeTabBar
          islandId="tab-bar"
          glassGroup="tab-bar"
          titles={BAR_TABS.map((tab) => TITLES[tab])}
          symbols={BAR_TABS.map((tab) => SYMBOLS[tab])}
          selectedIndex={searching ? -1 : BAR_TABS.indexOf(selected)}
          tint={accent}
          native={native}
          onSelect={({ index }) => select(index)}
        >
          <div className="web-tab-bar" role="tablist">
            {BAR_TABS.map((tab, index) => (
              <button
                key={tab}
                type="button"
                role="tab"
                className="web-tab"
                aria-selected={tab === selected}
                onClick={() => select(index)}
              >
                <WebSymbol name={SYMBOLS[tab]} />
                {TITLES[tab]}
              </button>
            ))}
          </div>
        </NativeTabBar>
      </div>
      <NativeSearchTab
        islandId="tab-bar-search"
        selected={searching}
        tint={accent}
        native={native}
        accessibility={{ label: "Search", traits: searching ? ["selected"] : undefined }}
        onPress={() => onSelect("search")}
      >
        <button
          type="button"
          role="tab"
          className="glass-circle tab-bar-search"
          aria-label="Search"
          aria-selected={searching}
          onClick={() => onSelect("search")}
        >
          <WebSymbol name="magnifyingglass" />
        </button>
      </NativeSearchTab>
    </nav>
  );
};
