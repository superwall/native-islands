import * as React from "react";
import { Glass } from "../components/controls";
import { Scenario } from "../components/Scenario";
import { perfCount } from "../perf";

export default function Perf() {
  const [count] = React.useState(() => perfCount(window.location.search));
  const items = React.useMemo(() => Array.from({ length: count }, (_, index) => index), [count]);
  return (
    <main className="page" data-perf-page>
      <h1>Performance</h1>
      <p className="lede">
        {count} glass buttons in one scrolling page, for the performance runs. Open with{" "}
        <code>?route=perf&amp;count=50</code>.
      </p>
      <Scenario id="P01" title={`${count} islands`} expect="native">
        <div className="perf-list" style={{ width: "100%" }}>
          {items.map((index) => (
            <Glass key={index} block islandId={`perf-${index}`} title={`Button ${index + 1}`} />
          ))}
        </div>
      </Scenario>
    </main>
  );
}
