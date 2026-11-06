import * as React from "react";
import { List, NavigationBar, usePresentedPage, type ListSection } from "native-islands/components";
import { useAccent, useNativeEnabled } from "../app/preferences";
import { Readout, Section } from "../ui/List";
import { Button } from "../ui/controls";
import { webSymbol } from "../ui/symbols";

const COLORS: ListSection[] = [
  {
    id: "colors",
    header: "Pick one to send back",
    rows: [
      { id: "blue", title: "Blue", systemImage: "circle.fill", iconTint: "#0a84ff" },
      { id: "green", title: "Green", systemImage: "circle.fill", iconTint: "#30d158" },
      { id: "orange", title: "Orange", systemImage: "circle.fill", iconTint: "#ff9f0a" },
      { id: "pink", title: "Pink", systemImage: "circle.fill", iconTint: "#ff375f" },
    ],
  },
];

/**
 * The page a sheet, cover, popover or inspector shows: another load of the
 * showcase in its own web view, with its own native islands. It closes
 * itself with a result, and messages the page that presented it.
 */
export const PresentedPage = ({ title }: { title: string }) => {
  const native = useNativeEnabled();
  const tint = useAccent();
  const [heard, setHeard] = React.useState("nothing yet");
  const page = usePresentedPage((data) => setHeard(JSON.stringify(data)));
  const [sent, setSent] = React.useState(0);
  return (
    <div className="presented">
      <header className="presented-bar">
        <NavigationBar
          title={title}
          native={native}
          tint={tint}
          icon={webSymbol}
          trailing={[{ id: "done", title: "Done", prominent: true, tint }]}
          onSelect={() => page.dismiss("done")}
        />
      </header>
      <div className="presented-body">
        <p className="list-footer">
          This is a separate web page in its own WKWebView, presented as a {page.style ?? "page"}.
          The list and the buttons on it are native islands too.
        </p>
        <List
          sections={COLORS}
          native={native}
          tint={tint}
          icon={webSymbol}
          onPress={(id) => page.dismiss({ color: id })}
        />
        <Section>
          <div className="row row--centered">
            <Button
              title="Send a Message Up"
              onPress={() => {
                setSent(sent + 1);
                page.send({ count: sent + 1 });
              }}
            />
          </div>
        </Section>
        <Section header="This page sees">
          <Readout title="Presented as" value={page.style ?? "not presented"} />
          <Readout title="From the presenter" value={heard} />
        </Section>
      </div>
    </div>
  );
};
