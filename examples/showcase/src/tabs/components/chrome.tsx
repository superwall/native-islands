import * as React from "react";
import {
  List,
  NavigationStack,
  TabAccessory,
  TabView,
  deleteRows,
  useNavigationPath,
  usePresentedPage,
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

const MESSAGES = INBOX;

const Message = ({ text, children }: React.PropsWithChildren<{ text?: string }>) => (
  <div className="demo-message">
    {text && <p>{text}</p>}
    {children}
  </div>
);

/**
 * A navigation stack the page drives, as a whole screen in a full-screen
 * cover: a native navigation bar with a large title, push and pop, Back to any
 * depth, Forward after a pop, and a pushed screen with its own bar items.
 * Close dismisses the cover.
 */
export const NavigationDemoPage = () => {
  const native = useNativeEnabled();
  const page = usePresentedPage();
  const tint = useAccent();
  const [inbox, setInbox] = React.useState<readonly ListSection[]>(MESSAGES);
  const mail = useNavigationPath("inbox");
  const forward: BarItem[] = mail.canGoForward
    ? [{ id: "forward", systemImage: "chevron.right", accessibilityLabel: "Forward" }]
    : [];
  const screens: Record<string, NavigationScreen> = {
    inbox: {
      title: "Inbox",
      largeTitle: true,
      leading: [{ id: "close", title: "Close" }],
      trailing: [
        ...forward,
        { id: "compose", systemImage: "square.and.pencil", accessibilityLabel: "Compose" },
      ],
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
                accessibilityLabel: "More",
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
    <div className="chrome-screen">
      <NavigationStack
        path={mail.path}
        onPathChange={mail.setPath}
        screens={screens}
        tint={tint}
        icon={webSymbol}
        native={native}
        onSelect={(id) => {
          if (id === "close") page.dismiss();
          else if (id === "forward") mail.forward();
          else if (id === "compose") mail.push("compose");
          else if (id === "send") mail.popToRoot();
        }}
      />
    </div>
  );
};

const EmptyState = ({ title, text }: { title: string; text: string }) => (
  <div className="chrome-empty">
    <h3 className="chrome-empty-title">{title}</h3>
    <p className="chrome-empty-text">{text}</p>
  </div>
);

/**
 * A tab view in a card: three tabs and a Search tab on the floating tab bar,
 * a badge and a bottom accessory. The tabs hold empty states; the bar is the
 * point.
 */
export const TabViewDemo = () => {
  const native = useNativeEnabled();
  const tint = useAccent();
  const [tab, setTab] = React.useState("inbox");
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
            badge: 3,
            content: <EmptyState title="Inbox" text="No new messages." />,
          },
          {
            id: "files",
            title: "Files",
            systemImage: "folder.fill",
            content: <EmptyState title="Files" text="Nothing here yet." />,
          },
          {
            id: "profile",
            title: "Profile",
            systemImage: "person.crop.circle.fill",
            content: <EmptyState title="Profile" text="Not signed in." />,
          },
        ]}
        search={{
          content: <EmptyState title="Search" text="No recent searches." />,
        }}
        accessory={
          <TabAccessory
            title="Islands Radio"
            subtitle={playing ? "Playing" : "Paused"}
            systemImage="music.note"
            native={native}
            tint={tint}
            icon={webSymbol}
            actions={[
              {
                id: "toggle",
                systemImage: playing ? "pause.fill" : "play.fill",
                accessibilityLabel: playing ? "Pause" : "Play",
              },
            ]}
            onAction={() => setPlaying(!playing)}
          />
        }
      />
    </div>
  );
};
