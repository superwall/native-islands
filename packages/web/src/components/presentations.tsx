import * as React from "react";
import type { NativeCommonProps, NativeHandle } from "../react/components/Native";
import { useNativeSupport } from "../react/hooks/useNativeSupport";
import { cssVariables } from "./geometry";
import {
  NativeAlert,
  NativePresentation,
  type AlertButton,
  type AlertTextField,
  type NativeJSON,
  type PresentationDismiss,
  type PresentationStyle,
  type SheetDetent,
} from "./specs";

/**
 * Native presentations: another page in a sheet, cover, popover or
 * inspector, each in its own web view with its own islands, and alerts and
 * confirmation dialogs built from props. The page opens them with `open`
 * and hears when they close. Outside the app they are a `<dialog>`, with the
 * page in an `<iframe>`.
 */

const MESSAGE_TYPE = "nativeIslandsPresentation";

type PresentationCommands = { post: { args: NativeJSON; result: void } };

/** Sends data to the presented page, which hears it in `usePresentedPage().onMessage`. */
export type PresentationHandle = { post: (data: NativeJSON) => void };

export type PresentationProps = NativeCommonProps & {
  open: boolean;
  /** The page to present, read relative to this one. The app only presents a page from this page's origin. */
  url: string;
  onOpenChange: (open: boolean) => void;
  /** Called once it closed, with why and the presented page's `dismiss()` result. */
  onDismiss?: (dismiss: PresentationDismiss) => void;
  /** Data the presented page sent with `send()`. */
  onMessage?: (data: NativeJSON) => void;
  dismissible?: boolean;
  /** The title in the system navigation bar, and over the web version. */
  title?: string;
  /** False leaves out the system navigation bar with the title and Done; the page draws its own. */
  header?: boolean;
  /** Shows behind the presented page while it loads, such as `var(--page-background)`. */
  background?: string;
  /**
   * Loads the page in the app ahead of time, so it opens with its islands
   * already drawn. On by default; false loads it only when it opens.
   */
  preload?: boolean;
  handle?: React.Ref<PresentationHandle>;
};

type StyleProps = {
  style: PresentationStyle;
  detents?: readonly SheetDetent[];
  selectedDetent?: SheetDetent;
  onDetentChange?: (detent: SheetDetent) => void;
  grabber?: boolean;
  undimmed?: boolean;
  cornerRadius?: number;
  width?: number;
  height?: number;
  compact?: "popover" | "sheet";
};

const isMessage = (
  data: unknown,
): data is { type: string; action?: string; result?: NativeJSON; data?: NativeJSON } =>
  typeof data === "object" && data !== null && "type" in data && data.type === MESSAGE_TYPE;

/** Shows a `<dialog>` as a modal once it renders; it renders only while open. */
const useModal = (open: boolean) => {
  const dialog = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal?.();
  }, [open]);
  return dialog;
};

const isData = (value: unknown): value is { data: NativeJSON } =>
  typeof value === "object" && value !== null && "data" in value && value.data !== undefined;

const isDetent = (value: unknown): value is { type: "detent"; detent: SheetDetent } =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  value.type === "detent" &&
  "detent" in value &&
  typeof value.detent === "string";

/** The web version: a `<dialog>` showing the page in an `<iframe>`, closed by Escape or its Done button. */
const WebPresentation = ({
  open,
  url,
  style,
  title,
  dismissible,
  onClose,
  onMessage,
  frame,
  width,
  height,
}: {
  open: boolean;
  url: string;
  style: PresentationStyle;
  title?: string;
  dismissible?: boolean;
  onClose: (reason: PresentationDismiss["reason"], result: NativeJSON) => void;
  onMessage?: (data: NativeJSON) => void;
  frame: React.RefObject<HTMLIFrameElement | null>;
  width?: number;
  height?: number;
}) => {
  const dialog = useModal(open);
  React.useEffect(() => {
    if (!open) return;
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || !isMessage(event.data)) return;
      if (event.data.action === "dismiss") onClose("page", event.data.result ?? null);
      else if (event.data.action === "message") onMessage?.(event.data.data ?? null);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [open, frame, onClose, onMessage]);
  if (!open) return null;
  return (
    <dialog
      ref={dialog}
      className="ni-presentation"
      data-style={style}
      aria-label={title}
      style={cssVariables({
        "--ni-presentation-width": width === undefined ? undefined : `${width}px`,
        "--ni-presentation-height": height === undefined ? undefined : `${height}px`,
      })}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible !== false) onClose("user", null);
      }}
    >
      <header className="ni-presentation-header">
        <span className="ni-presentation-title">{title}</span>
        {dismissible !== false && (
          <button
            type="button"
            className="ni-presentation-done"
            onClick={() => onClose("user", null)}
          >
            Done
          </button>
        )}
      </header>
      <iframe ref={frame} className="ni-presentation-page" src={url} title={title ?? url} />
    </dialog>
  );
};

/** The shared body of `Sheet`, `FullScreenCover`, `Popover` and `Inspector`. */
const Presentation = ({
  open,
  url,
  onOpenChange,
  onDismiss,
  onMessage,
  dismissible,
  title,
  header,
  background,
  preload,
  handle,
  style,
  detents,
  selectedDetent,
  onDetentChange,
  grabber,
  undimmed,
  cornerRadius,
  width,
  height,
  compact,
  native = true,
  children,
  ...common
}: PresentationProps & StyleProps) => {
  const island = React.useRef<NativeHandle<PresentationCommands>>(null);
  const frame = React.useRef<HTMLIFrameElement>(null);
  const supported = useNativeSupport("presentation") === "supported" && native;
  React.useImperativeHandle(
    handle,
    () => ({
      post: (data: NativeJSON) => {
        if (supported) void island.current?.command("post", data).catch(() => {});
        else frame.current?.contentWindow?.postMessage({ type: MESSAGE_TYPE, data }, "*");
      },
    }),
    [supported],
  );
  const close = React.useCallback(
    (reason: PresentationDismiss["reason"], result: NativeJSON) => {
      onOpenChange(false);
      onDismiss?.({ reason, result });
    },
    [onOpenChange, onDismiss],
  );
  return (
    <>
      <NativePresentation
        ref={island}
        open={open}
        url={url}
        style={style}
        detents={detents}
        selectedDetent={selectedDetent}
        grabber={grabber}
        dismissible={dismissible}
        undimmed={undimmed}
        cornerRadius={cornerRadius}
        width={width}
        height={height}
        compact={compact}
        title={title}
        header={header}
        background={background}
        preload={preload}
        native={native}
        onOpenChange={(next) => {
          if (!next) onOpenChange(false);
        }}
        onSelectedDetentChange={onDetentChange}
        onDismiss={(dismiss) => onDismiss?.(dismiss)}
        onMessage={({ data }) => onMessage?.(data)}
        {...common}
      >
        {children ?? <span className="ni-anchor" data-style={style} aria-hidden="true" />}
      </NativePresentation>
      {!supported && (
        <WebPresentation
          open={open}
          url={url}
          style={style}
          title={title}
          dismissible={dismissible}
          onClose={close}
          onMessage={onMessage}
          frame={frame}
          width={width}
          height={height}
        />
      )}
    </>
  );
};

/**
 * A sheet holding another page. `detents` lists the heights it rests at
 * (`medium`, `large` or points), with a grabber when there is more than one.
 */
export const Sheet = ({
  detents,
  selectedDetent,
  onDetentChange,
  grabber,
  undimmed,
  cornerRadius,
  ...props
}: PresentationProps &
  Pick<
    StyleProps,
    "detents" | "selectedDetent" | "onDetentChange" | "grabber" | "undimmed" | "cornerRadius"
  >) => (
  <Presentation
    {...props}
    style="sheet"
    detents={detents}
    selectedDetent={selectedDetent}
    onDetentChange={onDetentChange}
    grabber={grabber}
    undimmed={undimmed}
    cornerRadius={cornerRadius}
  />
);

/** A cover over the whole screen; only the presented page or `open` closes it. */
export const FullScreenCover = (props: PresentationProps) => (
  <Presentation {...props} style="fullScreenCover" />
);

/**
 * A popover pointing at its children, which stay this page's own element.
 * It stays a popover on iPhone unless `compact` is `sheet`.
 */
export const Popover = ({
  width,
  height,
  compact,
  children,
  ...props
}: PresentationProps & Pick<StyleProps, "width" | "height" | "compact">) => (
  <span className="ni-anchored">
    {/* Before the children, so their islands stay above the anchor and take the taps. */}
    <Presentation {...props} style="popover" width={width} height={height} compact={compact}>
      <span className="ni-anchor ni-anchor--fill" aria-hidden="true" />
    </Presentation>
    {children}
  </span>
);

/** An inspector: a sheet with a medium and a large detent on iPhone, a form sheet on iPad. */
export const Inspector = ({
  detents,
  ...props
}: PresentationProps & Pick<StyleProps, "detents">) => (
  <Presentation {...props} style="inspector" detents={detents} />
);

/** Open state for a presentation: `present()`, `dismiss()`, and the props to spread on it. */
export const usePresentation = (initial = false) => {
  const [open, setOpen] = React.useState(initial);
  return {
    open,
    present: React.useCallback(() => setOpen(true), []),
    dismiss: React.useCallback(() => setOpen(false), []),
    props: { open, onOpenChange: setOpen },
  };
};

/** `usePresentation` under the name of what it most often opens. */
export const useSheet = usePresentation;

type PresentedWindow = Window & {
  __NATIVE_ISLANDS_PRESENTED__?: { style?: PresentationStyle; detent?: SheetDetent };
  webkit?: {
    messageHandlers?: Record<string, { postMessage: (body: unknown) => void } | undefined>;
  };
};

const presentedWindow = (): PresentedWindow => window;

const presentedStyle = (): PresentationStyle | undefined => {
  const presented = presentedWindow().__NATIVE_ISLANDS_PRESENTED__;
  if (presented) return presented.style ?? "sheet";
  return window.parent !== window ? "sheet" : undefined;
};

const postUp = (body: {
  action: "dismiss" | "message" | "detent";
  result?: NativeJSON;
  data?: NativeJSON;
  detent?: SheetDetent;
}) => {
  const page = presentedWindow();
  const handler = page.webkit?.messageHandlers?.[MESSAGE_TYPE];
  if (page.__NATIVE_ISLANDS_PRESENTED__ && handler) {
    handler.postMessage({
      type: body.action,
      result: body.result ?? null,
      data: body.data ?? null,
      ...(body.detent === undefined ? {} : { detent: body.detent }),
    });
  } else if (window.parent !== window) {
    window.parent.postMessage({ type: MESSAGE_TYPE, ...body }, "*");
  }
};

const presentedDetent = (): SheetDetent | undefined =>
  presentedWindow().__NATIVE_ISLANDS_PRESENTED__?.detent;

/**
 * For the page a presentation shows: whether it is presented and how,
 * `dismiss(result)` to close it and hand `result` to the presenting page,
 * `send(data)` to message it, the data it posts down, and for a sheet the
 * `detent` it rests at and `setDetent()` to move it.
 */
export const usePresentedPage = (onMessage?: (data: NativeJSON) => void) => {
  const [style, setStyle] = React.useState(presentedStyle);
  const [detent, setDetentState] = React.useState(presentedDetent);
  const latest = React.useRef(onMessage);
  latest.current = onMessage;
  React.useEffect(() => {
    const presented = () => {
      setStyle(presentedStyle());
      setDetentState(presentedDetent());
    };
    const native = (event: Event) => {
      const detail: unknown = event instanceof CustomEvent ? event.detail : undefined;
      if (isDetent(detail)) setDetentState(detail.detent);
      else latest.current?.(isData(detail) ? detail.data : null);
    };
    const framed = (event: MessageEvent) => {
      if (event.source === window.parent && isMessage(event.data))
        latest.current?.(event.data.data ?? null);
    };
    window.addEventListener("nativeislandspresented", presented);
    window.addEventListener("nativeislandspresentation", native);
    window.addEventListener("message", framed);
    return () => {
      window.removeEventListener("nativeislandspresented", presented);
      window.removeEventListener("nativeislandspresentation", native);
      window.removeEventListener("message", framed);
    };
  }, []);
  return {
    presented: style !== undefined,
    style,
    dismiss: React.useCallback(
      (result: NativeJSON = null) => postUp({ action: "dismiss", result }),
      [],
    ),
    send: React.useCallback((data: NativeJSON) => postUp({ action: "message", data }), []),
    detent,
    setDetent: React.useCallback(
      (next: SheetDetent) => postUp({ action: "detent", detent: next }),
      [],
    ),
  };
};

export type AlertProps = NativeCommonProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message?: string;
  buttons?: readonly AlertButton[];
  /** Called with the button chosen and what was typed in `textFields`. */
  onAction?: (id: string, values: Readonly<Record<string, string>>) => void;
  tint?: string;
};

const DEFAULT_BUTTONS: readonly AlertButton[] = [{ id: "ok", title: "OK", role: "cancel" }];

/** The web version of an alert or a confirmation dialog: a `<dialog>` of buttons. */
const WebAlert = ({
  open,
  dialogStyle,
  title,
  message,
  buttons,
  textFields,
  tint,
  choose,
}: {
  open: boolean;
  dialogStyle: "alert" | "confirmationDialog";
  title?: string;
  message?: string;
  buttons: readonly AlertButton[];
  textFields: readonly AlertTextField[];
  tint?: string;
  choose: (id: string, values: Record<string, string>) => void;
}) => {
  const dialog = useModal(open);
  const [values, setValues] = React.useState<Record<string, string>>({});
  if (!open) return null;
  const valuesOf = () =>
    Object.fromEntries(textFields.map((field) => [field.id, values[field.id] ?? field.text ?? ""]));
  const cancel = buttons.find((button) => button.role === "cancel");
  return (
    <dialog
      ref={dialog}
      className="ni-alert"
      data-style={dialogStyle}
      role="alertdialog"
      aria-label={title}
      style={cssVariables({ "--ni-tint": tint })}
      onCancel={(event) => {
        event.preventDefault();
        if (cancel) choose(cancel.id, valuesOf());
      }}
    >
      <div className="ni-alert-body">
        {title && <p className="ni-alert-title">{title}</p>}
        {message && <p className="ni-alert-message">{message}</p>}
        {textFields.map((field) => (
          <input
            key={field.id}
            className="ni-alert-field"
            type={field.secure ? "password" : "text"}
            placeholder={field.placeholder}
            aria-label={field.placeholder ?? field.id}
            value={values[field.id] ?? field.text ?? ""}
            onChange={(event) =>
              setValues((current) => ({ ...current, [field.id]: event.target.value }))
            }
          />
        ))}
      </div>
      <div className="ni-alert-buttons" data-count={buttons.length}>
        {buttons.map((button) => (
          <button
            key={button.id}
            type="button"
            className="ni-alert-button"
            data-role={button.role}
            data-preferred={button.preferred ? "" : undefined}
            onClick={() => choose(button.id, valuesOf())}
          >
            {button.title}
          </button>
        ))}
      </div>
    </dialog>
  );
};

const AlertBody = ({
  dialogStyle,
  open,
  onOpenChange,
  title,
  message,
  buttons = DEFAULT_BUTTONS,
  textFields = [],
  onAction,
  tint,
  native = true,
  children,
  ...common
}: AlertProps & {
  dialogStyle: "alert" | "confirmationDialog";
  textFields?: readonly AlertTextField[];
}) => {
  const supported = useNativeSupport("alert") === "supported" && native;
  const choose = (id: string, values: Readonly<Record<string, string>>) => {
    onOpenChange(false);
    onAction?.(id, values);
  };
  return (
    <>
      <NativeAlert
        open={open}
        style={dialogStyle}
        title={title}
        message={message}
        buttons={buttons}
        textFields={textFields.length > 0 ? textFields : undefined}
        tint={tint}
        native={native}
        onOpenChange={(next) => {
          if (!next) onOpenChange(false);
        }}
        onAction={({ id, values }) => onAction?.(id, values)}
        {...common}
      >
        {children ?? <span className="ni-anchor" aria-hidden="true" />}
      </NativeAlert>
      {!supported && (
        <WebAlert
          open={open}
          dialogStyle={dialogStyle}
          title={title}
          message={message}
          buttons={buttons}
          textFields={textFields}
          tint={tint}
          choose={choose}
        />
      )}
    </>
  );
};

/** A system alert. A button closes it and reports its id, with what was typed in `textFields`. */
export const Alert = (props: AlertProps & { textFields?: readonly AlertTextField[] }) => (
  <AlertBody {...props} dialogStyle="alert" />
);

/**
 * A confirmation dialog: an action sheet on iPhone, a popover pointing at
 * its children on iPad.
 */
export const ConfirmationDialog = ({ children, ...props }: AlertProps) => (
  <span className="ni-anchored">
    {children}
    <AlertBody {...props} dialogStyle="confirmationDialog">
      <span className="ni-anchor ni-anchor--fill" aria-hidden="true" />
    </AlertBody>
  </span>
);
