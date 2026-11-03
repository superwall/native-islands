import * as React from "react";
import { demoScreens, type ScreenSpec } from "../../app/nav";
import type { CameraState, VideoStatus } from "../../islands/definitions";
import { formatClock } from "../../ui/capabilities";
import { Button, Segmented } from "../../ui/controls";
import { Readout, Section } from "../../ui/List";
import {
  Camera,
  PhotoPickerButton,
  Video,
  type CameraHandle,
  type VideoHandle,
} from "../../ui/media";

/** Apple's HLS sample stream, which AVFoundation and Safari both play. */
export const VIDEO_URL =
  "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8";

/** A WebM clip for the web version in browsers without HLS. */
export const WEB_VIDEO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.480p.vp9.webm";

const STOPPED: VideoStatus = { playing: false, time: 0, duration: 0, pictureInPicture: false };

const VideoDemo = () => {
  const [status, setStatus] = React.useState(STOPPED);
  const player = React.useRef<VideoHandle>(null);
  return (
    <>
      <div className="nav-gap" />
      <div className="media-card media-card--video">
        <Video url={VIDEO_URL} webUrl={WEB_VIDEO_URL} onStatus={setStatus} handle={player} />
      </div>
      <p className="list-footer">
        AVFoundation plays it, with Picture in Picture that carries on over other apps. Its controls
        are native glass; the page can drive it too.
      </p>
      <Section header="From the page">
        <div className="row row--centered">
          <div className="stage-row">
            <Button
              title={status.playing ? "Pause" : "Play"}
              symbol={status.playing ? "pause.fill" : "play.fill"}
              prominent
              onPress={() => (status.playing ? player.current?.pause() : player.current?.play())}
            />
            <Button
              title="Picture in Picture"
              symbol="pip.enter"
              onPress={() => player.current?.pictureInPicture()}
            />
          </div>
        </div>
      </Section>
      <Section header="Page sees">
        <Readout title="State" value={status.playing ? "Playing" : "Paused"} />
        <Readout
          title="Position"
          value={`${formatClock(status.time)} / ${formatClock(status.duration)}`}
        />
        <Readout title="Picture in Picture" value={status.pictureInPicture ? "On" : "Off"} />
      </Section>
    </>
  );
};

const CAMERA_STATES: Record<CameraState, string> = {
  starting: "Starting",
  running: "Live",
  unavailable: "No camera",
  denied: "Access denied",
};

const CameraDemo = () => {
  const [position, setPosition] = React.useState<"back" | "front">("back");
  const [state, setState] = React.useState<CameraState>("starting");
  const [photo, setPhoto] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  const camera = React.useRef<CameraHandle>(null);
  return (
    <>
      <div className="nav-gap" />
      <div className="media-card media-card--camera">
        <Camera position={position} onStatus={setState} handle={camera} />
      </div>
      <p className="list-footer">
        The live feed of AVFoundation, at the camera's frame rate, inside the page's layout.
      </p>
      <Section>
        <div className="row">
          <Segmented
            segments={["Back", "Front"]}
            selectedIndex={position === "back" ? 0 : 1}
            onChange={(index) => setPosition(index === 0 ? "back" : "front")}
          />
        </div>
        <div className="row row--centered">
          <Button
            title="Take Photo"
            symbol="camera.fill"
            prominent
            disabled={state !== "running"}
            onPress={() => {
              setFailed(false);
              void camera.current
                ?.capture()
                .then((image) => (image ? setPhoto(image) : setFailed(true)))
                .catch(() => setFailed(true));
            }}
          />
        </div>
      </Section>
      <Section header="Page sees">
        <Readout title="Camera" value={CAMERA_STATES[state]} />
        {photo ? (
          <div className="row photo-row">
            <img className="photo-captured" src={photo} alt="The photo taken" />
          </div>
        ) : (
          <Readout title="Photo" value={failed ? "Could not take one" : "none yet"} />
        )}
      </Section>
    </>
  );
};

const PhotosDemo = () => {
  const [images, setImages] = React.useState<readonly string[]>([]);
  return (
    <>
      <div className="nav-gap" />
      <div className="stage">
        <div className="stage-row">
          <PhotoPickerButton
            title="Choose Photos"
            symbol="photo.on.rectangle"
            limit={6}
            onPick={setImages}
          />
        </div>
      </div>
      <p className="list-footer">
        The system photo picker runs outside the app, so it needs no permission. The photos it hands
        back are plain images in the page.
      </p>
      <Section header={images.length ? `${images.length} chosen` : "Page sees"}>
        {images.length ? (
          <div className="row photo-grid">
            {images.map((image, index) => (
              <img key={index} className="photo-tile" src={image} alt={`Photo ${index + 1}`} />
            ))}
          </div>
        ) : (
          <Readout title="Photos" value="none yet" />
        )}
      </Section>
    </>
  );
};

export const mediaScreens: ScreenSpec[] = demoScreens("capabilities", "Media", [
  {
    id: "video",
    keywords: ["AVKit", "player", "Picture in Picture", "PiP", "stream"],
    title: "Video",
    symbol: "play.rectangle.fill",
    Component: VideoDemo,
  },
  {
    id: "camera",
    keywords: ["AVFoundation", "capture", "preview"],
    title: "Camera",
    symbol: "camera.fill",
    Component: CameraDemo,
  },
  {
    id: "photos",
    keywords: ["PhotosUI", "library", "images", "gallery"],
    title: "Photo Picker",
    symbol: "photo.on.rectangle",
    Component: PhotosDemo,
  },
]);
