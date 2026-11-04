import type { NativeHandle } from "native-islands/react";
import { useNativeSupport } from "native-islands/react";
import * as React from "react";
import { useScreenShowing } from "../app/nav";
import { useAccent, useNativeEnabled } from "../app/preferences";
import {
  NativeCamera,
  NativePhotoPicker,
  NativeVideo,
  type CameraState,
  type VideoStatus,
} from "../islands/definitions";
import { WebSymbol } from "./icons";

/** Whether an island is drawn natively here, so its web version can stay idle. */
const useDrawnNatively = (component: string): boolean =>
  useNativeSupport(component) === "supported" && useNativeEnabled();

type VideoCommands = {
  play: { args: undefined; result: void };
  pause: { args: undefined; result: void };
  pictureInPicture: { args: undefined; result: void };
};

export type VideoHandle = { play: () => void; pause: () => void; pictureInPicture: () => void };

/**
 * A video played by AVFoundation, with Picture in Picture. Its web version is
 * a `<video>` element, which reports the same status.
 */
export const Video = ({
  url,
  webUrl,
  poster,
  onStatus,
  handle,
}: {
  /** An HLS stream, which AVFoundation and Safari play. */
  url: string;
  /** A WebM copy for browsers that cannot play HLS, such as Chrome and Firefox. */
  webUrl?: string;
  poster?: string;
  onStatus: (status: VideoStatus) => void;
  handle?: React.Ref<VideoHandle>;
}) => {
  const island = React.useRef<NativeHandle<VideoCommands>>(null);
  const video = React.useRef<HTMLVideoElement>(null);
  const native = useDrawnNatively("video");
  const showing = useScreenShowing();
  const latest = React.useRef<VideoStatus | undefined>(undefined);
  const report = (status: VideoStatus) => {
    latest.current = status;
    onStatus(status);
  };
  React.useImperativeHandle(handle, () => {
    const send = (name: keyof VideoCommands) => {
      if (native && island.current) {
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
  }, [native]);
  React.useEffect(() => {
    const status = latest.current;
    if (showing || !status?.playing || status.pictureInPicture) return;
    if (native) void island.current?.command("pause").catch(() => {});
    else video.current?.pause();
  }, [showing, native]);
  const reportElement = () => {
    const element = video.current;
    if (native || !element) return;
    report({
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
      native={useNativeEnabled()}
      accessibility={{ label: "Video" }}
      onStatus={report}
    >
      <video
        ref={video}
        className="web-video"
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
        {webUrl && <source src={webUrl} type="video/webm" />}
      </video>
    </NativeVideo>
  );
};

export type CameraHandle = { capture: () => Promise<string | null> };

/**
 * The live camera from AVFoundation. Its web version asks the browser for the
 * camera, and only when the native one is not drawn, so there is never two.
 */
export const Camera = ({
  position,
  onStatus,
  handle,
}: {
  position: "back" | "front";
  onStatus: (state: CameraState) => void;
  handle?: React.Ref<CameraHandle>;
}) => {
  const island =
    React.useRef<NativeHandle<{ capture: { args: undefined; result: { image: string } } }>>(null);
  const video = React.useRef<HTMLVideoElement>(null);
  const native = useDrawnNatively("camera");
  const running = useScreenShowing();
  React.useEffect(() => {
    const element = video.current;
    if (native || !running || !element) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      onStatus("unavailable");
      return;
    }
    let stream: MediaStream | undefined;
    let cancelled = false;
    onStatus("starting");
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: position === "front" ? "user" : "environment" } })
      .then((next) => {
        if (cancelled) return next.getTracks().forEach((track) => track.stop());
        stream = next;
        element.srcObject = next;
        onStatus("running");
      })
      .catch((error: unknown) =>
        onStatus(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "denied"
            : "unavailable",
        ),
      );
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [native, running, position, onStatus]);
  React.useImperativeHandle(
    handle,
    () => ({
      capture: async () => {
        if (native && island.current) {
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
    [native],
  );
  return (
    <NativeCamera
      ref={island}
      position={position}
      running={running}
      native={useNativeEnabled()}
      accessibility={{ label: "Camera" }}
      onStatus={({ state }) => onStatus(state)}
    >
      {native ? (
        <div className="web-camera" />
      ) : (
        <video ref={video} className="web-camera" autoPlay muted playsInline />
      )}
    </NativeCamera>
  );
};

const readAsDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });

/**
 * A glass button that opens the system photo picker. Its web version is a
 * file input, which hands back the same data URLs.
 */
export const PhotoPickerButton = ({
  title,
  symbol,
  limit,
  onPick,
}: {
  title: string;
  symbol?: string;
  limit: number;
  onPick: (images: readonly string[]) => void;
}) => {
  const accent = useAccent();
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <NativePhotoPicker
      title={title}
      systemImage={symbol}
      limit={limit}
      prominence="prominent"
      tint={accent}
      native={useNativeEnabled()}
      accessibility={{ label: title }}
      onPick={({ images }) => onPick(images)}
    >
      <button
        type="button"
        className="glass-pill"
        data-prominent=""
        onClick={() => input.current?.click()}
      >
        {symbol && <WebSymbol name={symbol} className="bar-symbol" />}
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
    </NativePhotoPicker>
  );
};
