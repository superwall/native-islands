import { installNativeSimulator } from "@superwall/native-islands/simulator";
import { NativeIslandsProvider } from "@superwall/native-islands/react";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { PreferencesProvider } from "./app/preferences";
import { Shell } from "./app/Shell";
import { capabilityScreens } from "./tabs/capabilities";
import { componentScreens } from "./tabs/components";
import { settingScreens } from "./tabs/settings";
import "./styles/live.css";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/components.css";

const SCREENS = [...componentScreens, ...capabilityScreens, ...settingScreens];

if (new URLSearchParams(window.location.search).get("native") === "simulate") {
  installNativeSimulator({
    components: {
      glassButton: 1,
      toggle: 1,
      segmentedControl: 1,
      symbol: 1,
      tabBar: 1,
      menu: 1,
      slider: 1,
      stepper: 1,
      picker: 1,
      datePicker: 1,
      colorPicker: 1,
      textField: 1,
      gauge: 1,
      symbolEffect: 1,
      chart: 1,
    },
  });
}

// WebKit only applies :active to elements while a touch listener is registered.
document.addEventListener("touchstart", () => {}, { passive: true });

const root = document.getElementById("root");
if (!root) throw new Error("The page has no #root element.");
createRoot(root).render(
  <React.StrictMode>
    <PreferencesProvider>
      <NativeIslandsProvider>
        <Shell screens={SCREENS} />
      </NativeIslandsProvider>
    </PreferencesProvider>
  </React.StrictMode>,
);
