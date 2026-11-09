import { installNativeSimulator } from "native-islands/simulator";
import { NativeIslandsProvider } from "native-islands/react";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { PreferencesProvider } from "./app/preferences";
import { Shell } from "./app/Shell";
import { PresentedPage } from "./pages/Presented";
import { capabilityScreens } from "./tabs/capabilities";
import { componentScreens } from "./tabs/components";
import { searchScreen } from "./tabs/search";
import { settingScreens } from "./tabs/settings";
import "native-islands/components.css";
import "./styles/live.css";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/components.css";
import "./styles/capabilities.css";

const SCREENS = [...componentScreens, ...capabilityScreens, ...settingScreens, searchScreen];

if (new URLSearchParams(window.location.search).get("native") === "simulate") {
  installNativeSimulator({
    components: {
      glassButton: 1,
      closeButton: 1,
      toggle: 1,
      segmentedControl: 1,
      symbol: 1,
      tabBar: 1,
      searchTab: 1,
      searchField: 1,
      menu: 1,
      navigationBar: 1,
      slider: 1,
      stepper: 1,
      picker: 1,
      datePicker: 1,
      colorPicker: 1,
      textField: 1,
      gauge: 1,
      symbolEffect: 1,
      chart: 1,
      map: 1,
      video: 1,
      camera: 1,
      photoPicker: 1,
      permission: 1,
      hapticButton: 1,
      shareButton: 1,
      tabAccessory: 1,
      toolbar: 1,
      list: 1,
      material: 1,
    },
  });
}

// WebKit only applies :active to elements while a touch listener is registered.
document.addEventListener("touchstart", () => {}, { passive: true });

const query = new URLSearchParams(window.location.search);
const presented = query.get("page");

/** `?page=` is a page a presentation shows; anything else is the app. */
const App = () => {
  if (presented) return <PresentedPage />;
  return <Shell screens={SCREENS} />;
};

if (presented) document.documentElement.dataset.presented = presented;

const root = document.getElementById("root");
if (!root) throw new Error("The page has no #root element.");
createRoot(root).render(
  <React.StrictMode>
    <PreferencesProvider>
      <NativeIslandsProvider>
        <App />
      </NativeIslandsProvider>
    </PreferencesProvider>
  </React.StrictMode>,
);
