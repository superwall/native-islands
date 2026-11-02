import * as React from "react";
import { useRouteActive } from "../router";
import { SystemSymbol } from "../components/defaults";
import { Glass } from "../components/controls";
import { Scenario } from "../components/Scenario";

const SYMBOLS = Array.from({ length: 48 }, (_, index) => index);

export default function Stress() {
  const [count, setCount] = React.useState(0);
  const [present, setPresent] = React.useState(true);

  const active = useRouteActive();

  React.useEffect(() => {
    if (!active) return;
    const ticker = setInterval(() => setCount((value) => value + 1), 100);
    const blinker = setInterval(() => setPresent((value) => !value), 500);
    return () => {
      clearInterval(ticker);
      clearInterval(blinker);
    };
  }, [active]);

  return (
    <main className="page">
      <h1>Stress</h1>
      <p className="lede">Many islands, fast updates, constant mounting.</p>
      <Scenario id="S38" title="48 islands at once" expect="native">
        <div className="grid" style={{ width: "100%" }}>
          {SYMBOLS.map((index) => (
            <SystemSymbol key={index} name="star.fill" tint="var(--accent)">
              <span className="glass glass--icon" role="img" aria-label={`Star ${index + 1}`}>
                ★
              </span>
            </SystemSymbol>
          ))}
        </div>
      </Scenario>
      <Scenario id="S39" title="A title that changes ten times a second" expect="native">
        <Glass title={`Tick ${count}`} />
      </Scenario>
      <Scenario id="S40" title="Mounting and unmounting twice a second" expect="native">
        {present ? <Glass title="Blink" /> : <span className="glass">Gone</span>}
      </Scenario>
    </main>
  );
}
