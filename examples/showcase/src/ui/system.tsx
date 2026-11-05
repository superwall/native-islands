import {
  HapticButton as PackageHapticButton,
  Permission,
  ShareButton as PackageShareButton,
  Tip,
  type TipAction,
  type HapticFeedback,
  type PermissionKind,
  type PermissionStatus,
} from "native-islands/components";
import { useAccent, useNativeEnabled } from "../app/preferences";
import { WebSymbol } from "./icons";

/** The button a permission row ends in, with the real iOS prompt. */
export const PermissionButton = (props: {
  kind: PermissionKind;
  label: string;
  onStatus: (status: PermissionStatus) => void;
}) => <Permission {...props} tint={useAccent()} native={useNativeEnabled()} />;

/** A glass button that plays haptic feedback natively; a browser can only try to vibrate. */
export const HapticButton = (props: {
  title: string;
  feedback: HapticFeedback;
  onPress: () => void;
}) => <PackageHapticButton {...props} native={useNativeEnabled()} />;

/** A glass button for the system share sheet. */
export const ShareButton = (props: {
  title: string;
  text: string;
  url: string;
  onComplete: (activity: string | null) => void;
}) => (
  <PackageShareButton
    {...props}
    icon={<WebSymbol name="square.and.arrow.up" />}
    prominence="prominent"
    tint={useAccent()}
    native={useNativeEnabled()}
  />
);

/** A TipKit tip in the app's accent; its web version is a card. */
export const TipCard = ({
  symbol,
  ...props
}: {
  id: string;
  title: string;
  message: string;
  symbol: string;
  actions: readonly TipAction[];
  onAction: (id: string) => void;
  onDismiss: () => void;
}) => (
  <Tip
    {...props}
    systemImage={symbol}
    icon={<WebSymbol name={symbol} />}
    tint={useAccent()}
    native={useNativeEnabled()}
  />
);
