import { useAccent, useNativeEnabled } from "../app/preferences";
import { TABS, type TabId } from "../app/navigation";
import { NativeTabBar } from "../islands/definitions";
import { WebSymbol } from "./icons";

const TITLES: Record<TabId, string> = {
  components: "Components",
  capabilities: "Capabilities",
  settings: "Settings",
};

const SYMBOLS: Record<TabId, string> = {
  components: "shippingbox.fill",
  capabilities: "sparkles",
  settings: "gearshape.fill",
};

/** The floating Liquid Glass tab bar of iOS 26, drawn natively over the pages. */
export const TabBar = ({
  selected,
  onSelect,
}: {
  selected: TabId;
  onSelect: (tab: TabId) => void;
}) => {
  const select = (index: number) => {
    const tab = TABS[index];
    if (tab) onSelect(tab);
  };
  return (
    <nav className="tab-bar">
      <NativeTabBar
        islandId="tab-bar"
        glassGroup="tab-bar"
        titles={TABS.map((tab) => TITLES[tab])}
        symbols={TABS.map((tab) => SYMBOLS[tab])}
        selectedIndex={TABS.indexOf(selected)}
        tint={useAccent()}
        native={useNativeEnabled()}
        onSelect={({ index }) => select(index)}
      >
        <div className="web-tab-bar" role="tablist">
          {TABS.map((tab, index) => (
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
    </nav>
  );
};
