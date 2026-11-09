import AVFoundation
import AVKit
import Combine
import NativeIslands
import SwiftUI

/// The player behind a video island: AVPlayer on a layer the island draws, and
/// Picture in Picture from that layer, so playback carries on over other apps.
@MainActor
final class VideoPlayback: NSObject, ObservableObject, AVPictureInPictureControllerDelegate {
  let player = AVPlayer()
  let layer = AVPlayerLayer()
  @Published private(set) var playing = false
  @Published private(set) var time: Double = 0
  @Published private(set) var duration: Double = 0
  @Published private(set) var pictureInPicture = false
  @Published var scrubbing = false
  private(set) var url: URL?
  private var pip: AVPictureInPictureController?
  private var observers: [AnyCancellable] = []
  private var clock: Any?

  override init() {
    super.init()
    layer.player = player
    layer.videoGravity = .resizeAspectFill
    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
    player.publisher(for: \.timeControlStatus)
      .receive(on: RunLoop.main)
      .sink { [weak self] status in self?.playing = status != .paused }
      .store(in: &observers)
    clock = player.addPeriodicTimeObserver(
      forInterval: CMTime(seconds: 0.25, preferredTimescale: 600),
      queue: .main
    ) { [weak self] now in
      MainActor.assumeIsolated {
        guard let self, !self.scrubbing else { return }
        self.time = now.seconds.isFinite ? now.seconds : 0
        let total = self.player.currentItem?.duration.seconds ?? 0
        self.duration = total.isFinite ? total : 0
      }
    }
    if AVPictureInPictureController.isPictureInPictureSupported() {
      pip = AVPictureInPictureController(playerLayer: layer)
      pip?.canStartPictureInPictureAutomaticallyFromInline = true
      pip?.delegate = self
    }
  }

  var canPictureInPicture: Bool { pip != nil }

  func load(_ next: URL?) {
    guard next != url else { return }
    url = next
    player.replaceCurrentItem(with: next.map(AVPlayerItem.init(url:)))
  }

  func play() {
    try? AVAudioSession.sharedInstance().setActive(true)
    if duration > 0, time >= duration - 0.5 { seek(to: 0) }
    player.play()
  }

  func pause() { player.pause() }

  func seek(to seconds: Double) {
    time = seconds
    player.seek(to: CMTime(seconds: seconds, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
  }

  func togglePictureInPicture() {
    guard let pip else { return }
    if pip.isPictureInPictureActive {
      pip.stopPictureInPicture()
    } else {
      pip.startPictureInPicture()
    }
  }

  nonisolated func pictureInPictureControllerDidStartPictureInPicture(_ controller: AVPictureInPictureController) {
    MainActor.assumeIsolated { pictureInPicture = true }
  }

  nonisolated func pictureInPictureControllerDidStopPictureInPicture(_ controller: AVPictureInPictureController) {
    MainActor.assumeIsolated { pictureInPicture = false }
  }

  isolated deinit {
    if let clock { player.removeTimeObserver(clock) }
    player.pause()
  }
}

/// A UIKit view whose own layer is the player layer, so it resizes with the island.
final class PlayerLayerView: UIView {
  func show(_ playerLayer: AVPlayerLayer) {
    guard playerLayer.superlayer !== layer else { return }
    playerLayer.removeFromSuperlayer()
    layer.addSublayer(playerLayer)
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    layer.sublayers?.forEach { $0.frame = bounds }
  }
}

struct PlayerLayerRepresentable: UIViewRepresentable {
  let playback: VideoPlayback

  func makeUIView(context: Context) -> PlayerLayerView {
    let view = PlayerLayerView()
    view.backgroundColor = .black
    view.show(playback.layer)
    return view
  }

  func updateUIView(_ view: PlayerLayerView, context: Context) {
    view.show(playback.layer)
  }
}

/// A video the page names by `url`, drawn by AVFoundation with native glass
/// controls and Picture in Picture. It sends `status` as playback changes and
/// takes `play`, `pause` and `pictureInPicture` commands.
struct VideoView: View {
  @ObservedObject var component: NativeComponentContext
  @StateObject private var playback = VideoPlayback()

  var body: some View {
    ZStack(alignment: .bottom) {
      PlayerLayerRepresentable(playback: playback)
        .contentShape(Rectangle())
        .onTapGesture { playback.playing ? playback.pause() : playback.play() }
      if playback.pictureInPicture {
        Label("Playing in Picture in Picture", systemImage: "pip")
          .font(.subheadline.weight(.medium))
          .foregroundStyle(.white.opacity(0.8))
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      }
      controls
        .padding(10)
    }
    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    .onAppear {
      playback.load(component.props.string("url").flatMap(URL.init(string:)))
      component.onCommand { [playback] name, _ in
        switch name {
        case "play": playback.play()
        case "pause": playback.pause()
        case "pictureInPicture": playback.togglePictureInPicture()
        default: throw NativeComponentError.refused("Unknown command \(name).")
        }
        return nil
      }
    }
    .onChangeOf(component.props.string("url")) { next in
      playback.load(next.flatMap(URL.init(string:)))
    }
    .onChangeOf(status) { next in
      component.emit("status", payload: next)
    }
  }

  private var status: [String: AnyHashable] {
    [
      "playing": playback.playing,
      "time": Double(Int(playback.time)),
      "duration": Double(Int(playback.duration)),
      "pictureInPicture": playback.pictureInPicture
    ]
  }

  private var controls: some View {
    HStack(spacing: 12) {
      Button {
        playback.playing ? playback.pause() : playback.play()
      } label: {
        Image(systemName: playback.playing ? "pause.fill" : "play.fill")
          .symbolReplaceTransition()
          .frame(width: 22)
      }
      .accessibilityLabel(playback.playing ? "Pause" : "Play")
      Text(Self.clock(playback.time))
        .monospacedDigit()
      Slider(
        value: Binding(get: { playback.time }, set: { playback.seek(to: $0) }),
        in: 0...max(playback.duration, 1)
      ) { editing in
        playback.scrubbing = editing
      }
      .accessibilityLabel("Position")
      .accessibilityValue("\(Self.clock(playback.time)) of \(Self.clock(playback.duration))")
      Text(Self.clock(playback.duration))
        .monospacedDigit()
      if playback.canPictureInPicture {
        Button {
          playback.togglePictureInPicture()
        } label: {
          Image(systemName: playback.pictureInPicture ? "pip.exit" : "pip.enter")
        }
        .accessibilityLabel(playback.pictureInPicture ? "Exit Picture in Picture" : "Picture in Picture")
      }
    }
    .font(.footnote.weight(.semibold))
    .foregroundStyle(.white)
    .tint(.white)
    .buttonStyle(.plain)
    .padding(.horizontal, 14)
    .padding(.vertical, 8)
    .glassOrMaterial(in: Capsule(), tint: .black.opacity(0.2))
  }

  static func clock(_ seconds: Double) -> String {
    let whole = Int(seconds.isFinite ? max(seconds, 0) : 0)
    return String(format: "%d:%02d", whole / 60, whole % 60)
  }
}
