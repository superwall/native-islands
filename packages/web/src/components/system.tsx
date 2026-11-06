import * as React from "react";
import type { NativeCommonProps, NativeHandle } from "../react/components/Native";
import { cssVariables } from "./geometry";
import { Glyph } from "./glyphs";
import {
  NativeHapticButton,
  NativePermission,
  NativeShareButton,
  NativeTip,
  type HapticFeedback,
  type PermissionKind,
  type PermissionStatus,
  type Prominence,
  type TipAction,
  type TipArrowEdge,
} from "./specs";

/** The system's own buttons: haptics, the share sheet, permission prompts and tips. */

type ActionLook = {
  title?: string;
  systemImage?: string;
  /** The web version's drawing of `systemImage`. */
  icon?: React.ReactNode;
  prominence?: Prominence;
  tint?: string;
  glassGroup?: string;
};

const ActionPill = ({
  title,
  icon,
  prominence,
  tint,
  onClick,
}: ActionLook & { onClick: () => void }) => (
  <button
    type="button"
    className="ni-glass ni-glass--pill"
    data-prominent={prominence === "prominent" ? "" : undefined}
    style={cssVariables({ "--ni-tint": tint })}
    onClick={onClick}
  >
    {icon && <span className="ni-icon">{icon}</span>}
    {title}
  </button>
);

/** How long the web version vibrates for `feedback`, where the browser can. */
export const vibrationOf = (feedback: HapticFeedback): number =>
  feedback === "heavy" || feedback === "rigid" || feedback === "error" ? 30 : 10;

/**
 * A glass button that plays haptic feedback the moment it is touched, before
 * the page hears about it. A browser can only try to vibrate.
 */
export const HapticButton = ({
  feedback,
  title,
  systemImage,
  icon,
  prominence = "regular",
  tint,
  glassGroup,
  onPress,
  children,
  accessibility,
  ...common
}: NativeCommonProps & ActionLook & { feedback: HapticFeedback; onPress?: () => void }) => (
  <NativeHapticButton
    feedback={feedback}
    title={title}
    systemImage={systemImage}
    prominence={prominence}
    tint={tint}
    glassGroup={glassGroup}
    accessibility={accessibility ?? (title === undefined ? undefined : { label: title })}
    onPress={onPress}
    {...common}
  >
    {children ?? (
      <ActionPill
        title={title}
        icon={icon}
        prominence={prominence}
        tint={tint}
        onClick={() => {
          navigator.vibrate?.(vibrationOf(feedback));
          onPress?.();
        }}
      />
    )}
  </NativeHapticButton>
);

/**
 * A glass button that opens the system share sheet with `text` and `url`,
 * anchored to it. It reports the activity chosen, or null if cancelled. Its
 * web version uses the Web Share API, or copies to the clipboard.
 */
export const ShareButton = ({
  text,
  url,
  title,
  systemImage = "square.and.arrow.up",
  icon,
  prominence = "regular",
  tint,
  glassGroup,
  onComplete,
  children,
  accessibility,
  ...common
}: NativeCommonProps &
  ActionLook & {
    text?: string;
    url?: string;
    onComplete?: (activity: string | null) => void;
  }) => {
  const share = () => {
    if (!navigator.share) {
      const copied = [text, url].filter(Boolean).join(" ");
      void navigator.clipboard?.writeText(copied).then(
        () => onComplete?.("CopyToPasteboard"),
        () => onComplete?.(null),
      );
      return;
    }
    navigator.share({ text, url }).then(
      () => onComplete?.("done"),
      () => onComplete?.(null),
    );
  };
  return (
    <NativeShareButton
      text={text}
      url={url}
      title={title}
      systemImage={systemImage}
      prominence={prominence}
      tint={tint}
      glassGroup={glassGroup}
      accessibility={accessibility ?? { label: title ?? "Share" }}
      onComplete={({ activity }) => onComplete?.(activity)}
      {...common}
    >
      {children ?? (
        <ActionPill title={title} icon={icon} prominence={prominence} tint={tint} onClick={share} />
      )}
    </NativeShareButton>
  );
};

/** A browser permission state, or `Notification.permission`, as a permission status. */
export const fromBrowser = (state: string): PermissionStatus =>
  state === "granted" ? "granted" : state === "denied" ? "denied" : "notDetermined";

/** Asks the browser for what the native permission stands for, where it can. */
export const askBrowser = async (kind: PermissionKind): Promise<PermissionStatus> => {
  try {
    switch (kind) {
      case "camera":
      case "microphone": {
        const stream = await navigator.mediaDevices.getUserMedia(
          kind === "camera" ? { video: true } : { audio: true },
        );
        stream.getTracks().forEach((track) => track.stop());
        return "granted";
      }
      case "location":
        return await new Promise((resolve) =>
          navigator.geolocation.getCurrentPosition(
            () => resolve("granted"),
            (error) => resolve(error.code === error.PERMISSION_DENIED ? "denied" : "notDetermined"),
          ),
        );
      case "notifications":
        return fromBrowser(await Notification.requestPermission());
      case "photos":
        return "granted";
    }
  } catch {
    return "denied";
  }
};

const STATUS_TITLES: Record<PermissionStatus, string> = {
  notDetermined: "Not asked yet",
  granted: "Allowed",
  limited: "Limited",
  denied: "Denied",
  restricted: "Restricted",
};

/**
 * The button a permission row ends in: Allow while iOS has not asked yet, the
 * answer once it has, and Settings when it was denied. It reports what iOS
 * holds. Its web version asks the browser. Register it with
 * `NativeIslandsComponents.register()`.
 */
export const Permission = ({
  kind,
  label,
  tint,
  onStatus,
  children,
  accessibility,
  ...common
}: NativeCommonProps & {
  kind: PermissionKind;
  /** What is asked for, such as `Camera`. */
  label: string;
  tint?: string;
  onStatus?: (status: PermissionStatus) => void;
}) => {
  const [web, setWeb] = React.useState<PermissionStatus>("notDetermined");
  const [asking, setAsking] = React.useState(false);
  return (
    <NativePermission
      kind={kind}
      tint={tint}
      accessibility={accessibility ?? { label }}
      onStateChange={({ status }) => status && onStatus?.(status)}
      {...common}
    >
      {children ??
        (web === "notDetermined" ? (
          <button
            type="button"
            className="ni-glass ni-glass--pill ni-permission"
            data-prominent=""
            style={cssVariables({ "--ni-tint": tint })}
            aria-label={`Allow ${label}`}
            disabled={asking}
            onClick={() => {
              setAsking(true);
              void askBrowser(kind).then((status) => {
                setAsking(false);
                setWeb(status);
                onStatus?.(status);
              });
            }}
          >
            Allow
          </button>
        ) : (
          <span className="ni-permission-status" data-status={web}>
            {STATUS_TITLES[web]}
          </span>
        ))}
    </NativePermission>
  );
};

export type TipHandle = { invalidate: () => void };

type TipCommands = { invalidate: { args: undefined; result: void } };

/**
 * A TipKit tip: a title, a message and buttons, with a close button.
 * TipKit remembers by `id` that it was closed, across launches. Its web
 * version sets its size, so keep it the size of TipKit's card; once TipKit
 * stops showing the tip, or the web card is closed, it collapses and takes no
 * room. Needs iOS 17; before, the web version shows.
 */
export const Tip = ({
  id,
  title,
  message,
  systemImage,
  icon,
  actions,
  arrowEdge,
  tint,
  background,
  onAction,
  onDismiss,
  handle,
  children,
  accessibility,
  ...common
}: NativeCommonProps & {
  id: string;
  title: string;
  message?: string;
  systemImage?: string;
  /** The web version's drawing of `systemImage`. */
  icon?: React.ReactNode;
  actions?: readonly TipAction[];
  /** Draws an arrow on this edge, pointing at what the tip is about. */
  arrowEdge?: TipArrowEdge;
  tint?: string;
  /** The tip's fill; an opaque card colour by default, as on a grouped page. */
  background?: string;
  onAction?: (id: string) => void;
  onDismiss?: () => void;
  /** `invalidate()` closes the tip for good, such as once its feature is used. */
  handle?: React.Ref<TipHandle>;
}) => {
  const island = React.useRef<NativeHandle<TipCommands>>(null);
  const [closed, setClosed] = React.useState(false);
  const [shown, setShown] = React.useState(true);
  React.useImperativeHandle(
    handle,
    () => ({
      invalidate: () => {
        setClosed(true);
        void island.current?.command("invalidate").catch(() => {});
      },
    }),
    [],
  );
  const close = () => {
    setClosed(true);
    onDismiss?.();
  };
  return (
    <NativeTip
      ref={island}
      id={id}
      title={title}
      message={message}
      systemImage={systemImage}
      actions={actions}
      arrowEdge={arrowEdge}
      tint={tint}
      background={background}
      accessibility={accessibility ?? { label: title }}
      onAction={({ id: action }) => onAction?.(action)}
      onDismiss={onDismiss}
      onStateChange={(state) => setShown(state.shown !== false)}
      {...common}
    >
      {children ??
        (closed || !shown ? null : (
          <aside
            className="ni-tip"
            data-arrow={arrowEdge}
            style={cssVariables({ "--ni-tint": tint })}
          >
            {icon && <span className="ni-tip-icon">{icon}</span>}
            <div className="ni-tip-body">
              <strong className="ni-tip-title">{title}</strong>
              {message && <p className="ni-tip-message">{message}</p>}
              {actions && actions.length > 0 && (
                <div className="ni-tip-actions">
                  {actions.map((action) => (
                    <button key={action.id} type="button" onClick={() => onAction?.(action.id)}>
                      {action.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="ni-tip-close" aria-label="Close" onClick={close}>
              <Glyph name="xmark" />
            </button>
          </aside>
        ))}
    </NativeTip>
  );
};
