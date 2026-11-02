import * as React from "react";
import { Glass, Segments, Switch } from "../components/controls";
import { Scenario } from "../components/Scenario";

const GOALS = ["Sleep", "Focus", "Calm"] as const;

const SESSIONS = [
  { title: "Wind down", detail: "10 min · breathing", minutes: 10 },
  { title: "Body scan", detail: "15 min · guided", minutes: 15 },
  { title: "Rain on a tin roof", detail: "45 min · soundscape", minutes: 45 },
  { title: "Box breathing", detail: "5 min · breathing", minutes: 5 },
  { title: "Gratitude", detail: "8 min · journaling", minutes: 8 },
  { title: "Deep rest", detail: "20 min · guided", minutes: 20 },
];

/**
 * An onboarding step the way an app ships it: a goal picker, a list that
 * scrolls behind a sticky footer, a reminder switch that confirms with a
 * toast, and a call to action that shrinks to fit what is picked.
 */
export default function Onboarding() {
  const [goal, setGoal] = React.useState(0);
  const [picked, setPicked] = React.useState<readonly string[]>([]);
  const [reminder, setReminder] = React.useState(false);
  const [toast, setToast] = React.useState(false);

  React.useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(false), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const toggle = (title: string) =>
    setPicked((current) =>
      current.includes(title) ? current.filter((item) => item !== title) : [...current, title],
    );

  const minutes = SESSIONS.filter((session) => picked.includes(session.title)).reduce(
    (total, session) => total + session.minutes,
    0,
  );

  return (
    <main className="page onboarding">
      <div className="progress" role="progressbar" aria-valuenow={2} aria-valuemax={3}>
        <span style={{ width: "66%" }} />
      </div>
      <span className="micro">Step 2 of 3</span>
      <h1>Build your first week</h1>
      <p className="lede">
        Pick a goal and a few sessions. The picker, the switch and the button are native; the rest
        is web.
      </p>
      <Scenario id="S50" title="Goal picker" expect="native">
        <Segments segments={GOALS} selectedIndex={goal} onChange={setGoal} />
      </Scenario>
      <Scenario id="S51" title="Reminder that confirms with a toast" expect="native">
        {toast ? (
          <div className="toast" role="status">
            Reminder set for 9:30 pm
          </div>
        ) : null}
        <div className="list-row" style={{ width: "100%" }}>
          <span>Remind me at bedtime</span>
          <Switch
            label="Bedtime reminder"
            isOn={reminder}
            onChange={(isOn) => {
              setReminder(isOn);
              if (isOn) setToast(true);
            }}
          />
        </div>
      </Scenario>
      <Scenario id="S52" title="Sessions that scroll behind the footer" expect="native">
        <div className="session-list">
          {SESSIONS.map((session) => (
            <div key={session.title} className="session-row">
              <div>
                <strong>{session.title}</strong>
                <span className="micro">{session.detail}</span>
              </div>
              <Glass
                title={picked.includes(session.title) ? "Added" : "Add"}
                prominence={picked.includes(session.title) ? "prominent" : "regular"}
                tint={picked.includes(session.title) ? "var(--accent)" : undefined}
                onPress={() => toggle(session.title)}
              />
            </div>
          ))}
        </div>
      </Scenario>
      <div className="footer-cta onboarding-footer" data-scenario="S53" data-expect="native">
        <div className="cta-row" data-picked={picked.length > 0}>
          <Glass
            block
            islandId="onboarding-cta"
            prominence="prominent"
            tint="var(--accent)"
            title={picked.length > 0 ? `Continue · ${minutes} min a day` : "Pick a session"}
            disabled={picked.length === 0}
          />
        </div>
      </div>
      <Scenario id="S54" title="A button whose width animates" expect="native">
        <div className="resizer" data-wide={picked.length % 2 === 0}>
          <Glass block title="I grow and shrink" />
        </div>
      </Scenario>
    </main>
  );
}
