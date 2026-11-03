import * as React from "react";
import { useAccent, useNativeEnabled } from "../app/preferences";
import {
  NativeHapticButton,
  NativePermission,
  NativeShareButton,
  type HapticFeedback,
  type PermissionKind,
  type PermissionStatus,
} from "../islands/definitions";
import { STATUS_TITLES, fromBrowser } from "./capabilities";
import { WebSymbol } from "./icons";

/** Asks the browser for what the native permission stands for, where it can. */
const askBrowser = async (kind: PermissionKind): Promise<PermissionStatus> => {
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

/**
 * The button a permission row ends in. Natively it shows the real system
 * prompt and reports what iOS holds; its web version asks the browser.
 */
export const PermissionButton = ({
  kind,
  label,
  onStatus,
}: {
  kind: PermissionKind;
  label: string;
  onStatus: (status: PermissionStatus) => void;
}) => {
  const [web, setWeb] = React.useState<PermissionStatus>("notDetermined");
  const [asking, setAsking] = React.useState(false);
  return (
    <NativePermission
      kind={kind}
      tint={useAccent()}
      native={useNativeEnabled()}
      accessibility={{ label }}
      onStateChange={({ status }) => status && onStatus(status)}
    >
      {web === "notDetermined" ? (
        <button
          type="button"
          className="glass-pill permission-allow"
          data-prominent
          aria-label={`Allow ${label}`}
          disabled={asking}
          onClick={() => {
            setAsking(true);
            void askBrowser(kind).then((status) => {
              setAsking(false);
              setWeb(status);
              onStatus(status);
            });
          }}
        >
          Allow
        </button>
      ) : (
        <span className="permission-status" data-status={web}>
          {STATUS_TITLES[web]}
        </span>
      )}
    </NativePermission>
  );
};

/** A glass button that plays haptic feedback natively; a browser can only try to vibrate. */
export const HapticButton = ({
  title,
  feedback,
  onPress,
}: {
  title: string;
  feedback: HapticFeedback;
  onPress: () => void;
}) => (
  <NativeHapticButton
    title={title}
    feedback={feedback}
    native={useNativeEnabled()}
    accessibility={{ label: title }}
    onPress={onPress}
  >
    <button
      type="button"
      className="glass-pill"
      onClick={() => {
        navigator.vibrate?.(feedback === "heavy" || feedback === "error" ? 30 : 10);
        onPress();
      }}
    >
      {title}
    </button>
  </NativeHapticButton>
);

/** A glass button for the system share sheet; its web version uses the Web Share API. */
export const ShareButton = ({
  title,
  text,
  url,
  onComplete,
}: {
  title: string;
  text: string;
  url: string;
  onComplete: (activity: string | null) => void;
}) => {
  const accent = useAccent();
  return (
    <NativeShareButton
      title={title}
      systemImage="square.and.arrow.up"
      text={text}
      url={url}
      prominence="prominent"
      tint={accent}
      native={useNativeEnabled()}
      accessibility={{ label: title }}
      onComplete={({ activity }) => onComplete(activity)}
    >
      <button
        type="button"
        className="glass-pill"
        data-prominent=""
        onClick={() => {
          if (!navigator.share) {
            void navigator.clipboard?.writeText(`${text} ${url}`).then(
              () => onComplete("CopyToPasteboard"),
              () => onComplete(null),
            );
            return;
          }
          navigator.share({ text, url }).then(
            () => onComplete("done"),
            () => onComplete(null),
          );
        }}
      >
        <WebSymbol name="square.and.arrow.up" className="bar-symbol" />
        {title}
      </button>
    </NativeShareButton>
  );
};
