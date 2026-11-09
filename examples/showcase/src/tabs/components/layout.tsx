import * as React from "react";
import {
  FullScreenCover,
  useSheet,
  List,
  NavigationBar,
  Toolbar,
  deleteRows,
  type ListSection,
} from "native-islands/components";
import { demoScreens, type ScreenSpec } from "../../app/nav";
import { useAccent, useNativeEnabled } from "../../app/preferences";
import { Readout, Row, Section, Stage } from "../../ui/List";
import { Button, Toggle } from "../../ui/controls";
import { webSymbol } from "../../ui/symbols";
import { TabViewDemo } from "./chrome";
import { presentedURL } from "./presentations";

const SETTINGS: ListSection[] = [
  {
    id: "network",
    rows: [
      { id: "airplane", title: "Airplane Mode", systemImage: "airplane", iconTint: "#ff9f0a" },
      {
        id: "wifi",
        title: "Wi-Fi",
        systemImage: "wifi",
        iconTint: "#0a84ff",
        value: "Islands",
        accessory: "chevron",
      },
      {
        id: "bluetooth",
        title: "Bluetooth",
        systemImage: "bolt.horizontal.fill",
        iconTint: "#0a84ff",
        value: "On",
        accessory: "chevron",
      },
    ],
  },
  {
    id: "alerts",
    header: "Alerts",
    footer: "Swipe a row either way for its actions.",
    rows: [
      {
        id: "notifications",
        title: "Notifications",
        systemImage: "bell.badge.fill",
        iconTint: "#ff375f",
        badge: 3,
        accessory: "chevron",
        trailingActions: [
          { id: "mute", title: "Mute", systemImage: "bell.slash.fill", tint: "#5e5ce6" },
        ],
        leadingActions: [{ id: "pin", title: "Pin", systemImage: "pin.fill", tint: "#ff9f0a" }],
      },
      {
        id: "sounds",
        title: "Sounds & Haptics",
        systemImage: "speaker.wave.3.fill",
        iconTint: "#ff375f",
        accessory: "chevron",
      },
      {
        id: "focus",
        title: "Focus",
        systemImage: "moon.fill",
        iconTint: "#5e5ce6",
        accessory: "chevron",
      },
    ],
  },
];

const PLAYLIST: ListSection[] = [
  {
    id: "songs",
    header: "Up Next",
    rows: [
      {
        id: "a",
        title: "Islands in the Stream",
        subtitle: "Dolly & Kenny",
      },
      {
        id: "b",
        title: "Ocean Eyes",
        subtitle: "Billie Eilish",
        trailingActions: [{ id: "remove", title: "Remove", role: "destructive" }],
      },
      {
        id: "c",
        title: "Harbour Lights",
        subtitle: "The Platters",
      },
      {
        id: "d",
        title: "Tide Is High",
        subtitle: "Blondie",
      },
    ],
  },
];

const OUTLINE: ListSection[] = [
  {
    id: "tree",
    header: "Library",
    rows: [
      {
        id: "music",
        title: "Music",
        systemImage: "music.note.list",
        children: [
          {
            id: "albums",
            title: "Albums",
            systemImage: "square.stack.fill",
            children: [
              { id: "abbey", title: "Abbey Road", systemImage: "opticaldisc.fill" },
              { id: "blue", title: "Blue", systemImage: "opticaldisc.fill" },
            ],
          },
          { id: "artists", title: "Artists", systemImage: "music.mic" },
        ],
      },
      {
        id: "podcasts",
        title: "Podcasts",
        systemImage: "mic.fill",
        children: [{ id: "daily", title: "The Daily", systemImage: "waveform" }],
      },
      { id: "books", title: "Audiobooks", systemImage: "book.fill" },
    ],
  },
];

const Lists = () => {
  const native = useNativeEnabled();
  const tint = useAccent();
  const [heard, setHeard] = React.useState("nothing yet");
  return (
    <>
      <div className="nav-gap" />
      <List
        sections={SETTINGS}
        native={native}
        tint={tint}
        icon={webSymbol}
        onPress={(id) => setHeard(`tapped ${id}`)}
        onAction={(row, action) => setHeard(`${action} on ${row}`)}
      />
      <p className="list-footer">
        A SwiftUI List drawn from props: symbols, values, badges, accessories and swipe actions.
        Rows hold text and symbols only, never web content.
      </p>
      <Section header="Page sees">
        <Readout title="Last" value={heard} />
      </Section>
    </>
  );
};

const Editing = () => {
  const native = useNativeEnabled();
  const tint = useAccent();
  const [sections, setSections] = React.useState<readonly ListSection[]>(PLAYLIST);
  const [editing, setEditing] = React.useState(false);
  const [selected, setSelected] = React.useState<readonly string[]>([]);
  return (
    <>
      <div className="nav-gap" />
      <Section>
        <Row
          title="Edit Mode"
          accessory={<Toggle label="Edit Mode" isOn={editing} onChange={setEditing} />}
        />
      </Section>
      <List
        sections={sections}
        native={native}
        tint={tint}
        editing={editing}
        reorderable
        deletable
        selectionMode="multiple"
        selected={selected}
        onSelectedChange={setSelected}
        onSectionsChange={setSections}
        onAction={(row) => setSections(deleteRows(sections, "songs", [row]))}
      />
      <p className="list-footer">
        Swipe a row to delete it. In edit mode, drag rows by their handles or delete them; the new
        order flows back to the page. Out of it, tap rows to select them.
      </p>
      <Section header="Page sees">
        <Readout title="Order" value={sections[0]?.rows.map((row) => row.id).join(" ") ?? ""} />
        <Readout title="Selected" value={selected.join(" ") || "none"} />
      </Section>
      <Section>
        <div className="row row--centered">
          <Button
            title="Reset"
            onPress={() => {
              setSections(PLAYLIST);
              setSelected([]);
            }}
          />
        </div>
      </Section>
    </>
  );
};

const Outlines = () => {
  const native = useNativeEnabled();
  const tint = useAccent();
  const [expanded, setExpanded] = React.useState<readonly string[]>(["music"]);
  return (
    <>
      <div className="nav-gap" />
      <List
        sections={OUTLINE}
        native={native}
        tint={tint}
        icon={webSymbol}
        expanded={expanded}
        onExpandedChange={setExpanded}
      />
      <p className="list-footer">
        Rows with children are disclosure groups, nested to any depth as an outline.
      </p>
      <Section header="Page sees">
        <Readout title="Expanded" value={expanded.join(" ") || "none"} />
      </Section>
    </>
  );
};

const Bars = () => {
  const native = useNativeEnabled();
  const tint = useAccent();
  const [heard, setHeard] = React.useState("nothing yet");
  return (
    <>
      <div className="nav-gap" />
      <h2 className="list-header">Navigation bar</h2>
      <Stage>
        <div className="bar-demo">
          <NavigationBar
            title="Photos"
            showsBack
            native={native}
            tint={tint}
            icon={webSymbol}
            trailing={[
              { id: "select", title: "Select" },
              {
                id: "more",
                kind: "menu",
                systemImage: "ellipsis",
                items: [
                  { id: "grid", title: "Grid", systemImage: "square.grid.2x2", checked: true },
                  { id: "list", title: "List", systemImage: "list.bullet" },
                ],
              },
            ]}
            onBack={() => setHeard("back")}
            onSelect={(id) => setHeard(id)}
          />
        </div>
      </Stage>
      <h2 className="list-header">Toolbar</h2>
      <Stage>
        <div className="bar-demo">
          <Toolbar
            native={native}
            tint={tint}
            icon={webSymbol}
            items={[
              { id: "share", systemImage: "square.and.arrow.up" },
              { kind: "flexibleSpace" },
              { id: "favorite", systemImage: "heart" },
              { id: "info", systemImage: "info.circle" },
              { id: "trash", systemImage: "trash" },
              { kind: "flexibleSpace" },
              { id: "edit", title: "Edit", prominent: true, tint },
            ]}
            onSelect={setHeard}
          />
        </div>
      </Stage>
      <p className="list-footer">
        Items are props: buttons and menus grouped on glass the way iOS 26 groups them, split by
        spacers.
      </p>
      <Section header="Page sees">
        <Readout title="Last" value={heard} />
      </Section>
    </>
  );
};

const AppChrome = () => {
  const native = useNativeEnabled();
  const demo = useSheet();
  return (
    <>
      <div className="nav-gap" />
      <h2 className="list-header">Tab view</h2>
      <Stage>
        <TabViewDemo />
      </Stage>
      <p className="list-footer">
        Three tabs and a Search tab on the floating tab bar, with a badge and a bottom accessory.
      </p>
      <h2 className="list-header">Navigation stack</h2>
      <Stage>
        <div className="stage-row">
          <Button title="Open Navigation Demo" prominent onPress={demo.present} />
        </div>
      </Stage>
      <p className="list-footer">
        A whole screen in a full-screen cover: push a thread, then its contact, go back to any
        depth, and Forward after a pop.
      </p>
      <FullScreenCover
        {...demo.props}
        native={native}
        header={false}
        url={presentedURL("navigation", "Navigation")}
        background="var(--bg)"
        title="Navigation"
      />
    </>
  );
};

export const layoutScreens: readonly ScreenSpec[] = demoScreens("components", "Layout", [
  {
    id: "lists",
    keywords: ["list", "table", "rows", "swipe", "settings"],
    title: "Lists",
    symbol: "list.bullet.rectangle.fill",
    Component: Lists,
  },
  {
    id: "list-editing",
    keywords: ["reorder", "drag", "delete", "selection", "edit mode"],
    title: "Reorder & Select",
    symbol: "arrow.up.arrow.down",
    Component: Editing,
  },
  {
    id: "outlines",
    keywords: ["disclosure", "outline", "tree", "group"],
    title: "Outlines",
    symbol: "list.bullet.indent",
    Component: Outlines,
  },
  {
    id: "bars",
    keywords: ["toolbar", "navigation bar", "buttons", "menu"],
    title: "Toolbars",
    symbol: "menubar.rectangle",
    Component: Bars,
  },
  {
    id: "app-chrome",
    keywords: ["tab view", "tab bar", "bottom accessory", "navigation stack", "search"],
    title: "Tab View & Navigation",
    symbol: "platter.filled.bottom.iphone",
    Component: AppChrome,
  },
]);
