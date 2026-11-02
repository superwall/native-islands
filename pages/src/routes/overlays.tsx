import * as React from "react";
import { Glass } from "../components/controls";
import { Scenario } from "../components/Scenario";

export default function Overlays() {
  const [sheet, setSheet] = React.useState(false);
  const [toast, setToast] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(false), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <main className="page">
      <h1>Overlays and clipping</h1>
      <p className="lede">
        Native views live inside the page. A sheet on its own layer covers them by itself, and
        anything else drawn over one, such as a toast, is cut out of it, so it stays native.
      </p>
      <Scenario id="S33" title="Covered by a sheet" expect="native">
        <Glass title="Open a sheet" onPress={() => setSheet(true)} />
      </Scenario>
      <Scenario id="S34" title="Covered by a toast" expect="native">
        {toast ? <div className="toast">Saved</div> : null}
        <Glass title="Show a toast" onPress={() => setToast(true)} />
      </Scenario>
      <Scenario id="S35" title="Cut by a container" expect="native">
        <div className="clip" style={{ whiteSpace: "nowrap" }}>
          <Glass title="Too wide for its box" />
        </div>
      </Scenario>
      <Scenario id="S37" title="Hidden by the page" expect="web while it happens">
        <div style={{ visibility: hidden ? "hidden" : "visible" }}>
          <Glass title="Now you see me" />
        </div>
        <Glass title={hidden ? "Show it" : "Hide it"} onPress={() => setHidden(!hidden)} />
      </Scenario>
      {sheet ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Sheet">
          <div className="sheet" data-scenario="S36" data-expect="native">
            <h2>A sheet</h2>
            <p className="lede">The button below is native too, anchored to the screen.</p>
            <Glass title="Close the sheet" prominence="prominent" onPress={() => setSheet(false)} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
