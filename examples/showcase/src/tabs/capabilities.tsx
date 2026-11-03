import type { ScreenSpec } from "../app/nav";
import { TabRoot } from "../ui/TabRoot";
import { locationScreens } from "./capabilities/location";
import { mediaScreens } from "./capabilities/media";
import { systemScreens } from "./capabilities/system";

const Root = () => (
  <TabRoot
    tab="capabilities"
    title="What a web view can't do"
    text="Maps, video, the camera and system prompts, each drawn by iOS inside the page that asks for it."
  />
);

export const capabilityScreens: readonly ScreenSpec[] = [
  {
    id: "capabilities",
    tab: "capabilities",
    title: "Capabilities",
    symbol: "sparkles",
    largeTitle: true,
    Component: Root,
  },
  ...locationScreens,
  ...mediaScreens,
  ...systemScreens,
];
