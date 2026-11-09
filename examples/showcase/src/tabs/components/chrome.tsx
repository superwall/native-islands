import * as React from "react";
import {
  List,
  NavigationStack,
  SearchField,
  TabAccessory,
  TabView,
  deleteRows,
  useNavigationPath,
  type BarItem,
  type ListSection,
  type NavigationScreen,
} from "native-islands/components";
import { useAccent, useNativeEnabled } from "../../app/preferences";
import { Button } from "../../ui/controls";
import { webSymbol } from "../../ui/symbols";

const INBOX: ListSection[] = [
  {
    id: "inbox",
    rows: [
      {
        id: "m1",
        title: "Lena",
        subtitle: "Lunch on Friday?",
        value: "9:41",
        badge: 2,
        accessory: "chevron",
        trailingActions: [
          { id: "delete", title: "Delete", systemImage: "trash", role: "destructive" },
        ],
        leadingActions: [{ id: "pin", title: "Pin", systemImage: "pin.fill", tint: "#ff9f0a" }],
      },
      {
        id: "m2",
        title: "Build bot",
        subtitle: "All checks passed",
        value: "9:12",
        accessory: "chevron",
        trailingActions: [
          { id: "delete", title: "Delete", systemImage: "trash", role: "destructive" },
        ],
      },
      {
        id: "m3",
        title: "Sam",
        subtitle: "Photos from the trip",
        value: "Yesterday",
        accessory: "chevron",
        trailingActions: [
          { id: "delete", title: "Delete", systemImage: "trash", role: "destructive" },
        ],
      },
    ],
  },
];

const FILES: ListSection[] = [
  {
    id: "files",
    header: "On My iPhone",
    rows: [
      {
        id: "docs",
        title: "Documents",
        systemImage: "folder.fill",
        children: [
          { id: "cv", title: "CV.pdf", systemImage: "doc.fill" },
          {
            id: "notes",
            title: "Notes",
            systemImage: "folder.fill",
            children: [{ id: "ideas", title: "Ideas.md", systemImage: "doc.text.fill" }],
          },
        ],
      },
      {
        id: "downloads",
        title: "Downloads",
        systemImage: "folder.fill",
        children: [{ id: "zip", title: "Islands.zip", systemImage: "doc.zipper" }],
      },
    ],
  },
];

const MESSAGES = INBOX;

const Message = ({ text, children }: React.PropsWithChildren<{ text?: string }>) => (
  <div className="demo-message">
    {text && <p>{text}</p>}
    {children}
  </div>
);

/**
 * A navigation stack the page drives, in a card: a native navigation bar with
 * a large title, push and pop, Back to any depth, Forward after a pop, and a
 * pushed screen with its own bar items.
 */
export const NavigationDemo = () => {
  const native = useNativeEnabled();
  const tint = useAccent();
  const [inbox, setInbox] = React.useState<readonly ListSection[]>(MESSAGES);
  const mail = useNavigationPath("inbox");
  const forward: BarItem[] = mail.canGoForward
    ? [{ id: "forward", systemImage: "chevron.right" }]
    : [];
  const screens: Record<string, NavigationScreen> = {
    inbox: {
      title: "Inbox",
      largeTitle: true,
      trailing: [...forward, { id: "compose", systemImage: "square.and.pencil" }],
      render: () => (
        <List
          sections={inbox}
          native={native}
          tint={tint}
          icon={webSymbol}
          onPress={(id) => mail.push(id)}
          onAction={(row, action) => {
            if (action === "delete") setInbox(deleteRows(inbox, "inbox", [row]));
          }}
        />
      ),
    },
    compose: {
      title: "New Message",
      trailing: [{ id: "send", title: "Send", prominent: true, tint }],
      render: () => <Message text="A pushed screen with its own bar items. Send pops back." />,
    },
    ...Object.fromEntries(
      (inbox[0]?.rows ?? []).flatMap((row) => [
        [
          row.id,
          {
            title: row.title,
            trailing: [
              {
                id: "more",
                kind: "menu",
                systemImage: "ellipsis",
                items: [
                  { id: "reply", title: "Reply", systemImage: "arrowshape.turn.up.left" },
                  { id: "delete", title: "Delete", systemImage: "trash", destructive: true },
                ],
              },
            ],
            render: () => (
              <Message text={row.subtitle}>
                <div className="demo-actions">
                  <Button
                    title={`About ${row.title}`}
                    onPress={() => mail.push(`${row.id}-contact`)}
                  />
                </div>
              </Message>
            ),
          } satisfies NavigationScreen,
        ],
        [
          `${row.id}-contact`,
          {
            title: row.title,
            largeTitle: true,
            render: () => (
              <Message text="Three screens deep. Back goes one screen at a time; these jump.">
                <div className="demo-actions">
                  <Button title="Back to the Thread" onPress={mail.pop} />
                  <Button title="Back to Inbox" prominent onPress={mail.popToRoot} />
                </div>
              </Message>
            ),
          } satisfies NavigationScreen,
        ],
      ]),
    ),
  };
  return (
    <div className="chrome-demo">
      <NavigationStack
        path={mail.path}
        onPathChange={mail.setPath}
        screens={screens}
        tint={tint}
        icon={webSymbol}
        native={native}
        onSelect={(id) => {
          if (id === "forward") mail.forward();
          else if (id === "compose") mail.push("compose");
          else if (id === "send") mail.popToRoot();
        }}
      />
    </div>
  );
};

/**
 * A tab view in a card: the floating tab bar with a badge, a Search tab and a
 * bottom accessory, each tab keeping its content when you leave it.
 */
export const TabViewDemo = () => {
  const native = useNativeEnabled();
  const tint = useAccent();
  const [tab, setTab] = React.useState("inbox");
  const [query, setQuery] = React.useState("");
  const [playing, setPlaying] = React.useState(true);
  return (
    <div className="chrome-demo">
      <TabView
        selectedId={tab}
        onSelect={setTab}
        tint={tint}
        icon={webSymbol}
        native={native}
        tabs={[
          {
            id: "inbox",
            title: "Inbox",
            systemImage: "tray.fill",
            badge: MESSAGES[0]?.rows.length,
            content: (
              <div className="chrome-demo-tab">
                <h2 className="ni-large-title">Inbox</h2>
                <List sections={MESSAGES} native={native} tint={tint} icon={webSymbol} />
              </div>
            ),
          },
          {
            id: "files",
            title: "Files",
            systemImage: "folder.fill",
            content: (
              <div className="chrome-demo-tab">
                <h2 className="ni-large-title">Files</h2>
                <List sections={FILES} native={native} tint={tint} icon={webSymbol} />
              </div>
            ),
          },
        ]}
        search={{
          content: (
            <div className="chrome-demo-tab demo-search">
              <SearchField text={query} onChange={setQuery} native={native} tint={tint} />
              <p className="list-footer">
                {query ? `Searching for “${query}”` : "Type to search."}
              </p>
            </div>
          ),
        }}
        accessory={
          <TabAccessory
            title="Islands Radio"
            subtitle={playing ? "Playing" : "Paused"}
            systemImage="music.note"
            native={native}
            tint={tint}
            icon={webSymbol}
            actions={[{ id: "toggle", systemImage: playing ? "pause.fill" : "play.fill" }]}
            onAction={() => setPlaying(!playing)}
          />
        }
      />
    </div>
  );
};
