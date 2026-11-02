import { Glass } from "../components/controls";
import { Scenario } from "../components/Scenario";

export default function Buttons() {
  return (
    <main className="page">
      <h1>Glass buttons</h1>
      <p className="lede">
        <code>GlassButton</code> wraps a web button. The web button lays out the page; the native
        one is drawn over it.
      </p>
      <Scenario id="S01" title="Regular" expect="native">
        <Glass title="Continue" />
      </Scenario>
      <Scenario id="S02" title="Prominent, tinted with a CSS token" expect="native">
        <Glass title="Start trial" prominence="prominent" tint="var(--accent)" />
      </Scenario>
      <Scenario id="S03" title="Custom tint" expect="native">
        <Glass title="Upgrade" prominence="prominent" tint="#ee6d2e" />
      </Scenario>
      <Scenario id="S04" title="Disabled" expect="native">
        <Glass title="Unavailable" disabled />
      </Scenario>
      <Scenario id="S05" title="Two buttons in one glass group" expect="native">
        <Glass title="Monthly" glassGroup="plans" />
        <Glass title="Annual" glassGroup="plans" />
      </Scenario>
      <Scenario id="S06" title="A title long enough to wrap" expect="native">
        <Glass title="Unlock every feature, every device, for the whole family" />
      </Scenario>
      <Scenario id="S07" title="Native turned off" expect="web">
        <Glass title="Always web" native={false} />
      </Scenario>
      <Scenario id="S08" title="Inside a line of text" expect="native">
        <p className="lede" style={{ margin: 0 }}>
          Questions? <Glass title="Ask us" /> We answer within a day.
        </p>
      </Scenario>
    </main>
  );
}
