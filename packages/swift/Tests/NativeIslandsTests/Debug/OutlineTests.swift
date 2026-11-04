import SwiftUI
import Testing
import UIKit
import WebKit
@testable import NativeIslands

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct OutlineTests {
    private func registry() -> NativeComponentRegistry {
      let registry = NativeComponentRegistry()
      registry.register("glassButton") { _ in Color.clear }
      return registry
    }

    private func mount(_ host: NativeIslandsHost) {
      host.receive([
        "event_name": "native_component_batch",
        "protocol": 1,
        "sequence": 1,
        "operations": [
          [
            "op": "mount",
            "id": "cta",
            "component": "glassButton",
            "version": 1,
            "props": ["title": "Go"],
            "frame": ["x": 10, "y": 20, "width": 100, "height": 44],
            "anchor": ["type": "page"],
            "visible": true,
            "order": 0,
            "sizing": "web"
          ]
        ]
      ])
    }

    /// The colour of the island's left edge, halfway down, where the outline's border runs.
    private func edgeColor(of island: NativeIsland) -> (red: UInt8, green: UInt8, blue: UInt8, alpha: UInt8) {
      let view = island.host.view!
      let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 100, height: 44))
      let container = UIViewController()
      window.rootViewController = container
      window.isHidden = false
      container.view.addSubview(view)
      view.frame = window.bounds
      view.layoutIfNeeded()
      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      format.opaque = false
      let image = UIGraphicsImageRenderer(size: window.bounds.size, format: format).image { renderer in
        view.layer.render(in: renderer.cgContext)
      }
      var pixel = [UInt8](repeating: 0, count: 4)
      let context = CGContext(
        data: &pixel,
        width: 1,
        height: 1,
        bitsPerComponent: 8,
        bytesPerRow: 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
      )!
      context.draw(image.cgImage!, in: CGRect(x: 0, y: -21, width: 100, height: 44))
      return (pixel[0], pixel[1], pixel[2], pixel[3])
    }

    @Test
    func areOffByDefault() {
      let host = NativeIslandsHost(webView: RecordingWebView(), registry: registry())
      #expect(!host.showsOutlines)
      host.showsOutlines = true
      #expect(host.showsOutlines)
      host.showsOutlines = false
      #expect(!host.showsOutlines)
    }

    @Test
    func doNothingWhileTheHostOffersNoIslands() {
      let host = NativeIslandsHost(webView: RecordingWebView(), registry: NativeComponentRegistry())
      host.showsOutlines = true
      #expect(!host.showsOutlines)
    }

    @Test("Turning outlines on and off redraws the islands already mounted, without a remount")
    func reachMountedIslands() throws {
      let host = NativeIslandsHost(
        webView: RecordingWebView(frame: CGRect(x: 0, y: 0, width: 400, height: 800)),
        registry: registry()
      )
      mount(host)
      let island = try #require(host.manager?.islands["cta"])
      #expect(island.host.rootView.outlines === host.manager?.outlines)
      #expect(edgeColor(of: island).alpha == 0)

      host.showsOutlines = true
      let outlined = edgeColor(of: island)
      #expect(outlined.red == 214 && outlined.green == 58 && outlined.blue == 249 && outlined.alpha == 255)

      host.showsOutlines = false
      #expect(edgeColor(of: island).alpha == 0)
      #expect(host.manager?.islands["cta"] === island)
    }

    @Test
    func readTheLaunchArgument() {
      #expect(NativeIslandOutlines.isRequested(["app", "-NativeIslandsOutlines", "YES"]))
      #expect(NativeIslandOutlines.isRequested(["app", "-NativeIslandsOutlines", "1"]))
      #expect(NativeIslandOutlines.isRequested(["app", "-NativeIslandsOutlines"]))
      #expect(!NativeIslandOutlines.isRequested(["app", "-NativeIslandsOutlines", "NO"]))
      #expect(!NativeIslandOutlines.isRequested(["app"]))
    }
  }
}
