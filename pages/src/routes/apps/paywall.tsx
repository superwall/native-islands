import * as React from "react";
import { Glass, Switch } from "../../components/controls";
import { SFSymbol } from "../../components/icons";
import { PlanPicker } from "../../components/stateful";

const FEATURES = [
  { symbol: "sparkles", title: "Smart summaries", detail: "Every note, distilled in a tap." },
  { symbol: "icloud.fill", title: "Sync everywhere", detail: "iPhone, iPad and Mac, instantly." },
  {
    symbol: "lock.shield.fill",
    title: "Private by design",
    detail: "End-to-end encrypted vaults.",
  },
  { symbol: "bolt.fill", title: "Offline first", detail: "Works on a plane, a train, a hike." },
];

const PLANS = [
  { id: "annual", title: "Annual", price: "$59.99 / year" },
  { id: "monthly", title: "Monthly", price: "$7.99 / month" },
];

/**
 * A subscription paywall: native SF Symbols down a feature list, the app's own
 * native plan picker, a trial switch, and a glass call to action stuck to the
 * bottom of the screen while the terms scroll under it.
 */
export default function Paywall() {
  const [plan, setPlan] = React.useState("annual");
  const [trial, setTrial] = React.useState(true);
  const chosen = PLANS.find((candidate) => candidate.id === plan) ?? PLANS[0];

  return (
    <main className="page app app--paywall" data-scenario="A02" data-expect="native">
      <div className="paywall-hero" aria-hidden="true">
        <span className="orb orb--one" />
        <span className="orb orb--two" />
      </div>
      <div className="paywall-head">
        <span className="micro">Atlas Pro</span>
        <h1>Think in one place.</h1>
        <p className="lede">Everything you write, organised and searchable on every device.</p>
      </div>
      <ul className="features">
        {FEATURES.map((feature) => (
          <li key={feature.title}>
            <span className="feature-icon">
              <SFSymbol name={feature.symbol} tint="#7c5cff" size={22} weight="semibold" />
            </span>
            <span>
              <strong>{feature.title}</strong>
              <span className="lede">{feature.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <PlanPicker
        plans={PLANS}
        selected={plan}
        onStateChange={(state) => {
          if (typeof state.selected === "string") setPlan(state.selected);
        }}
      >
        <div className="plans" role="radiogroup" aria-label="Plan">
          {PLANS.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              role="radio"
              aria-checked={candidate.id === plan}
              className="plan"
              onClick={() => setPlan(candidate.id)}
            >
              <strong>{candidate.title}</strong>
              <span>{candidate.price}</span>
            </button>
          ))}
        </div>
      </PlanPicker>
      <div className="row">
        <span>
          <strong>Free for 7 days</strong>
          <span className="lede">Cancel anytime before it ends.</span>
        </span>
        <Switch label="Free trial" isOn={trial} onChange={setTrial} />
      </div>
      <p className="lede small">
        {trial ? `7 days free, then ${chosen.price}.` : `${chosen.price}, starting today.`} Payment
        is charged to your Apple Account at confirmation. Subscriptions renew automatically unless
        cancelled at least 24 hours before the end of the period. Manage or cancel in Settings.
      </p>
      <div className="footer-cta paywall-footer">
        <Glass
          block
          islandId="paywall-cta"
          prominence="prominent"
          tint="#7c5cff"
          title={trial ? "Start free trial" : "Subscribe"}
        />
        <Glass title="Restore purchases" />
      </div>
    </main>
  );
}
