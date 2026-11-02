import * as React from "react";
import { Glass, Switch } from "../components/controls";
import { Scenario } from "../components/Scenario";

const ROWS = [
  "Unlimited projects",
  "Offline mode",
  "Family sharing",
  "Priority support",
  "Themes",
  "Exports",
  "Widgets",
  "Sync",
];

export default function Scrolling() {
  const [enabled, setEnabled] = React.useState<Record<string, boolean>>({ "Offline mode": true });
  const toggle = (row: string) => (isOn: boolean) =>
    setEnabled((current) => ({ ...current, [row]: isOn }));

  return (
    <main className="page">
      <h1>Scrolling</h1>
      <p className="lede">
        Each page scrolls on its own. Islands live inside the scroll view they belong to, so they
        move with it without a message per frame.
      </p>
      <Scenario id="S16" title="In the page's own scroll" expect="native">
        <Glass title="Scroll me with the page" />
      </Scenario>
      <Scenario id="S17" title="Rows in an inner list" expect="native">
        <div className="list" style={{ width: "100%" }}>
          {ROWS.map((row) => (
            <div key={row} className="list-row">
              <span>{row}</span>
              <Switch label={row} isOn={enabled[row] ?? false} onChange={toggle(row)} />
            </div>
          ))}
        </div>
      </Scenario>
      <Scenario id="S18" title="A horizontal carousel" expect="native">
        <div className="carousel" style={{ width: "100%" }}>
          {["Weekly", "Monthly", "Annual", "Lifetime"].map((plan) => (
            <div key={plan} className="carousel-card">
              <strong>{plan}</strong>
              <Glass title={`Choose ${plan}`} />
            </div>
          ))}
        </div>
      </Scenario>
      <Scenario id="S19" title="A carousel inside a list" expect="native">
        <div className="list" style={{ width: "100%" }}>
          <div className="list-row">Swipe the row below</div>
          <div className="carousel">
            {["A", "B", "C", "D"].map((card) => (
              <div key={card} className="carousel-card">
                <Glass title={`Nested ${card}`} />
              </div>
            ))}
          </div>
          {ROWS.slice(0, 4).map((row) => (
            <div key={row} className="list-row">
              {row}
            </div>
          ))}
        </div>
      </Scenario>
      <Scenario id="S20" title="Half scrolled out of its list" expect="native">
        <div className="list" style={{ width: "100%", height: 120 }}>
          <div style={{ height: 96 }} />
          <div className="list-row">
            <Glass title="Cut by the list's edge" />
          </div>
          <div style={{ height: 200 }} />
        </div>
      </Scenario>
      <Scenario id="S23" title="An inner box that does not overflow" expect="native">
        <div className="list" style={{ width: "100%", height: "auto" }}>
          <div className="list-row">
            <Glass title="Anchored to the page scroll" />
          </div>
        </div>
      </Scenario>
      <div style={{ height: 600 }} aria-hidden="true" />
      <Scenario id="S24" title="At the very bottom of a long page" expect="native">
        <Glass title="Found me" />
      </Scenario>
      <div className="footer-cta" data-scenario="S21" data-expect="native">
        <Glass block prominence="prominent" tint="var(--accent)" title="Sticky footer" />
      </div>
    </main>
  );
}
