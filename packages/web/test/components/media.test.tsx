import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import {
  Camera,
  MapView,
  PhotoPicker,
  Video,
  type CameraHandle,
  type MapPlace,
  type VideoHandle,
} from "../../src/components";
import { cameraStateOf, readAsDataURL } from "../../src/components/media";
import { removeCapability, renderNative } from "../support/react";
import { installComponents, mountComponent, replyTo } from "./support";

beforeEach(installComponents);

afterEach(() => {
  removeCapability();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const PLACES: MapPlace[] = [
  { id: "a", title: "North", latitude: 10, longitude: 0, symbol: "star" },
  { id: "b", title: "South", latitude: 0, longitude: 10 },
];

const renderWeb = (ui: React.ReactElement) => {
  removeCapability();
  return renderNative(ui);
};

describe("MapView", () => {
  it("sends its places natively and reports selection and region", async () => {
    const onSelect = vi.fn();
    const onRegionChange = vi.fn();
    const view = await mountComponent(
      <MapView
        places={PLACES}
        selectedId="a"
        showsUser
        realistic
        tint="red"
        onSelect={onSelect}
        onRegionChange={onRegionChange}
      />,
    );
    expect(view.mount).toMatchObject({
      component: "map",
      props: { places: PLACES, style: "standard", selectedId: "a", showsUser: true },
      accessibility: { label: "Map" },
    });
    view.event("select", { id: null });
    const region = { latitude: 1, longitude: 2, latitudeDelta: 3, longitudeDelta: 4 };
    view.event("regionChange", region);
    expect(onSelect).toHaveBeenCalledWith(null);
    expect(onRegionChange).toHaveBeenCalledWith(region);
  });

  it("draws the same pins in its web version, with the page's icons", () => {
    const onSelect = vi.fn();
    const view = renderWeb(
      <MapView
        places={PLACES}
        style="hybrid"
        selectedId="b"
        pinIcon={(place) => <i data-testid={`icon-${place.id}`} />}
        onSelect={onSelect}
      />,
    );
    expect(view.container.querySelector(".ni-map")?.getAttribute("data-style")).toBe("hybrid");
    const north = screen.getByRole("button", { name: "North" });
    expect(north.style.left).toBe("15%");
    expect(north.style.top).toBe("15%");
    expect(screen.getByRole("button", { name: "South" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("icon-a")).toBeTruthy();
    fireEvent.click(north);
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("works without handlers and takes its own web version", () => {
    renderWeb(<MapView places={PLACES} />);
    fireEvent.click(screen.getByRole("button", { name: "North" }));
    const own = renderWeb(
      <MapView places={[]}>
        <p>No map</p>
      </MapView>,
    );
    expect(own.container.textContent).toBe("No map");
  });
});

describe("Video", () => {
  it("is driven natively through its handle", async () => {
    const handle = React.createRef<VideoHandle>();
    const onStatus = vi.fn();
    const view = await mountComponent(
      <Video url="https://a.test/v.m3u8" handle={handle} onStatus={onStatus} />,
    );
    expect(view.mount).toMatchObject({
      component: "video",
      props: { url: "https://a.test/v.m3u8" },
    });
    const status = { playing: true, time: 3, duration: 9, pictureInPicture: false };
    view.event("status", status);
    expect(onStatus).toHaveBeenCalledWith(status);
    const element = view.container.querySelector("video");
    if (!element) throw new Error("No video.");
    fireEvent.timeUpdate(element);
    expect(onStatus).toHaveBeenCalledTimes(1);
    for (const name of ["play", "pause", "pictureInPicture"] as const) {
      await act(async () => handle.current?.[name]());
      await replyTo(view, name, { ok: false, error: "Not now." });
    }
    expect(
      view.outgoing.filter((message) => message.event_name === "native_component_command"),
    ).toHaveLength(3);
  });

  it("drives and reports its web <video> instead", async () => {
    const handle = React.createRef<VideoHandle>();
    const onStatus = vi.fn();
    const view = renderWeb(
      <Video
        url="https://a.test/v.m3u8"
        webUrl="https://a.test/v.webm"
        poster="p.jpg"
        handle={handle}
        onStatus={onStatus}
      />,
    );
    const video = view.container.querySelector("video");
    if (!video) throw new Error("No video.");
    expect(
      [...video.querySelectorAll("source")].map((source) => source.getAttribute("type")),
    ).toEqual(["application/vnd.apple.mpegurl", "video/webm"]);
    const play = vi.spyOn(video, "play").mockRejectedValue(new Error("No autoplay."));
    const pause = vi.spyOn(video, "pause").mockImplementation(() => {});
    const enter = vi.fn().mockRejectedValue(new Error("No PiP."));
    Object.assign(video, { requestPictureInPicture: enter });
    handle.current?.play();
    handle.current?.pause();
    handle.current?.pictureInPicture();
    expect(play).toHaveBeenCalled();
    expect(pause).toHaveBeenCalled();
    expect(enter).toHaveBeenCalled();
    const exit = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, "pictureInPictureElement", {
      configurable: true,
      value: video,
    });
    Object.assign(document, { exitPictureInPicture: exit });
    handle.current?.pictureInPicture();
    expect(exit).toHaveBeenCalled();
    Object.defineProperty(video, "duration", { configurable: true, value: 12.7 });
    Object.defineProperty(video, "currentTime", { configurable: true, value: 4.2 });
    fireEvent.timeUpdate(video);
    expect(onStatus).toHaveBeenLastCalledWith({
      playing: false,
      time: 4,
      duration: 12,
      pictureInPicture: true,
    });
    Object.defineProperty(video, "duration", { configurable: true, value: Number.NaN });
    fireEvent.loadedMetadata(video);
    expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ duration: 0 }));
    fireEvent.play(video);
    fireEvent.pause(video);
    Reflect.deleteProperty(document, "pictureInPictureElement");
  });

  it("does nothing without its element, and takes its own web version", async () => {
    const handle = React.createRef<VideoHandle>();
    const view = renderWeb(
      <Video url="u" handle={handle}>
        <p>Poster</p>
      </Video>,
    );
    handle.current?.play();
    expect(view.container.textContent).toBe("Poster");
    const bare = renderWeb(<Video url="u" />);
    const video = bare.container.querySelector("video");
    if (!video) throw new Error("No video.");
    expect(video.querySelectorAll("source")).toHaveLength(1);
    fireEvent.timeUpdate(video);
  });
});

const fakeStream = () => {
  const stop = vi.fn();
  return { stop, stream: { getTracks: () => [{ stop }] } };
};

describe("Camera", () => {
  it("runs natively, reports its state and captures through its handle", async () => {
    const handle = React.createRef<CameraHandle>();
    const onStatus = vi.fn();
    const view = await mountComponent(
      <Camera position="front" handle={handle} onStatus={onStatus} />,
    );
    expect(view.mount).toMatchObject({
      component: "camera",
      props: { position: "front", running: true },
    });
    expect(view.container.querySelector("div.ni-camera")).not.toBeNull();
    view.event("status", { state: "running" });
    expect(onStatus).toHaveBeenCalledWith("running");
    let photo: Promise<string | null> | undefined;
    await act(async () => {
      photo = handle.current?.capture();
    });
    await replyTo(view, "capture", { ok: true, value: { image: "data:image/jpeg;base64,AA" } });
    await expect(photo).resolves.toBe("data:image/jpeg;base64,AA");
    await act(async () => {
      photo = handle.current?.capture();
    });
    await replyTo(view, "capture", { ok: true, value: { image: "" } });
    await expect(photo).resolves.toBeNull();
  });

  it("asks the browser for the camera in its web version, and stops it when unmounted", async () => {
    const { stop, stream } = fakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia } });
    const onStatus = vi.fn();
    const view = renderWeb(<Camera onStatus={onStatus} />);
    await waitFor(() => expect(onStatus).toHaveBeenLastCalledWith("running"));
    expect(onStatus).toHaveBeenCalledWith("starting");
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: "environment" } });
    view.unmount();
    expect(stop).toHaveBeenCalled();
  });

  it("stops a stream that arrives after it is gone, and reports what the browser refused", async () => {
    const { stop, stream } = fakeStream();
    let resolve: (value: unknown) => void = () => {};
    const getUserMedia = vi.fn(() => new Promise((done) => (resolve = done)));
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia } });
    const late = renderWeb(<Camera position="front" />);
    late.unmount();
    await act(async () => resolve(stream));
    expect(stop).toHaveBeenCalled();
    const onStatus = vi.fn();
    getUserMedia.mockImplementation(() =>
      Promise.reject(new DOMException("No.", "NotAllowedError")),
    );
    renderWeb(<Camera onStatus={onStatus} />);
    await waitFor(() => expect(onStatus).toHaveBeenLastCalledWith("denied"));
  });

  it("is unavailable where the browser has no camera, and captures nothing", async () => {
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: undefined });
    const onStatus = vi.fn();
    const handle = React.createRef<CameraHandle>();
    renderWeb(<Camera onStatus={onStatus} handle={handle} />);
    expect(onStatus).toHaveBeenCalledWith("unavailable");
    await expect(handle.current?.capture()).resolves.toBeNull();
  });

  it("captures a frame of the web camera", async () => {
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: undefined });
    const handle = React.createRef<CameraHandle>();
    const view = renderWeb(<Camera handle={handle} running={false} />);
    const video = view.container.querySelector("video");
    if (!video) throw new Error("No video.");
    Object.defineProperty(video, "videoWidth", { value: 1440 });
    Object.defineProperty(video, "videoHeight", { value: 1080 });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ({ drawImage }) as never,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,BB");
    await expect(handle.current?.capture()).resolves.toBe("data:image/jpeg;base64,BB");
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 720, 540);
  });

  it("takes its own web version, and has nothing to capture then", async () => {
    const handle = React.createRef<CameraHandle>();
    const view = renderWeb(
      <Camera handle={handle}>
        <p>Camera</p>
      </Camera>,
    );
    expect(view.container.textContent).toBe("Camera");
    await expect(handle.current?.capture()).resolves.toBeNull();
  });

  it("reads a refusal as denied and anything else as unavailable", () => {
    expect(cameraStateOf(new DOMException("No.", "NotAllowedError"))).toBe("denied");
    expect(cameraStateOf(new Error("Gone."))).toBe("unavailable");
  });
});

describe("PhotoPicker", () => {
  it("sends its button natively and hands back the photos chosen", async () => {
    const onPick = vi.fn();
    const view = await mountComponent(
      <PhotoPicker
        title="Choose"
        systemImage="photo"
        limit={3}
        prominence="prominent"
        onPick={onPick}
      />,
    );
    expect(view.mount).toMatchObject({
      component: "photoPicker",
      props: { title: "Choose", systemImage: "photo", limit: 3, prominence: "prominent" },
      accessibility: { label: "Choose" },
    });
    view.event("pick", { images: ["data:a"] });
    expect(onPick).toHaveBeenCalledWith(["data:a"]);
  });

  it("opens a file input in its web version and reads up to `limit` files", async () => {
    const onPick = vi.fn();
    const view = renderWeb(
      <PhotoPicker title="Choose" icon={<i data-testid="icon" />} limit={1} onPick={onPick} />,
    );
    const input = view.container.querySelector("input");
    if (!input) throw new Error("No input.");
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    expect(click).toHaveBeenCalled();
    expect(input.multiple).toBe(false);
    expect(screen.getByTestId("icon").parentElement?.className).toBe("ni-icon");
    const files = [new File(["a"], "a.png"), new File(["b"], "b.png")];
    fireEvent.change(input, { target: { files } });
    await waitFor(() =>
      expect(onPick).toHaveBeenCalledWith(["data:application/octet-stream;base64,YQ=="]),
    );
    fireEvent.change(input, { target: { files: null } });
    await waitFor(() => expect(onPick).toHaveBeenLastCalledWith([]));
  });

  it("is labelled by its accessibility alone without a title, and takes its own web version", () => {
    const view = renderWeb(
      <PhotoPicker limit={4} onPick={() => {}}>
        <p>Pick</p>
      </PhotoPicker>,
    );
    expect(view.container.textContent).toBe("Pick");
    const multiple = renderWeb(<PhotoPicker limit={4} onPick={() => {}} />);
    expect(multiple.container.querySelector("input")?.multiple).toBe(true);
  });

  it("fails to read a file the browser cannot read", async () => {
    vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (this: FileReader) {
      this.dispatchEvent(new ProgressEvent("error"));
    });
    await expect(readAsDataURL(new Blob(["a"]))).rejects.toBeNull();
  });
});
