import CoreHaptics
import NativeIslands
import SwiftUI
import UIKit

/// Plays Core Haptics patterns the page writes, with no view of its own:
/// `play` takes `events`, each `transient` (a tap) or `continuous` (a hum
/// for `duration` seconds), at `time` seconds, with `intensity` and
/// `sharpness` from 0 to 1, and optional `attack` and `decay`. `impact` plays
/// one of the simple feedbacks the haptic button uses, at an `intensity`.
/// Both answer `{ played }`: false where the device has no Taptic Engine.
struct HapticEngineView: View {
  @ObservedObject var component: NativeComponentContext
  @StateObject private var engine = HapticPlayer()

  var body: some View {
    Color.clear
      .allowsHitTesting(false)
      .accessibilityHidden(true)
      .onAppear {
        component.onCommand { [engine] name, args in
          switch name {
          case "play": return ["played": engine.play(args as? [String: Any] ?? [:])]
          case "impact":
            let args = args as? [String: Any] ?? [:]
            let intensity = (args["intensity"] as? NSNumber)?.doubleValue
            return ["played": HapticPlayer.impact(args["style"] as? String, intensity: intensity)]
          case "stop":
            engine.stop()
            return nil
          default: throw NativeComponentError.refused("Unknown command \(name).")
          }
        }
      }
  }
}

@MainActor
final class HapticPlayer: ObservableObject {
  private var engine: CHHapticEngine?
  private var player: CHHapticAdvancedPatternPlayer?

  static var isSupported: Bool { CHHapticEngine.capabilitiesForHardware().supportsHaptics }

  static func impact(_ style: String?, intensity: Double?) -> Bool {
    let styles: [String: UIImpactFeedbackGenerator.FeedbackStyle] = [
      "light": .light, "medium": .medium, "heavy": .heavy, "soft": .soft, "rigid": .rigid
    ]
    if let style = style.flatMap({ styles[$0] }) {
      UIImpactFeedbackGenerator(style: style).impactOccurred(intensity: CGFloat(intensity ?? 1))
    } else {
      HapticButtonView.play(style)
    }
    return isSupported
  }

  /// Builds the page's pattern and plays it, starting the engine on first use.
  func play(_ args: [String: Any]) -> Bool {
    guard Self.isSupported, let pattern = Self.pattern(args) else { return false }
    do {
      let engine = try running()
      try player?.stop(atTime: CHHapticTimeImmediate)
      let player = try engine.makeAdvancedPlayer(with: pattern)
      player.loopEnabled = args["loop"] as? Bool ?? false
      self.player = player
      try player.start(atTime: CHHapticTimeImmediate)
      return true
    } catch {
      NativeIslandsComponents.log("Couldn't play a haptic pattern: \(error.localizedDescription)")
      return false
    }
  }

  func stop() {
    try? player?.stop(atTime: CHHapticTimeImmediate)
    player = nil
  }

  private func running() throws -> CHHapticEngine {
    if let engine { return engine }
    let engine = try CHHapticEngine()
    engine.playsHapticsOnly = true
    engine.isAutoShutdownEnabled = true
    engine.resetHandler = { [weak engine] in try? engine?.start() }
    try engine.start()
    self.engine = engine
    return engine
  }

  static func pattern(_ args: [String: Any]) -> CHHapticPattern? {
    let events = (args["events"] as? [Any] ?? []).compactMap { value -> CHHapticEvent? in
      guard let event = value as? [String: Any] else { return nil }
      let number = { (key: String) in (event[key] as? NSNumber)?.doubleValue }
      let clamp = { (key: String, fallback: Double) in Float(min(max(number(key) ?? fallback, 0), 1)) }
      var parameters = [
        CHHapticEventParameter(parameterID: .hapticIntensity, value: clamp("intensity", 1)),
        CHHapticEventParameter(parameterID: .hapticSharpness, value: clamp("sharpness", 0.5))
      ]
      if let attack = number("attack") {
        parameters.append(CHHapticEventParameter(parameterID: .attackTime, value: Float(attack)))
      }
      if let decay = number("decay") {
        parameters.append(CHHapticEventParameter(parameterID: .decayTime, value: Float(decay)))
      }
      let time = max(number("time") ?? 0, 0)
      if event["kind"] as? String == "continuous" {
        return CHHapticEvent(
          eventType: .hapticContinuous,
          parameters: parameters,
          relativeTime: time,
          duration: max(number("duration") ?? 0.2, 0.01)
        )
      }
      return CHHapticEvent(eventType: .hapticTransient, parameters: parameters, relativeTime: time)
    }
    guard !events.isEmpty else { return nil }
    return try? CHHapticPattern(events: events, parameters: [])
  }
}
