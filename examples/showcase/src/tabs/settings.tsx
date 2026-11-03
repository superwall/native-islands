import { useNav, type ScreenSpec } from "../app/nav";
import { ACCENTS, APPEARANCES, useIsDark, usePreferences } from "../app/preferences";
import { Segmented, Toggle } from "../ui/controls";
import { Row, Section } from "../ui/List";

const Settings = () => {
  const { appearance, accent, native, set } = usePreferences();
  const { push } = useNav();
  const appearanceIndex = APPEARANCES.findIndex((option) => option.value === appearance);
  return (
    <>
      <Section header="Appearance">
        <div className="row">
          <Segmented
            segments={APPEARANCES.map((option) => option.title)}
            selectedIndex={appearanceIndex}
            onChange={(index) => {
              const option = APPEARANCES[index];
              if (option) set({ appearance: option.value });
            }}
          />
        </div>
        <Row
          title="Accent Colour"
          symbol="paintpalette.fill"
          detail={accent.name}
          disclosure
          onPress={() => push("accent")}
        />
      </Section>
      <Section
        header="Islands"
        footer="Off draws the web version of every island in its place: the same page, without native views."
      >
        <Row
          title="Native Islands"
          symbol="square.stack.3d.up.fill"
          accessory={
            <Toggle
              label="Native Islands"
              isOn={native}
              onChange={(next) => set({ native: next })}
            />
          }
        />
      </Section>
      <Section header="About">
        <Row title="About Islands" symbol="info.circle" disclosure onPress={() => push("about")} />
      </Section>
    </>
  );
};

const AccentColour = () => {
  const { accent, set } = usePreferences();
  const dark = useIsDark();
  return (
    <>
      <div className="nav-gap" />
      <Section footer="Native views take the accent as their tint, as UIKit views take the window's.">
        {ACCENTS.map((option) => (
          <Row
            key={option.name}
            title={option.name}
            leading={
              <span className="swatch" style={{ background: dark ? option.dark : option.light }} />
            }
            checked={option.name === accent.name}
            onPress={() => set({ accent: option })}
          />
        ))}
      </Section>
    </>
  );
};

const About = () => (
  <>
    <div className="nav-gap" />
    <div className="prose">
      <p>
        <strong>Islands</strong> is one web app in one <code>WKWebView</code>. Its lists, screens,
        navigation and swipe back are HTML and CSS.
      </p>
      <p>
        Where a web view falls short, the page asks for a native view instead: the tab bar, the
        controls, maps, video and the camera. Each one is a web element whose native twin iOS draws
        in its place, so it scrolls, slides and is covered with the page.
      </p>
      <p>
        Built with NativeIslands by Superwall. Turn off Native Islands in Settings to see the web
        version of every island.
      </p>
    </div>
  </>
);

export const settingScreens: readonly ScreenSpec[] = [
  {
    id: "settings",
    tab: "settings",
    title: "Settings",
    symbol: "gearshape.fill",
    largeTitle: true,
    Component: Settings,
  },
  {
    id: "accent",
    tab: "settings",
    title: "Accent Colour",
    symbol: "paintpalette.fill",
    Component: AccentColour,
  },
  { id: "about", tab: "settings", title: "About", symbol: "info.circle", Component: About },
];
