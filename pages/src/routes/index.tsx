import { useNativeSupport } from "@superwall/native-islands/react";
import { Glass } from "../components/controls";
import { useRouter, type RouteName } from "../router";

const GROUPS: ReadonlyArray<{ route: RouteName; title: string; range: string }> = [
  { route: "buttons", title: "Glass buttons", range: "S01–S08" },
  { route: "controls", title: "Controls and app components", range: "S09–S15" },
  { route: "scrolling", title: "Scrolling, sticky and fixed", range: "S16–S24" },
  { route: "motion", title: "Motion and transforms", range: "S25–S32" },
  { route: "overlays", title: "Overlays and clipping", range: "S33–S37" },
  { route: "stress", title: "Stress", range: "S38–S40" },
  { route: "state", title: "State and callbacks", range: "S41–S45" },
  { route: "flow-plans", title: "Page transitions", range: "S46–S49" },
];

export default function Index() {
  const router = useRouter();
  const support = useNativeSupport("glassButton");

  return (
    <main className="page">
      <span className="micro">@superwall/native-islands</span>
      <h1>Native islands</h1>
      <p className="lede">
        Every control on these pages is a normal web component. Where the host offers a native one,
        it draws it in place, Liquid Glass included, and hands back to the web version whenever the
        native view could not follow. Here the host says glass buttons are{" "}
        <strong data-testid="support">{support}</strong>.
      </p>
      <p className="lede">
        Open these pages with <code>?native=simulate</code> in a browser to see where each native
        view would sit: a magenta outline over its web version. Add <code>?route=buttons</code> to
        open one page directly.
      </p>
      <nav className="nav-list" aria-label="Scenarios">
        {GROUPS.map((group) => (
          <button
            key={group.route}
            type="button"
            className="nav-item"
            onClick={() => router.push(group.route)}
          >
            <span>{group.title}</span>
            <span className="micro">{group.range}</span>
          </button>
        ))}
      </nav>
      <div className="footer-cta" data-scenario="S21" data-expect="native">
        <Glass block islandId="cta" prominence="prominent" tint="var(--accent)" title="Start Pro" />
      </div>
    </main>
  );
}
