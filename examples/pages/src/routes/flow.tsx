import * as React from "react";
import { Glass, Segments, Switch } from "../components/controls";
import { Scenario } from "../components/Scenario";
import { useRouter } from "../router";

const PLANS = ["Monthly", "Annual", "Lifetime"] as const;

/**
 * Three pages pushed one after another. Every page is rendered from the start,
 * so the islands of the next page are already drawn underneath and slide in
 * with it: no web version shows on push or pop.
 */
export const FlowPlans = () => {
  const router = useRouter();
  const [plan, setPlan] = React.useState(1);
  return (
    <main className="page">
      <span className="micro">Step 1 of 3</span>
      <h1>Pick a plan</h1>
      <p className="lede">
        Push and go back between these pages. The native controls slide with the page instead of
        swapping in once it settles.
      </p>
      <Scenario id="S46" title="Native controls on the first page" expect="native">
        <Segments segments={PLANS} selectedIndex={plan} onChange={setPlan} />
      </Scenario>
      <Scenario id="S47" title="Pushes the next page" expect="native">
        <Glass
          block
          islandId="flow-next-details"
          prominence="prominent"
          tint="var(--accent)"
          title={`Continue with ${PLANS[plan]}`}
          onPress={() => router.push("flow-details")}
        />
      </Scenario>
    </main>
  );
};

export const FlowDetails = () => {
  const router = useRouter();
  const [reminder, setReminder] = React.useState(true);
  const [family, setFamily] = React.useState(false);
  return (
    <main className="page">
      <span className="micro">Step 2 of 3</span>
      <h1>A few details</h1>
      <Scenario id="S48" title="Already drawn before the push" expect="native">
        <div className="list-row" style={{ width: "100%" }}>
          <span>Remind me before the trial ends</span>
          <Switch label="Reminder" isOn={reminder} onChange={setReminder} />
        </div>
        <div className="list-row" style={{ width: "100%" }}>
          <span>Share with family</span>
          <Switch label="Family" isOn={family} onChange={setFamily} />
        </div>
      </Scenario>
      <Glass
        block
        islandId="flow-next-done"
        prominence="prominent"
        tint="var(--accent)"
        title="Start free trial"
        onPress={() => router.push("flow-done")}
      />
    </main>
  );
};

export const FlowDone = () => {
  const router = useRouter();
  return (
    <main className="page">
      <span className="micro">Step 3 of 3</span>
      <h1>You are all set</h1>
      <Scenario id="S49" title="Back to the start" expect="native">
        <Glass title="Done" islandId="flow-done" onPress={() => router.reset()} />
      </Scenario>
    </main>
  );
};
