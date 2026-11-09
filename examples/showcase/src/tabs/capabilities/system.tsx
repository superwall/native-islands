import * as React from "react";
import { demoScreens, type ScreenSpec } from "../../app/nav";
import type { HapticFeedback, PermissionKind, PermissionStatus } from "native-islands/components";
import { STATUS_TITLES, describeActivity } from "../../ui/capabilities";
import { Readout, Row, Section } from "../../ui/List";
import { Button } from "../../ui/controls";
import { HapticButton, PermissionButton, ShareButton, TipCard } from "../../ui/system";

const PERMISSIONS: readonly {
  kind: PermissionKind;
  title: string;
  subtitle: string;
  symbol: string;
}[] = [
  { kind: "camera", title: "Camera", subtitle: "Take photos and video", symbol: "camera.fill" },
  { kind: "microphone", title: "Microphone", subtitle: "Record audio", symbol: "mic.fill" },
  { kind: "location", title: "Location", subtitle: "While using the app", symbol: "location.fill" },
  { kind: "photos", title: "Photos", subtitle: "Full library access", symbol: "photo.fill" },
  {
    kind: "notifications",
    title: "Notifications",
    subtitle: "Alerts, sounds and badges",
    symbol: "bell.fill",
  },
];

const Permissions = () => {
  const [statuses, setStatuses] = React.useState<Partial<Record<PermissionKind, PermissionStatus>>>(
    {},
  );
  return (
    <>
      <div className="nav-gap" />
      <Section footer="Allow shows the real iOS prompt. Each answer is kept by iOS; change it in Settings and come back to see it here.">
        {PERMISSIONS.map((permission) => (
          <Row
            key={permission.kind}
            title={permission.title}
            subtitle={permission.subtitle}
            symbol={permission.symbol}
            accessory={
              <PermissionButton
                kind={permission.kind}
                label={permission.title}
                onStatus={(status) =>
                  setStatuses((current) => ({ ...current, [permission.kind]: status }))
                }
              />
            }
          />
        ))}
      </Section>
      <Section header="Page sees">
        {PERMISSIONS.map((permission) => {
          const status = statuses[permission.kind];
          return (
            <Readout
              key={permission.kind}
              title={permission.title}
              value={status ? STATUS_TITLES[status] : "…"}
            />
          );
        })}
      </Section>
    </>
  );
};

const HAPTICS: readonly { title: string; items: readonly [string, HapticFeedback][] }[] = [
  {
    title: "Impact",
    items: [
      ["Light", "light"],
      ["Medium", "medium"],
      ["Heavy", "heavy"],
      ["Soft", "soft"],
      ["Rigid", "rigid"],
    ],
  },
  {
    title: "Notification",
    items: [
      ["Success", "success"],
      ["Warning", "warning"],
      ["Error", "error"],
    ],
  },
  { title: "Selection", items: [["Selection", "selection"]] },
];

const Haptics = () => {
  const [last, setLast] = React.useState("none");
  return (
    <>
      <div className="nav-gap" />
      {HAPTICS.map((group) => (
        <React.Fragment key={group.title}>
          <h2 className="list-header">{group.title}</h2>
          <div className="stage">
            <div className="stage-row">
              {group.items.map(([title, feedback]) => (
                <HapticButton
                  key={feedback}
                  title={title}
                  feedback={feedback}
                  onPress={() => setLast(title)}
                />
              ))}
            </div>
          </div>
        </React.Fragment>
      ))}
      <p className="list-footer">
        The Taptic Engine plays the moment a button is touched, before the page hears about it. A
        web page on iOS has no way to play these.
      </p>
      <Section header="Page sees">
        <Readout title="Last played" value={last} />
      </Section>
    </>
  );
};

const Share = () => {
  const [result, setResult] = React.useState<string>();
  return (
    <>
      <div className="nav-gap" />
      <div className="stage">
        <div className="stage-row">
          <ShareButton
            title="Share Islands"
            text="Islands: an iOS app made of web views."
            url="https://github.com/superwall/native-islands"
            onComplete={(activity) => setResult(describeActivity(activity))}
          />
        </div>
      </div>
      <p className="list-footer">
        The system share sheet, with AirDrop, Messages and every app's share extension, anchored to
        the button that opened it.
      </p>
      <Section header="Page sees">
        <Readout title="Shared with" value={result ?? "nothing yet"} />
      </Section>
    </>
  );
};

const Tips = () => {
  const [round, setRound] = React.useState(1);
  const [heard, setHeard] = React.useState("nothing yet");
  return (
    <>
      <div className="nav-gap" />
      <div className="tip-stage">
        <TipCard
          id={`islands-favorites-${round}`}
          title="Save your favourites"
          message="Tap the star on any demo to keep it at the top of the list."
          symbol="star.fill"
          actions={[{ id: "learn", title: "Learn More" }]}
          onAction={(id) => setHeard(`Tapped ${id}`)}
          onDismiss={() => setHeard("Closed")}
        />
      </div>
      <p className="list-footer">
        TipKit draws the tip and remembers by its id that it was closed, even after the app
        restarts. Once closed it takes no room on the page.
      </p>
      <Section>
        <div className="row row--centered">
          <Button title="Show a New Tip" onPress={() => setRound((count) => count + 1)} />
        </div>
      </Section>
      <Section header="Page sees">
        <Readout title="Last" value={heard} />
      </Section>
    </>
  );
};

export const systemScreens: ScreenSpec[] = demoScreens("capabilities", "System", [
  {
    id: "permissions",
    keywords: ["privacy", "location", "camera", "microphone", "notifications", "prompt"],
    title: "Permissions",
    symbol: "hand.raised.fill",
    Component: Permissions,
  },
  {
    id: "haptics",
    keywords: ["feedback", "vibration", "Taptic"],
    title: "Haptics",
    symbol: "hand.tap.fill",
    Component: Haptics,
  },
  {
    id: "tips",
    keywords: ["TipKit", "onboarding", "hint", "popover"],
    title: "Tips",
    symbol: "lightbulb.fill",
    Component: Tips,
  },
  {
    id: "share",
    keywords: ["activity", "export", "send"],
    title: "Share Sheet",
    symbol: "square.and.arrow.up",
    Component: Share,
  },
]);
