import * as React from "react";
import { Glass, Segments } from "../../components/controls";
import { IconGlass, SFSymbol } from "../../components/icons";

const TRAILS = [
  { name: "Ridge Loop", detail: "6.4 km · 2 h 10 min · moderate" },
  { name: "Cedar Falls", detail: "3.1 km · 55 min · easy" },
  { name: "Summit Push", detail: "11.8 km · 4 h 30 min · hard" },
];

/**
 * A map screen: a floating glass search bar and tool column over the map, a
 * bottom card with a mode picker and a call to action, and a toast that
 * slides over the glass when a trail is saved.
 */
export default function MapScreen() {
  const [mode, setMode] = React.useState(0);
  const [trail, setTrail] = React.useState(0);
  const [saved, setSaved] = React.useState(false);
  const [layers, setLayers] = React.useState(false);

  React.useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 1800);
    return () => clearTimeout(timer);
  }, [saved]);

  const current = TRAILS[trail] ?? TRAILS[0];

  return (
    <main className="page app app--map" data-scenario="A04" data-expect="native">
      <div className={layers ? "map map--terrain" : "map"} aria-hidden="true">
        <span className="map-park" />
        <span className="map-lake" />
        <span className="map-road map-road--one" />
        <span className="map-road map-road--two" />
        <span className="map-route" />
        <span className="map-pin" />
      </div>
      <div className="map-search">
        <Glass block title="Search trails and places" />
      </div>
      <div className="map-tools">
        <IconGlass symbol="location.fill" label="Show my location" glassGroup="map-tools" />
        <IconGlass
          symbol="square.3.layers.3d"
          label="Map layers"
          glassGroup="map-tools"
          prominent={layers}
          tint={layers ? "var(--accent)" : undefined}
          onPress={() => setLayers(!layers)}
        />
      </div>
      {saved ? (
        <div className="toast toast--map" role="status">
          Saved {current.name}
        </div>
      ) : null}
      <section className="map-card">
        <div className="map-card-head">
          <span className="row-icon" style={{ background: "#34c759" }}>
            <SFSymbol name="figure.walk" tint="#ffffff" size={18} weight="semibold" />
          </span>
          <span>
            <strong>{current.name}</strong>
            <span className="lede">{current.detail}</span>
          </span>
          <IconGlass symbol="bookmark" label="Save trail" onPress={() => setSaved(true)} />
        </div>
        <Segments segments={["Walk", "Run", "Bike"]} selectedIndex={mode} onChange={setMode} />
        <div className="map-card-actions">
          <Glass title="Next trail" onPress={() => setTrail((trail + 1) % TRAILS.length)} />
          <Glass block prominence="prominent" tint="#34c759" title="Start route" />
        </div>
      </section>
    </main>
  );
}
