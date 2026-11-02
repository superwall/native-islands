import { installNativeSimulator } from "@superwall/native-islands/simulator";
import { NativeIslandsProvider } from "@superwall/native-islands/react";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { Pages, type RouteName } from "./router";
import Buttons from "./routes/buttons";
import Controls from "./routes/controls";
import { FlowDetails, FlowDone, FlowPlans } from "./routes/flow";
import Index from "./routes/index";
import { Layout } from "./routes/layout";
import Motion from "./routes/motion";
import Overlays from "./routes/overlays";
import Scrolling from "./routes/scrolling";
import State from "./routes/state";
import Stress from "./routes/stress";
import "./theme.css";

const PAGES: Record<RouteName, React.ComponentType> = {
  index: Index,
  buttons: Buttons,
  controls: Controls,
  scrolling: Scrolling,
  motion: Motion,
  overlays: Overlays,
  stress: Stress,
  state: State,
  "flow-plans": FlowPlans,
  "flow-details": FlowDetails,
  "flow-done": FlowDone,
};

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
