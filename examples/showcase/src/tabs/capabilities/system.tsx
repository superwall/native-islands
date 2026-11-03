import * as React from "react";
import { demoScreens, type ScreenSpec } from "../../app/nav";
import type { HapticFeedback, PermissionKind, PermissionStatus } from "../../islands/definitions";
import { STATUS_TITLES, describeActivity } from "../../ui/capabilities";
import { Readout, Row, Section } from "../../ui/List";
import { HapticButton, PermissionButton, ShareButton } from "../../ui/system";

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

export const systemScreens: ScreenSpec[] = demoScreens("capabilities", "System", [
  { id: "permissions", title: "Permissions", symbol: "hand.raised.fill", Component: Permissions },
  { id: "haptics", title: "Haptics", symbol: "hand.tap.fill", Component: Haptics },
  { id: "share", title: "Share Sheet", symbol: "square.and.arrow.up", Component: Share },
]);
