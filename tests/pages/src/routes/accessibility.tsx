import * as React from "react";
import { SegmentedControl, Slider, Stepper, Toggle } from "native-islands/components";
import "native-islands/components.css";
import { Scenario } from "../components/Scenario";

const PLANS = ["Weekly", "Annual", "Lifetime"];

/**
 * The ready-made controls with the web versions they ship, which is what
 * VoiceOver reads and acts on for an island that scrolls with the page.
 */
export default function Accessibility() {
  const [reminders, setReminders] = React.useState(false);
  const [plan, setPlan] = React.useState(1);
  const [volume, setVolume] = React.useState(40);
  const [seats, setSeats] = React.useState(3);

  return (
    <main className="page">
      <h1>VoiceOver</h1>
      <p className="lede">
        VoiceOver reads these islands through their web versions, and its actions change them.
      </p>
      <Scenario id="S50" title="Toggle" expect="native">
        <Toggle label="Reminders" isOn={reminders} onChange={setReminders} />
      </Scenario>
      <Scenario id="S51" title="Segmented control" expect="native">
        <SegmentedControl label="Plan" segments={PLANS} selectedIndex={plan} onChange={setPlan} />
      </Scenario>
      <Scenario id="S52" title="Slider" expect="native">
        <Slider
          label="Volume"
          value={volume}
          minimum={0}
          maximum={100}
          step={10}
          onChange={setVolume}
        />
      </Scenario>
      <Scenario id="S53" title="Stepper" expect="native">
        <Stepper label="Seats" value={seats} minimum={1} maximum={5} onChange={setSeats} />
      </Scenario>
      <pre className="echo" data-testid="echo">
        {JSON.stringify({ reminders, plan: PLANS[plan], volume, seats })}
      </pre>
    </main>
  );
}
