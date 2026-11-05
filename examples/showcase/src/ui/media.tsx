import * as React from "react";
import {
  Camera as PackageCamera,
  PhotoPicker,
  Video as PackageVideo,
  type CameraHandle,
  type CameraState,
  type VideoHandle,
  type VideoStatus,
} from "native-islands/components";
import { useScreenShowing } from "../app/nav";
import { useAccent, useNativeEnabled } from "../app/preferences";
import { WebSymbol } from "./icons";

export type { CameraHandle, VideoHandle };

/** A video played by AVFoundation; it pauses when its screen is hidden, unless in Picture in Picture. */
export const Video = ({
  onStatus,
  handle,
  ...props
}: {
  url: string;
  webUrl?: string;
  poster?: string;
  onStatus: (status: VideoStatus) => void;
  handle?: React.Ref<VideoHandle>;
}) => {
  const player = React.useRef<VideoHandle>(null);
  const latest = React.useRef<VideoStatus | undefined>(undefined);
  const showing = useScreenShowing();
  React.useImperativeHandle(handle, () => ({
    play: () => player.current?.play(),
    pause: () => player.current?.pause(),
    pictureInPicture: () => player.current?.pictureInPicture(),
  }));
  React.useEffect(() => {
    const status = latest.current;
    if (showing || !status?.playing || status.pictureInPicture) return;
    player.current?.pause();
  }, [showing]);
  return (
    <PackageVideo
      {...props}
      handle={player}
      native={useNativeEnabled()}
      onStatus={(status) => {
        latest.current = status;
        onStatus(status);
      }}
    />
  );
};

/** The live camera, running only while its screen shows. */
export const Camera = (props: {
  position: "back" | "front";
  onStatus: (state: CameraState) => void;
  handle?: React.Ref<CameraHandle>;
}) => <PackageCamera {...props} running={useScreenShowing()} native={useNativeEnabled()} />;

/** A glass button that opens the system photo picker. */
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
}) => (
  <PhotoPicker
    title={title}
    systemImage={symbol}
    icon={symbol && <WebSymbol name={symbol} />}
    limit={limit}
    prominence="prominent"
    tint={useAccent()}
    native={useNativeEnabled()}
    onPick={onPick}
  />
);
