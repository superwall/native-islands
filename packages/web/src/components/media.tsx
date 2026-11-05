import * as React from "react";
import type { NativeCommonProps, NativeHandle } from "../react/components/Native";
import { useNativeSupport } from "../react/hooks/useNativeSupport";
import { cssVariables, projectPlaces } from "./geometry";
import {
  NativeCamera,
  NativeMap,
  NativePhotoPicker,
  NativeVideo,
  type CameraState,
  type MapPlace,
  type MapRegion,
  type MapStyle,
  type Prominence,
  type VideoCommands,
  type VideoStatus,
} from "./specs";

/**
 * The islands for maps and media. Each takes the box its parent gives it:
 * set the parent's size, such as `aspect-ratio: 16 / 9`, and its web version
 * fills it.
 */

/** Whether `component` is drawn natively here, so its web version can stay idle. */
const useDrawnNatively = (component: string, native: boolean | undefined): boolean =>
  useNativeSupport(component) === "supported" && native !== false;

/**
 * A MapKit map of `places`. Tapping a marker selects it; selecting one from
 * the page flies the map there. Its web version draws the same pins on a
 * plain map, since a page has no map of its own. Register it with
 * `NativeIslandsMaps.register()`.
 */
export const MapView = ({
  places,
  style = "standard",
  realistic,
  showsUser,
  selectedId,
  tint,
  pinIcon,
  onSelect,
  onRegionChange,
  children,
  accessibility,
  ...common
}: NativeCommonProps & {
  places: readonly MapPlace[];
  style?: MapStyle;
  /** Raised terrain and buildings. */
  realistic?: boolean;
  /** Shows the user, asking for location the first time. */
  showsUser?: boolean;
  selectedId?: string;
  tint?: string;
  /** The web version's drawing of a place's `symbol`. */
  pinIcon?: (place: MapPlace) => React.ReactNode;
  onSelect?: (id: string | null) => void;
  onRegionChange?: (region: MapRegion) => void;
}) => {
  const spots = projectPlaces(places);
  return (
    <NativeMap
      places={places}
      style={style}
      realistic={realistic}
      showsUser={showsUser}
      selectedId={selectedId}
      tint={tint}
      accessibility={accessibility ?? { label: "Map" }}
      onSelect={({ id }) => onSelect?.(id)}
      onRegionChange={onRegionChange}
      {...common}
    >
      {children ?? (
        <div className="ni-map" data-style={style} style={cssVariables({ "--ni-tint": tint })}>
          {places.map((place, index) => {
            const spot = spots[index];
            return (
              spot && (
                <button
                  key={place.id}
                  type="button"
                  className="ni-map-pin"
                  style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                  aria-pressed={place.id === selectedId}
                  onClick={() => onSelect?.(place.id)}
                >
                  <span className="ni-map-marker">{pinIcon?.(place)}</span>
                  <span className="ni-map-title">{place.title}</span>
                </button>
              )
            );
          })}
        </div>
      )}
    </NativeMap>
  );
};

export type VideoHandle = { play: () => void; pause: () => void; pictureInPicture: () => void };

/**
 * A video played by AVFoundation, with native controls and Picture in
 * Picture. Its web version is a `<video>` element that reports the same
 * status. Drive either through `handle`.
 */
export const Video = ({
  url,
  webUrl,
  webType = "video/webm",
  poster,
  onStatus,
  handle,
  children,
  accessibility,
  native,
  ...common
}: NativeCommonProps & {
  /** What AVFoundation plays, such as an HLS stream; Safari plays it too. */
  url: string;
  /** A copy for browsers that cannot play `url`, such as WebM for Chrome and Firefox. */
  webUrl?: string;
  /** A video MIME type for `webUrl`. Defaults to `video/webm`. */
  webType?: string;
  poster?: string;
  onStatus?: (status: VideoStatus) => void;
  handle?: React.Ref<VideoHandle>;
}) => {
  const island = React.useRef<NativeHandle<VideoCommands>>(null);
  const video = React.useRef<HTMLVideoElement>(null);
  const drawn = useDrawnNatively("video", native);
  React.useImperativeHandle(handle, () => {
    const send = (name: keyof VideoCommands) => {
      if (drawn && island.current) {
        void island.current.command(name).catch(() => {});
        return;
      }
      const element = video.current;
      if (!element) return;
      if (name === "play") void element.play().catch(() => {});
      else if (name === "pause") element.pause();
      else if (document.pictureInPictureElement) void document.exitPictureInPicture();
      else void element.requestPictureInPicture?.().catch(() => {});
    };
    return {
      play: () => send("play"),
      pause: () => send("pause"),
      pictureInPicture: () => send("pictureInPicture"),
    };
  }, [drawn]);
  const reportElement = () => {
    const element = video.current;
    if (drawn || !element) return;
    onStatus?.({
      playing: !element.paused,
      time: Math.floor(element.currentTime),
      duration: Number.isFinite(element.duration) ? Math.floor(element.duration) : 0,
      pictureInPicture: document.pictureInPictureElement === element,
    });
  };
  return (
    <NativeVideo
      ref={island}
      url={url}
      native={native}
      accessibility={accessibility ?? { label: "Video" }}
      onStatus={onStatus}
      {...common}
    >
      {children ?? (
        <video
          ref={video}
          className="ni-video"
          poster={poster}
          controls
          playsInline
          preload="metadata"
          onPlay={reportElement}
          onPause={reportElement}
          onTimeUpdate={reportElement}
          onLoadedMetadata={reportElement}
        >
          <source src={url} type="application/vnd.apple.mpegurl" />
          {webUrl && <source src={webUrl} type={webType} />}
        </video>
      )}
    </NativeVideo>
  );
};

export type CameraHandle = { capture: () => Promise<string | null> };

type CameraCommands = { capture: { args: undefined; result: { image: string } } };

/** What a failed `getUserMedia` means for the camera. */
export const cameraStateOf = (error: unknown): CameraState =>
  error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "unavailable";

/**
 * The live camera from AVFoundation, while `running`. Its web version asks
 * the browser for the camera, and only when the native one is not drawn, so
 * there are never two. Register it with `NativeIslandsComponents.register()`.
 */
export const Camera = ({
  position = "back",
  running = true,
  onStatus,
  handle,
  children,
  accessibility,
  native,
  ...common
}: NativeCommonProps & {
  position?: "back" | "front";
  /** Stop it while its screen is hidden, so it holds no camera. */
  running?: boolean;
  onStatus?: (state: CameraState) => void;
  /** `capture()` answers with a JPEG data URL of the live camera, or null. */
  handle?: React.Ref<CameraHandle>;
}) => {
  const island = React.useRef<NativeHandle<CameraCommands>>(null);
  const video = React.useRef<HTMLVideoElement>(null);
  const drawn = useDrawnNatively("camera", native);
  const status = React.useRef(onStatus);
  status.current = onStatus;
  React.useEffect(() => {
    const element = video.current;
    const report = (state: CameraState) => status.current?.(state);
    if (drawn || !running || !element || children) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      report("unavailable");
      return;
    }
    let stream: MediaStream | undefined;
    let cancelled = false;
    report("starting");
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: position === "front" ? "user" : "environment" } })
      .then((next) => {
        if (cancelled) return next.getTracks().forEach((track) => track.stop());
        stream = next;
        element.srcObject = next;
        report("running");
      })
      .catch((error: unknown) => report(cameraStateOf(error)));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [drawn, running, position, children]);
  React.useImperativeHandle(
    handle,
    () => ({
      capture: async () => {
        if (drawn && island.current) {
          const { image } = await island.current.command("capture", undefined, {
            timeoutMs: 8000,
          });
          return image || null;
        }
        const element = video.current;
        if (!element || element.videoWidth === 0) return null;
        const canvas = document.createElement("canvas");
        const scale = Math.min(720 / Math.max(element.videoWidth, element.videoHeight), 1);
        canvas.width = element.videoWidth * scale;
        canvas.height = element.videoHeight * scale;
        canvas.getContext("2d")?.drawImage(element, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.8);
      },
    }),
    [drawn],
  );
  return (
    <NativeCamera
      ref={island}
      position={position}
      running={running}
      native={native}
      accessibility={accessibility ?? { label: "Camera" }}
      onStatus={({ state }) => onStatus?.(state)}
      {...common}
    >
      {children ??
        (drawn ? (
          <div className="ni-camera" />
        ) : (
          <video ref={video} className="ni-camera" autoPlay muted playsInline />
        ))}
    </NativeCamera>
  );
};

/** A file's contents as a data URL. */
export const readAsDataURL = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });

/**
 * A glass button that opens the system photo picker, which needs no
 * permission, and hands back the photos chosen as JPEG data URLs. Its web
 * version is a file input that hands back the same.
 */
export const PhotoPicker = ({
  title,
  systemImage,
  icon,
  limit = 1,
  prominence = "regular",
  tint,
  glassGroup,
  onPick,
  children,
  accessibility,
  ...common
}: NativeCommonProps & {
  title?: string;
  systemImage?: string;
  /** The web version's drawing of `systemImage`. */
  icon?: React.ReactNode;
  /** How many photos a person may choose. */
  limit?: number;
  prominence?: Prominence;
  tint?: string;
  glassGroup?: string;
  onPick: (images: readonly string[]) => void;
}) => {
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <NativePhotoPicker
      title={title}
      systemImage={systemImage}
      limit={limit}
      prominence={prominence}
      tint={tint}
      glassGroup={glassGroup}
      accessibility={accessibility ?? (title === undefined ? undefined : { label: title })}
      onPick={({ images }) => onPick(images)}
      {...common}
    >
      {children ?? (
        <>
          <button
            type="button"
            className="ni-glass ni-glass--pill"
            data-prominent={prominence === "prominent" ? "" : undefined}
            style={cssVariables({ "--ni-tint": tint })}
            onClick={() => input.current?.click()}
          >
            {icon && <span className="ni-icon">{icon}</span>}
            {title}
          </button>
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple={limit > 1}
            hidden
            onChange={(event) => {
              const files = [...(event.target.files ?? [])].slice(0, limit);
              event.target.value = "";
              void Promise.all(files.map(readAsDataURL)).then(onPick, () => {});
            }}
          />
        </>
      )}
    </NativePhotoPicker>
  );
};
