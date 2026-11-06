import * as React from "react";
import {
  Alert,
  ConfirmationDialog,
  FullScreenCover,
  Inspector,
  Popover,
  Sheet,
  useSheet,
  type NativeJSON,
  type PresentationDismiss,
  type SheetDetent,
} from "native-islands/components";
import { demoScreens, type ScreenSpec } from "../../app/nav";
import { useAccent, useNativeEnabled } from "../../app/preferences";
import { Readout, Row, Section } from "../../ui/List";
import { Button, Segmented } from "../../ui/controls";

/** The page a presentation shows: another load of this app, with `?page=`. */
export const presentedURL = (page: string, title: string) =>
  `?page=${page}&title=${encodeURIComponent(title)}`;

const describe = (dismiss: PresentationDismiss) =>
  dismiss.reason === "page"
    ? `closed by the page: ${JSON.stringify(dismiss.result)}`
    : "swiped away";

const DETENTS: readonly { title: string; detents: readonly SheetDetent[] }[] = [
  { title: "Medium + Large", detents: ["medium", "large"] },
  { title: "Large", detents: ["large"] },
  { title: "240 pt", detents: ["240"] },
];

const Sheets = () => {
  const native = useNativeEnabled();
  const sheet = useSheet();
  const cover = useSheet();
  const inspector = useSheet();
  const [detentIndex, setDetentIndex] = React.useState(0);
  const [heard, setHeard] = React.useState("nothing yet");
  const [detent, setDetent] = React.useState<string>("–");
  const message = (data: NativeJSON) => setHeard(`message: ${JSON.stringify(data)}`);
  return (
    <>
      <div className="nav-gap" />
      <Section
        header="Sheet"
        footer="A real UISheetPresentationController holding another web page, with its own native islands. Drag between detents or swipe it away."
      >
        <div className="row row--centered">
          <Segmented
            segments={DETENTS.map((entry) => entry.title)}
            selectedIndex={detentIndex}
            onChange={setDetentIndex}
          />
        </div>
        <div className="row row--centered">
          <Button title="Show Sheet" prominent onPress={sheet.present} />
        </div>
      </Section>
      <Section header="Covers and inspectors">
        <div className="row row--centered stage-row">
          <Button title="Full Screen Cover" onPress={cover.present} />
          <Button title="Inspector" onPress={inspector.present} />
        </div>
      </Section>
      <Section header="Page sees">
        <Readout title="Last" value={heard} />
        <Readout title="Detent" value={detent} />
      </Section>
      <Sheet
        {...sheet.props}
        native={native}
        url={presentedURL("sheet", "Sheet")}
        title="Sheet"
        detents={DETENTS[detentIndex]?.detents}
        onDetentChange={setDetent}
        onDismiss={(dismiss) => setHeard(describe(dismiss))}
        onMessage={message}
      />
      <FullScreenCover
        {...cover.props}
        native={native}
        url={presentedURL("cover", "Full Screen Cover")}
        title="Full Screen Cover"
        onDismiss={(dismiss) => setHeard(describe(dismiss))}
        onMessage={message}
      />
      <Inspector
        {...inspector.props}
        native={native}
        url={presentedURL("inspector", "Inspector")}
        title="Inspector"
        onDismiss={(dismiss) => setHeard(describe(dismiss))}
        onMessage={message}
      />
    </>
  );
};

const Popovers = () => {
  const native = useNativeEnabled();
  const popover = useSheet();
  const [heard, setHeard] = React.useState("nothing yet");
  return (
    <>
      <div className="nav-gap" />
      <div className="stage">
        <div className="stage-row">
          <Popover
            {...popover.props}
            native={native}
            url={presentedURL("popover", "Popover")}
            title="Popover"
            width={300}
            height={340}
            onDismiss={(dismiss) => setHeard(describe(dismiss))}
          >
            <Button title="Show Popover" prominent onPress={popover.present} />
          </Popover>
        </div>
      </div>
      <p className="list-footer">
        A popover points at the button that opened it, and stays a popover on iPhone. Its content is
        another web page.
      </p>
      <Section header="Page sees">
        <Readout title="Last" value={heard} />
      </Section>
    </>
  );
};

const Alerts = () => {
  const native = useNativeEnabled();
  const tint = useAccent();
  const [alert, setAlert] = React.useState(false);
  const [rename, setRename] = React.useState(false);
  const [dialog, setDialog] = React.useState(false);
  const [heard, setHeard] = React.useState("nothing yet");
  return (
    <>
      <div className="nav-gap" />
      <Section footer="UIAlertController, built from props: a title, a message and buttons with roles. The page hears which button was chosen and what was typed.">
        <Row
          title="Delete Photo"
          subtitle="An alert with a destructive button"
          onPress={() => setAlert(true)}
        />
        <Row title="Rename" subtitle="An alert with a text field" onPress={() => setRename(true)} />
      </Section>
      <div className="stage">
        <div className="stage-row">
          <ConfirmationDialog
            open={dialog}
            onOpenChange={setDialog}
            native={native}
            tint={tint}
            title="Sign out of Islands?"
            message="Your favourites stay on this iPhone."
            buttons={[
              { id: "sign-out", title: "Sign Out", role: "destructive" },
              { id: "cancel", title: "Cancel", role: "cancel" },
            ]}
            onAction={(id) => setHeard(`dialog: ${id}`)}
          >
            <Button title="Confirmation Dialog" onPress={() => setDialog(true)} />
          </ConfirmationDialog>
        </div>
      </div>
      <Section header="Page sees">
        <Readout title="Last" value={heard} />
      </Section>
      <Alert
        open={alert}
        onOpenChange={setAlert}
        native={native}
        title="Delete this photo?"
        message="It will be removed from all your devices."
        buttons={[
          { id: "cancel", title: "Cancel", role: "cancel" },
          { id: "delete", title: "Delete", role: "destructive" },
        ]}
        onAction={(id) => setHeard(`alert: ${id}`)}
      />
      <Alert
        open={rename}
        onOpenChange={setRename}
        native={native}
        tint={tint}
        title="Rename Album"
        textFields={[{ id: "name", placeholder: "Name", text: "Summer" }]}
        buttons={[
          { id: "cancel", title: "Cancel", role: "cancel" },
          { id: "save", title: "Save", preferred: true },
        ]}
        onAction={(id, values) => setHeard(`${id}: ${values.name ?? ""}`)}
      />
    </>
  );
};

export const presentationScreens: readonly ScreenSpec[] = demoScreens(
  "components",
  "Presentations",
  [
    {
      id: "sheets",
      keywords: ["modal", "detent", "cover", "inspector", "page"],
      title: "Sheets & Covers",
      symbol: "rectangle.bottomhalf.inset.filled",
      Component: Sheets,
    },
    {
      id: "popovers",
      keywords: ["popover", "anchor"],
      title: "Popovers",
      symbol: "bubble.middle.top.fill",
      Component: Popovers,
    },
    {
      id: "alerts",
      keywords: ["alert", "confirmation", "dialog", "action sheet"],
      title: "Alerts & Dialogs",
      symbol: "exclamationmark.bubble.fill",
      Component: Alerts,
    },
  ],
);
