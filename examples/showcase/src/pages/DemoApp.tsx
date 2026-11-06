import * as React from "react";
import {
  List,
  NavigationStack,
  SearchField,
  TabAccessory,
  TabView,
  Toolbar,
  deleteRows,
  useNavigationPath,
  usePresentedPage,
  type BarItem,
  type ListSection,
  type NavigationScreen,
} from "native-islands/components";
import { useAccent, useNativeEnabled } from "../app/preferences";
import { Button } from "../ui/controls";
import { webSymbol } from "../ui/symbols";

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

/**
 * A whole app from the package alone: a tab view with a bottom accessory and
 * a Search tab, a navigation stack per tab, native lists with swipe actions
 * and an outline, and a toolbar. The Swift side is `NativeIslandsComponents.register()`.
 */
export const DemoApp = () => {
  const native = useNativeEnabled();
  const tint = useAccent();
  const page = usePresentedPage();
  const [tab, setTab] = React.useState("inbox");
  const [inbox, setInbox] = React.useState<readonly ListSection[]>(INBOX);
  const [query, setQuery] = React.useState("");
  const [playing, setPlaying] = React.useState(true);
  const mail = useNavigationPath("inbox");
  const close: BarItem = { id: "close", systemImage: "xmark" };
  const forward: BarItem[] = mail.canGoForward
    ? [{ id: "forward", systemImage: "chevron.right" }]
    : [];
  const contact = (name: string): NavigationScreen => ({
    title: name,
    largeTitle: true,
    render: () => (
      <div className="demo-message">
        <p>
          Three screens deep. Back goes one screen at a time, swipe-free; the buttons jump back to
          the thread or all the way to the Inbox at once.
        </p>
        <div className="demo-actions">
          <Button title="Back to the Thread" onPress={mail.pop} />
          <Button title="Back to Inbox" prominent onPress={mail.popToRoot} />
        </div>
      </div>
    ),
  });
  const screens: Record<string, NavigationScreen> = {
    inbox: {
      title: "Inbox",
      largeTitle: true,
      leading: [close],
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
      render: () => (
        <div className="demo-message">
          <p>A pushed screen with its own bar items. Send pops back to the Inbox.</p>
        </div>
      ),
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
              <div className="demo-message">
                <p>{row.subtitle}</p>
                <div className="demo-actions">
                  <Button
                    title={`About ${row.title}`}
                    onPress={() => mail.push(`${row.id}-contact`)}
                  />
                </div>
                <Toolbar
                  native={native}
                  tint={tint}
                  icon={webSymbol}
                  items={[
                    { id: "archive", systemImage: "archivebox" },
                    { id: "flag", systemImage: "flag" },
                    { kind: "flexibleSpace" },
                    { id: "reply", title: "Reply", prominent: true, tint },
                  ]}
                />
              </div>
            ),
          } satisfies NavigationScreen,
        ],
        [`${row.id}-contact`, contact(row.title)],
      ]),
    ),
  };
  const files: Record<string, NavigationScreen> = {
    files: {
      title: "Files",
      largeTitle: true,
      leading: [close],
      render: () => <List sections={FILES} native={native} tint={tint} icon={webSymbol} />,
    },
  };
  const onBar = (id: string) => {
    if (id === "close") page.dismiss(null);
    else if (id === "forward") mail.forward();
    else if (id === "compose") mail.push("compose");
    else if (id === "send") mail.popToRoot();
  };
  return (
    <div className="demo-app">
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
            badge: inbox[0]?.rows.length,
            content: (
              <NavigationStack
                path={mail.path}
                onPathChange={mail.setPath}
                screens={screens}
                tint={tint}
                icon={webSymbol}
                native={native}
                onSelect={onBar}
              />
            ),
          },
          {
            id: "files",
            title: "Files",
            systemImage: "folder.fill",
            content: (
              <NavigationStack
                path={["files"]}
                onPathChange={() => {}}
                screens={files}
                tint={tint}
                icon={webSymbol}
                native={native}
                onSelect={onBar}
              />
            ),
          },
        ]}
        search={{
          content: (
            <div className="demo-search">
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
