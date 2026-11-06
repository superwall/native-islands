import * as React from "react";
import { List, usePresentedPage, type ListSection } from "native-islands/components";
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
 * showcase in its own web view, with its own native islands. The system draws
 * its header (the title and Done). It closes itself with a result, moves its
 * sheet between detents, and messages the page that presented it, which
 * answers every message.
 */
export const PresentedPage = () => {
  const native = useNativeEnabled();
  const tint = useAccent();
  const [heard, setHeard] = React.useState("nothing yet");
  const page = usePresentedPage((data) => setHeard(JSON.stringify(data)));
  const [sent, setSent] = React.useState(0);
  const sheet = page.style === "sheet" || page.style === "inspector";
  return (
    <div className="presented">
      <div className="presented-body">
        <p className="list-footer">
          This is a separate web page in its own WKWebView, presented as a {page.style ?? "page"}.{" "}
          {page.style === "popover" ? "The" : "The header is the system navigation bar; the"} list
          and the buttons are native islands.
        </p>
        <List
          sections={COLORS}
          native={native}
          tint={tint}
          icon={webSymbol}
          onPress={(id) => page.dismiss({ color: id })}
        />
        {sheet && (
          <Section
            header="Detent"
            footer="Moves the sheet from the page inside it. Dragging the grabber changes it too."
          >
            <div className="row row--centered stage-row">
              <Button
                title="Medium"
                prominent={page.detent === "medium"}
                onPress={() => page.setDetent("medium")}
              />
              <Button
                title="Large"
                prominent={page.detent === "large"}
                onPress={() => page.setDetent("large")}
              />
            </div>
          </Section>
        )}
        <Section footer="The presenting page counts the messages and answers each one.">
          <div className="row row--centered">
            <Button
              title={sent === 0 ? "Send a Message Up" : `Send Message ${sent + 1}`}
              onPress={() => {
                setSent(sent + 1);
                page.send({ count: sent + 1 });
              }}
            />
          </div>
        </Section>
        <Section header="This page sees">
          <Readout title="Presented as" value={page.style ?? "not presented"} />
          {sheet && <Readout title="Detent" value={page.detent ?? "–"} />}
          <Readout title="From the presenter" value={heard} />
        </Section>
      </div>
    </div>
  );
};
