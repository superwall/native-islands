import * as React from "react";
import type { NativeHandle } from "native-islands/react";
import {
  DatePicker,
  PlanPicker,
  SignupForm,
  Slider,
  Tabs,
  type SignupState,
} from "../components/stateful";
import { Scenario } from "../components/Scenario";

const PLANS = [
  { id: "weekly", title: "Weekly", price: "$4.99" },
  { id: "annual", title: "Annual", price: "$39.99" },
  { id: "lifetime", title: "Lifetime", price: "$99" },
] as const;

const TABS = ["Features", "Reviews", "FAQ"] as const;

const EMPTY: SignupState = { name: "", email: "", agreed: false };

const emailError = (email: string) =>
  email === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    ? undefined
    : "That email looks incomplete";

type SignupCommands = {
  focus: { args: { field: keyof SignupState }; result: void };
  reset: { args: undefined; result: void };
};

const Echo = ({ value }: { value: unknown }) => (
  <pre className="echo" data-testid="echo">
    React has: {JSON.stringify(value)}
  </pre>
);

export default function State() {
  const form = React.useRef<NativeHandle<SignupCommands, SignupState>>(null);
  const [signup, setSignup] = React.useState<SignupState>(EMPTY);
  const [sent, setSent] = React.useState<SignupState>();
  const [plan, setPlan] = React.useState("annual");
  const [date, setDate] = React.useState("2026-11-01");
  const [seats, setSeats] = React.useState(3);
  const [tab, setTab] = React.useState(0);

  const edit = (patch: Partial<SignupState>) => setSignup((current) => ({ ...current, ...patch }));
  const submit = (values: SignupState) => setSent(values);

  return (
    <main className="page">
      <h1>State and callbacks</h1>
      <p className="lede">
        Native views own their values and report them as state; React keeps the same values and
        sends them back as props. Native asks the page questions with requests, and the page drives
        native with commands.
      </p>

      <Scenario id="S41" title="A whole native form, its values in React" expect="native">
        <SignupForm
          {...signup}
          submitLabel="Create account"
          ref={form}
          onStateChange={(state) => edit(state)}
          onSubmit={submit}
          requests={{ validateEmail: ({ email }) => ({ error: emailError(email) }) }}
        >
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              submit(signup);
            }}
          >
            <input
              className="field"
              aria-label="Name"
              placeholder="Name"
              value={signup.name}
              onChange={(event) => edit({ name: event.target.value })}
            />
            <input
              className="field"
              type="email"
              aria-label="Email"
              placeholder="you@example.com"
              value={signup.email}
              onChange={(event) => edit({ email: event.target.value })}
            />
            {emailError(signup.email) ? <p className="micro">{emailError(signup.email)}</p> : null}
            <label className="check">
              <input
                type="checkbox"
                checked={signup.agreed}
                onChange={(event) => edit({ agreed: event.target.checked })}
              />
              Email me about new features
            </label>
            <button type="submit" className="glass glass--block" data-prominence="prominent">
              Create account
            </button>
          </form>
        </SignupForm>
        <div className="row">
          <button
            type="button"
            className="glass"
            onClick={() =>
              void form.current?.command("focus", { field: "email" }).catch(() => undefined)
            }
          >
            Focus email
          </button>
          <button
            type="button"
            className="glass"
            onClick={() => {
              setSignup(EMPTY);
              void form.current?.command("reset").catch(() => undefined);
            }}
          >
            Reset
          </button>
        </div>
        <Echo value={{ ...signup, sent: sent?.email ?? null }} />
      </Scenario>

      <Scenario id="S42" title="A native plan picker filling the content area" expect="native">
        <PlanPicker
          plans={PLANS}
          selected={plan}
          onStateChange={({ selected }) => selected && setPlan(selected)}
        >
          <div className="plans" role="radiogroup" aria-label="Plans">
            {PLANS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={plan === option.id}
                className="plan-card"
                onClick={() => setPlan(option.id)}
              >
                <strong>{option.title}</strong>
                <span>{option.price}</span>
              </button>
            ))}
          </div>
        </PlanPicker>
        <Echo value={{ plan }} />
      </Scenario>

      <Scenario id="S43" title="A native date picker" expect="native">
        <DatePicker
          date={date}
          minimum="2026-10-31"
          onStateChange={({ date: next }) => next && setDate(next)}
        >
          <input
            className="field"
            type="date"
            aria-label="Start date"
            min="2026-10-31"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </DatePicker>
        <Echo value={{ date }} />
      </Scenario>

      <Scenario id="S44" title="A native slider reporting every step" expect="native">
        <Slider
          value={seats}
          minimum={1}
          maximum={20}
          step={1}
          onStateChange={({ value }) => value !== undefined && setSeats(value)}
        >
          <input
            className="range"
            type="range"
            aria-label="Seats"
            min={1}
            max={20}
            step={1}
            value={seats}
            onChange={(event) => setSeats(Number(event.target.value))}
          />
        </Slider>
        <Echo value={{ seats }} />
      </Scenario>

      <Scenario id="S45" title="Native tabs driving web content" expect="native">
        <Tabs
          tabs={TABS}
          selected={tab}
          onStateChange={({ selected }) => selected !== undefined && setTab(selected)}
        >
          <div className="segments" role="tablist">
            {TABS.map((label, index) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={tab === index}
                aria-pressed={tab === index}
                onClick={() => setTab(index)}
              >
                {label}
              </button>
            ))}
          </div>
        </Tabs>
        <p className="lede" role="tabpanel">
          {
            [
              "Every feature, on every device.",
              "4.9 stars from 12,000 reviews.",
              "Cancel any time from Settings.",
            ][tab]
          }
        </p>
      </Scenario>
    </main>
  );
}
