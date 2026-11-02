import { installNativeSimulator } from "@superwall/native-islands/simulator";
import { NativeIslandsProvider } from "@superwall/native-islands/react";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { Pages, type RouteName } from "./router";
import MapScreen from "./routes/apps/map";
import Paywall from "./routes/apps/paywall";
import Player from "./routes/apps/player";
import Settings from "./routes/apps/settings";
import Buttons from "./routes/buttons";
import Controls from "./routes/controls";
import { FlowDetails, FlowDone, FlowPlans } from "./routes/flow";
import Index from "./routes/index";
import { Layout } from "./routes/layout";
import Motion from "./routes/motion";
import Onboarding from "./routes/onboarding";
import Overlays from "./routes/overlays";
import Perf from "./routes/perf";
import Scrolling from "./routes/scrolling";
import State from "./routes/state";
import Stress from "./routes/stress";
import { installFrameTimer, measureLayout, sweep } from "./perf";
import "./theme.css";

const ALL_PAGES: Record<RouteName, React.ComponentType> = {
  index: Index,
  "app-player": Player,
  "app-paywall": Paywall,
  "app-settings": Settings,
  "app-map": MapScreen,
  buttons: Buttons,
  controls: Controls,
  scrolling: Scrolling,
  motion: Motion,
  overlays: Overlays,
  stress: Stress,
  state: State,
  onboarding: Onboarding,
  "flow-plans": FlowPlans,
  "flow-details": FlowDetails,
  "flow-done": FlowDone,
  perf: Perf,
};

const measuring = new URLSearchParams(window.location.search).get("route") === "perf";
const Empty = () => null;
/** The perf runs measure the perf page alone, so the other pages render nothing then. */
const PAGES = measuring
  ? (Object.fromEntries(
      Object.keys(ALL_PAGES).map((name) => [name, name === "perf" ? ALL_PAGES.perf : Empty]),
    ) as Record<RouteName, React.ComponentType>)
  : ALL_PAGES;

const perfPage = () => {
  const element = document.querySelector<HTMLElement>("[data-perf-page]");
  const scroller = element?.closest<HTMLElement>("[data-island-route]");
  if (!element || !scroller) throw new Error("The perf page is not rendered.");
  return { element, scroller };
};

if (measuring) {
  const timer = installFrameTimer();
  Object.assign(window, {
    __perf: {
      sweep: () => sweep(perfPage().scroller),
      measureLayout: () => measureLayout(perfPage().element, timer),
    },
  });
}

if (new URLSearchParams(window.location.search).get("native") === "simulate") {
  const simulator = installNativeSimulator({
    components: {
      glassButton: 1,
      closeButton: 1,
      toggle: 1,
      segmentedControl: 1,
      symbol: 1,
      signupForm: 1,
      planPicker: 1,
      datePicker: 1,
      slider: 1,
      tabs: 1,
      rating: 1,
      silentBadge: 1,
    },
    silent: ["silentBadge"],
  });
  Object.assign(window, { __nativeIslandsSimulator: simulator });
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <NativeIslandsProvider>
      <Pages pages={PAGES} layout={Layout} />
    </NativeIslandsProvider>
  </React.StrictMode>,
);
