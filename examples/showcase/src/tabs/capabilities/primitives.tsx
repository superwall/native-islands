import * as React from "react";
import {
  ContextMenu,
  LongPressGesture,
  MaterialBackground,
  useHaptics,
  useNotifications,
  type HapticPattern,
  type MaterialName,
  type NotificationStatus,
} from "native-islands/components";
import { demoScreens, type ScreenSpec } from "../../app/nav";
import { useNativeEnabled } from "../../app/preferences";
import { Readout, Row, Section } from "../../ui/List";

const PATTERNS: readonly { title: string; subtitle: string; pattern: HapticPattern }[] = [
  {
    title: "Heartbeat",
    subtitle: "Two soft taps, then a pause",
    pattern: {
      events: [
        { time: 0, intensity: 0.8, sharpness: 0.3 },
        { time: 0.15, intensity: 0.5, sharpness: 0.2 },
        { time: 0.8, intensity: 0.8, sharpness: 0.3 },
        { time: 0.95, intensity: 0.5, sharpness: 0.2 },
      ],
    },
  },
  {
    title: "Rumble",
    subtitle: "A continuous hum that swells",
    pattern: {
      events: [
        { time: 0, kind: "continuous", duration: 0.6, intensity: 0.4, sharpness: 0.1, attack: 0.2 },
        { time: 0.6, kind: "continuous", duration: 0.4, intensity: 1, sharpness: 0.2, decay: 0.3 },
      ],
    },
  },
  {
    title: "Drumroll",
    subtitle: "Ten crisp taps, faster and stronger",
    pattern: {
      events: Array.from({ length: 10 }, (_, index) => ({
        time: index * (0.12 - index * 0.006),
        intensity: 0.4 + index * 0.06,
        sharpness: 0.9,
      })),
    },
  },
  {
    title: "Success",
    subtitle: "Dull, then crisp",
    pattern: {
      events: [
        { time: 0, intensity: 0.6, sharpness: 0.1 },
        { time: 0.12, intensity: 1, sharpness: 1 },
      ],
    },
  },
];

const HapticPatterns = () => {
  const haptics = useHaptics();
  const [last, setLast] = React.useState("none");
  return (
    <>
      <div className="nav-gap" />
      {haptics.element}
      <Section footer="Core Haptics patterns the page writes as JSON: events at times, with an intensity and a sharpness each, tapped or held.">
        {PATTERNS.map((entry) => (
          <Row
            key={entry.title}
            title={entry.title}
            subtitle={entry.subtitle}
            symbol="waveform.path"
            onPress={() => {
              void haptics
                .play(entry.pattern)
                .then((played) =>
                  setLast(`${entry.title}: ${played ? "played" : "no Taptic Engine"}`),
                );
            }}
          />
        ))}
      </Section>
      <Section header="Impact at an intensity">
        {[0.25, 0.5, 1].map((intensity) => (
          <Row
            key={intensity}
            title={`Rigid at ${intensity * 100}%`}
            symbol="hand.tap.fill"
            onPress={() =>
              void haptics.impact("rigid", intensity).then(() => setLast(`rigid ${intensity}`))
            }
          />
        ))}
      </Section>
      <Section header="Page sees">
        <Readout title="Last played" value={last} />
      </Section>
    </>
  );
};

const STATUS: Record<NotificationStatus, string> = {
  notDetermined: "Not asked",
  granted: "Allowed",
  limited: "Provisional",
  denied: "Denied",
};

const Notifications = () => {
  const [status, setStatus] = React.useState<NotificationStatus>();
  const [heard, setHeard] = React.useState("nothing yet");
  const notifications = useNotifications({
    onStatusChange: setStatus,
    onOpen: (id) => setHeard(`opened ${id}`),
    onDeliver: (id) => setHeard(`delivered ${id}`),
  });
  const report = (promise: Promise<unknown>, done: string) =>
    void promise.then(() => setHeard(done)).catch((error: unknown) => setHeard(String(error)));
  return (
    <>
      <div className="nav-gap" />
      {notifications.element}
      <Section footer="Local notifications from the page. Lock the phone or leave the app after scheduling one; a tap on it comes back to the page.">
        <Row
          title="Ask for Permission"
          symbol="bell.badge.fill"
          onPress={() => report(notifications.requestAuthorization().then(setStatus), "asked")}
        />
        <Row
          title="Remind Me in 5 Seconds"
          symbol="clock.fill"
          onPress={() =>
            report(
              notifications.schedule({
                id: "reminder",
                title: "Islands",
                body: "This came from the web page, five seconds ago.",
                after: 5,
                data: { from: "showcase" },
              }),
              "scheduled for 5 s",
            )
          }
        />
        <Row
          title="Cancel It"
          symbol="bell.slash.fill"
          onPress={() => report(notifications.cancel(["reminder"]), "cancelled")}
        />
        <Row
          title="Set Badge to 3"
          symbol="app.badge.fill"
          onPress={() => report(notifications.setBadge(3), "badge 3")}
        />
        <Row
          title="Clear Badge"
          symbol="app"
          onPress={() => report(notifications.setBadge(0), "badge cleared")}
        />
      </Section>
      <Section header="Page sees">
        <Readout title="Permission" value={status ? STATUS[status] : "…"} />
        <Readout title="Last" value={heard} />
      </Section>
    </>
  );
};

const ContextMenus = () => {
  const native = useNativeEnabled();
  const [heard, setHeard] = React.useState("nothing yet");
  return (
    <>
      <div className="nav-gap" />
      <div className="stage">
        <div className="stage-row">
          <ContextMenu
            native={native}
            cornerRadius={20}
            title="Sunset"
            items={[
              { id: "share", title: "Share", systemImage: "square.and.arrow.up" },
              { id: "favorite", title: "Favourite", systemImage: "heart" },
              {
                id: "more",
                title: "More",
                children: [
                  { id: "copy", title: "Copy", systemImage: "doc.on.doc" },
                  { id: "info", title: "Get Info", systemImage: "info.circle" },
                ],
              },
              { id: "delete", title: "Delete", systemImage: "trash", destructive: true },
            ]}
            onSelect={(id) => setHeard(`chose ${id}`)}
            onPress={() => setHeard("tapped")}
          >
            <div className="demo-card demo-card--sunset">Hold me</div>
          </ContextMenu>
          <LongPressGesture
            native={native}
            minimumDuration={0.6}
            onLongPress={() => setHeard("long press")}
            onPress={() => setHeard("tapped")}
          >
            <div className="demo-card demo-card--sea">Long press</div>
          </LongPressGesture>
        </div>
      </div>
      <p className="list-footer">
        The cards are web elements. Holding the first opens a system context menu, lifting a
        snapshot of the card; the second plays a haptic on a long press.
      </p>
      <Section header="Page sees">
        <Readout title="Last" value={heard} />
      </Section>
    </>
  );
};

const MATERIALS: readonly MaterialName[] = [
  "ultraThin",
  "thin",
  "regular",
  "thick",
  "bar",
  "glass",
  "clearGlass",
];

const Materials = () => {
  const native = useNativeEnabled();
  return (
    <>
      <div className="nav-gap" />
      <div className="material-stage">
        {MATERIALS.map((material) => (
          <MaterialBackground
            key={material}
            native={native}
            material={material}
            cornerRadius={22}
            className="material-tile"
          >
            <span className="material-name">{material}</span>
          </MaterialBackground>
        ))}
      </div>
      <p className="list-footer">
        System materials and Liquid Glass over the page's own gradient, each with its label drawn
        natively in the material's vibrant colours.
      </p>
    </>
  );
};

export const primitiveScreens: ScreenSpec[] = demoScreens("capabilities", "Primitives", [
  {
    id: "haptic-patterns",
    keywords: ["Core Haptics", "pattern", "vibration", "intensity", "sharpness"],
    title: "Haptic Patterns",
    symbol: "waveform.path",
    Component: HapticPatterns,
  },
  {
    id: "notifications",
    keywords: ["local notification", "reminder", "badge", "alert"],
    title: "Notifications",
    symbol: "bell.badge.fill",
    Component: Notifications,
  },
  {
    id: "context-menus",
    keywords: ["long press", "gesture", "preview", "menu"],
    title: "Context Menus",
    symbol: "contextualmenu.and.cursorarrow",
    Component: ContextMenus,
  },
  {
    id: "materials",
    keywords: ["blur", "glass", "background", "vibrancy"],
    title: "Materials",
    symbol: "square.on.square.squareshape.controlhandles",
    Component: Materials,
  },
]);
