import type { ScreenSpec } from "../app/nav";
import { TabRoot } from "../ui/TabRoot";

const Root = () => (
  <TabRoot
    tab="components"
    title="Native controls in a web page"
    text="Every screen here is a web page. The controls are SwiftUI, placed by the page and scrolling with it."
  />
);

export const componentScreens: readonly ScreenSpec[] = [
  {
    id: "components",
    tab: "components",
    title: "Components",
    symbol: "shippingbox.fill",
    largeTitle: true,
    Component: Root,
  },
];
