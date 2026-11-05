import type { MenuItem } from "native-islands/components";
import { defineNativeComponent } from "native-islands/react";

/**
 * The Islands app's own native components, by the names in
 * `examples/ios/Islands/Components/ShowcaseComponents.swift`. The common
 * controls come from `native-islands/components`.
 */

type GlassGroup = { glassGroup?: string };

export const NativeSearchTab = defineNativeComponent<{
  props: GlassGroup & { selected: boolean; tint?: string };
  events: { press: undefined };
}>("searchTab", { colorProps: ["tint"] });

export const NativeTabBar = defineNativeComponent<{
  props: GlassGroup & {
    titles: readonly string[];
    symbols: readonly string[];
    selectedIndex: number;
    tint?: string;
  };
  events: { select: { index: number } };
}>("tabBar", { colorProps: ["tint"] });

/**
 * The navigation bar over every screen, drawn natively so it stays put as
 * screens slide under it: Back while the stack can go back, the inline
 * title, and a menu of `items`.
 */
export const NativeNavigationBar = defineNativeComponent<{
  props: {
    title: string;
    titleShown: boolean;
    showsBack: boolean;
    systemImage: string;
    menuLabel: string;
    items: readonly MenuItem[];
  };
  events: { back: undefined; select: { id: string } };
}>("navigationBar");

export type ChartKind = "bar" | "line" | "area";

export type ChartPoint = { label: string; value: number };

export const NativeChart = defineNativeComponent<{
  props: { kind: ChartKind; points: readonly ChartPoint[]; tint?: string };
  events: { select: { label: string | null } };
}>("chart", { colorProps: ["tint"] });

export type MapStyle = "standard" | "hybrid" | "imagery";

export type MapPlace = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  symbol?: string;
};

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export const NativeMap = defineNativeComponent<{
  props: {
    places: readonly MapPlace[];
    style: MapStyle;
    realistic?: boolean;
    showsUser?: boolean;
    selectedId?: string;
    tint?: string;
  };
  events: { select: { id: string | null }; regionChange: MapRegion };
}>("map", { colorProps: ["tint"] });

export type VideoStatus = {
  playing: boolean;
  time: number;
  duration: number;
  pictureInPicture: boolean;
};

export const NativeVideo = defineNativeComponent<{
  props: { url: string };
  events: { status: VideoStatus };
  commands: {
    play: { args: undefined; result: void };
    pause: { args: undefined; result: void };
    pictureInPicture: { args: undefined; result: void };
  };
}>("video");

export type CameraState = "starting" | "running" | "unavailable" | "denied";

export const NativeCamera = defineNativeComponent<{
  /** The camera runs only while `running`, so a hidden screen holds no camera. */
  props: { position: "back" | "front"; running: boolean };
  events: { status: { state: CameraState } };
  /** A photo of the live camera as a JPEG data URL. */
  commands: { capture: { args: undefined; result: { image: string } } };
}>("camera");

type ActionButton = GlassGroup & {
  title?: string;
  systemImage?: string;
  prominence?: "regular" | "prominent";
  tint?: string;
};

export const NativePhotoPicker = defineNativeComponent<{
  props: ActionButton & { limit: number };
  /** The photos chosen, in order, as JPEG data URLs. */
  events: { pick: { images: readonly string[] } };
}>("photoPicker", { colorProps: ["tint"] });

export type PermissionKind = "camera" | "microphone" | "location" | "photos" | "notifications";

export type PermissionStatus = "notDetermined" | "granted" | "limited" | "denied" | "restricted";

/** Sized by its native view: Allow, Settings and Allowed differ in width. */
export const NativePermission = defineNativeComponent<{
  props: { kind: PermissionKind; tint?: string };
  state: { status: PermissionStatus };
}>("permission", { sizing: "native", colorProps: ["tint"] });

export type HapticFeedback =
  | "light"
  | "medium"
  | "heavy"
  | "soft"
  | "rigid"
  | "success"
  | "warning"
  | "error"
  | "selection";

export const NativeHapticButton = defineNativeComponent<{
  props: ActionButton & { feedback: HapticFeedback };
  events: { press: undefined };
}>("hapticButton", { colorProps: ["tint"] });

export const NativeShareButton = defineNativeComponent<{
  props: ActionButton & { text?: string; url?: string };
  /** The activity chosen, such as `com.apple.UIKit.activity.CopyToPasteboard`, or null if cancelled. */
  events: { complete: { activity: string | null } };
}>("shareButton", { colorProps: ["tint"] });

export const NativeSearchField = defineNativeComponent<{
  props: { text: string; placeholder?: string; tint?: string };
  events: { submit: { text: string } };
  state: { text: string };
  commands: { focus: { args: undefined; result: void }; blur: { args: undefined; result: void } };
}>("searchField", { colorProps: ["tint"] });
