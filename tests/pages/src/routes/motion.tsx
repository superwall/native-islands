import * as React from "react";
import { useRouter } from "../router";
import { Glass } from "../components/controls";
import { NativeGlassButton } from "native-islands/components";
import { Scenario } from "../components/Scenario";

export default function Motion() {
  const router = useRouter();
  const [moved, setMoved] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  return (
    <main className="page">
      <h1>Motion</h1>
      <p className="lede">
        Native views follow their element frame by frame while it moves or resizes, and are drawn
        faded, scaled and rotated the same way the page draws it.
      </p>
      <Scenario id="S25" title="Slides when tapped" expect="native">
        <div className="mover" data-moved={moved}>
          <Glass title={moved ? "Slide back" : "Slide"} onPress={() => setMoved(!moved)} />
        </div>
      </Scenario>
      <Scenario id="S26" title="Inside something that keeps pulsing" expect="native" moving>
        <div className="pulse">
          <Glass title="Always moving" />
        </div>
      </Scenario>
      <Scenario id="S55" title="Below an island whose web version spins" expect="native">
        <NativeGlassButton systemImage="arrow.triangle.2.circlepath">
          <div className="spinner" role="progressbar" aria-busy />
        </NativeGlassButton>
        <div className="solid-card">
          <Glass title="Below the spinner" />
        </div>
        <div className="solid-card">
          <Glass title="Further below" />
        </div>
      </Scenario>
      <Scenario id="S27" title="Inside something whose colour animates" expect="native">
        <div className="glow" style={{ padding: 8 }}>
          <Glass title="Colour is not motion" />
        </div>
      </Scenario>
      <Scenario id="S28" title="Inside an accordion that opens" expect="native">
        <div style={{ width: "100%" }}>
          <Glass title={open ? "Close details" : "Open details"} onPress={() => setOpen(!open)} />
          <div className="expander" style={{ maxHeight: open ? 160 : 0 }}>
            <p className="lede">Annual billing saves 40% compared with monthly.</p>
            <Glass title="Inside the details" />
          </div>
        </div>
      </Scenario>
      <Scenario id="S29" title="Inside a faded container" expect="native">
        <div style={{ opacity: 0.5 }}>
          <Glass title="Half transparent" />
        </div>
      </Scenario>
      <Scenario id="S30" title="Inside a rotated container" expect="native">
        <div style={{ transform: "rotate(-4deg)" }}>
          <Glass title="Tilted" />
        </div>
      </Scenario>
      <Scenario id="S31" title="Inside a translated container" expect="native">
        <div style={{ transform: "translateY(6px)" }}>
          <Glass title="Shifted, not distorted" />
        </div>
      </Scenario>
      <Scenario id="S32" title="Across a page transition" expect="native">
        <Glass title="Push the next page" onPress={() => router.push("overlays")} />
      </Scenario>
    </main>
  );
}
