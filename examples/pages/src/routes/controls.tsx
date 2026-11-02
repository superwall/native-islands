import * as React from "react";
import { SystemSymbol } from "@superwall/native-islands/react";
import { Confetti, Rating, RatingV2, SilentBadge, Stars } from "../components/custom";
import { Segments, Switch } from "../components/controls";
import { Scenario } from "../components/Scenario";

export default function Controls() {
  const [annual, setAnnual] = React.useState(true);
  const [plan, setPlan] = React.useState(1);
  const [rating, setRating] = React.useState(4);

  return (
    <main className="page">
      <h1>Controls and app components</h1>
      <p className="lede">
        State lives in React. Native controls report changes back, and React sends the new value to
        them.
      </p>
      <Scenario id="S09" title="Toggle, sized by the system" expect="native">
        <Switch label="Bill annually" isOn={annual} onChange={setAnnual} />
        <span>{annual ? "Annual" : "Monthly"}</span>
      </Scenario>
      <Scenario id="S10" title="Segmented control" expect="native">
        <Segments
          segments={["Weekly", "Annual", "Lifetime"]}
          selectedIndex={plan}
          onChange={setPlan}
        />
      </Scenario>
      <Scenario id="S11" title="SF Symbol" expect="native">
        <SystemSymbol name="crown.fill" tint="var(--accent)" pointSize={28}>
          <span role="img" aria-label="Crown" style={{ fontSize: 28 }}>
            ♛
          </span>
        </SystemSymbol>
      </Scenario>
      <Scenario id="S12" title="An app's own component" expect="native">
        <Rating value={rating} max={5} tint="var(--accent)" onChange={setRating}>
          <button
            type="button"
            className="glass"
            onClick={() => setRating((rating % 5) + 1)}
            aria-label={`Rating, ${rating} of 5`}
          >
            <Stars value={rating} max={5} />
          </button>
        </Rating>
      </Scenario>
      <Scenario id="S13" title="A component the app never registered" expect="web">
        <Confetti intensity={3}>
          <span className="glass">🎉 Web confetti</span>
        </Confetti>
      </Scenario>
      <Scenario id="S14" title="A newer version than the app registered" expect="web">
        <RatingV2 value={3} max={5} halfStars>
          <span className="glass">
            <Stars value={3} max={5} />
          </span>
        </RatingV2>
      </Scenario>
      <Scenario id="S15" title="A host that never answers" expect="web">
        <SilentBadge label="New">
          <span className="glass">New</span>
        </SilentBadge>
      </Scenario>
    </main>
  );
}
