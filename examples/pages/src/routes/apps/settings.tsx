import * as React from "react";
import { Glass, Segments, Switch } from "../../components/controls";
import { SFSymbol } from "../../components/icons";
import { Sheet } from "../../components/Sheet";

const ROWS = [
  { key: "notifications", symbol: "bell.fill", tint: "#ff3b30", title: "Notifications" },
  { key: "focus", symbol: "moon.fill", tint: "#5e5ce6", title: "Focus filters" },
  { key: "wifi", symbol: "wifi", tint: "#0a84ff", title: "Sync on Wi-Fi only" },
  { key: "backup", symbol: "icloud.fill", tint: "#32ade6", title: "iCloud backup" },
] as const;

/**
 * A settings screen: grouped rows with native SF Symbols and switches, an
 * appearance picker, and a sheet that slides over every native control on
 * the page with its own native buttons inside.
 */
export default function Settings() {
  const [values, setValues] = React.useState<Record<string, boolean>>({
    notifications: true,
    focus: false,
    wifi: true,
    backup: true,
  });
  const [appearance, setAppearance] = React.useState(2);
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState("Ada Lovelace");

  return (
    <main className="page app app--settings" data-scenario="A03" data-expect="native">
      <h1>Settings</h1>
      <section className="profile">
        <span className="avatar" aria-hidden="true">
          {name.slice(0, 1)}
        </span>
        <span>
          <strong>{name}</strong>
          <span className="lede">Atlas Pro · renews 12 March</span>
        </span>
        <Glass title="Edit" onPress={() => setEditing(true)} />
      </section>
      <section className="group">
        {ROWS.map((row) => (
          <div className="row" key={row.key}>
            <span className="row-icon" style={{ background: row.tint }}>
              <SFSymbol name={row.symbol} tint="#ffffff" size={17} weight="semibold" />
            </span>
            <span className="row-title">{row.title}</span>
            <Switch
              label={row.title}
              isOn={values[row.key] ?? false}
              onChange={(isOn) => setValues({ ...values, [row.key]: isOn })}
            />
          </div>
        ))}
      </section>
      <section className="group">
        <span className="micro">Appearance</span>
        <Segments
          segments={["Light", "Dark", "Auto"]}
          selectedIndex={appearance}
          onChange={setAppearance}
        />
      </section>
      <Glass block title="Sign out" prominence="prominent" tint="#ff3b30" />
      <Sheet open={editing} label="Edit profile" onDismiss={() => setEditing(false)}>
        <span className="sheet-grabber" aria-hidden="true" />
        <div className="sheet-head">
          <Glass title="Cancel" onPress={() => setEditing(false)} />
          <strong>Edit profile</strong>
          <Glass
            title="Done"
            prominence="prominent"
            tint="var(--accent)"
            onPress={() => setEditing(false)}
          />
        </div>
        <input
          className="field"
          aria-label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="row">
          <span className="row-title">Show my name on shared notes</span>
          <Switch
            label="Show my name"
            isOn={values.shareName ?? true}
            onChange={(isOn) => setValues({ ...values, shareName: isOn })}
          />
        </div>
      </Sheet>
    </main>
  );
}
