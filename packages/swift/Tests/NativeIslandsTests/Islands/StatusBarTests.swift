import SwiftUI
import Testing
import UIKit
import WebKit
@testable import NativeIslands

@MainActor
private final class NotchedSurface: NativeHostSurface {
  final class Viewport: UIView {
    override var safeAreaInsets: UIEdgeInsets {
      UIEdgeInsets(top: 60, left: 0, bottom: 34, right: 0)
    }
  }

  let viewport: UIView = Viewport(frame: CGRect(x: 0, y: 0, width: 400, height: 800))
  let pageScrollView = UIScrollView(frame: CGRect(x: 0, y: 0, width: 400, height: 800))
  let screenLayer: UIView = NativePassthroughView(frame: CGRect(x: 0, y: 0, width: 400, height: 800))

  init() {
    pageScrollView.contentSize = CGSize(width: 400, height: 2000)
    pageScrollView.contentInsetAdjustmentBehavior = .never
    viewport.addSubview(pageScrollView)
    viewport.addSubview(screenLayer)
  }
}

extension NativeBridgeTests {
  @Suite
  @MainActor
  struct StatusBarTests {
    @Test
    func cutsAwayThePartOfAPageIslandUnderTheStatusBarAndKeepsTheRestShown() {
      let registry = NativeComponentRegistry()
      registry.register("glassButton") { _ in Color.clear }
      let surface = NotchedSurface()
      let manager = NativeIslandManager(registry: registry, surface: surface, send: { _ in }, schedule: { _ in })
      manager.apply(
        batch(
          1,
          mountOp("low", frame: NativeFrame(x: 10, y: 200, width: 100, height: 44)),
          mountOp("bar", frame: NativeFrame(x: 10, y: 10, width: 44, height: 44), anchor: .screen)
        )
      )
      let low = manager.islands["low"]
      #expect(low?.isShown == true)
      #expect(low?.view.isUserInteractionEnabled == true)

      surface.pageScrollView.contentOffset = CGPoint(x: 0, y: 180)
      #expect(low?.topCut == 40)
      #expect(low?.isShown == true)
      #expect(low?.view.alpha == 1)
      #expect(low?.drawnShape?.area == CGRect(x: 0, y: 40, width: 100, height: 4))
      #expect(low?.view.mask is NativeIslandMask)
      #expect(manager.islands["bar"]?.topCut == 0)

      surface.pageScrollView.contentOffset = CGPoint(x: 0, y: 300)
      #expect(low?.drawnShape?.area.height == 0)

      surface.pageScrollView.contentOffset = .zero
      #expect(low?.topCut == 0)
      #expect(low?.view.mask == nil)
    }

    @Test
    func cutsHolesWherePageContentCoversAnIsland() {
      let registry = NativeComponentRegistry()
      registry.register("glassButton") { _ in Color.clear }
      let surface = NotchedSurface()
      let manager = NativeIslandManager(registry: registry, surface: surface, send: { _ in }, schedule: { _ in })
      var mount = mountOp("cta", frame: NativeFrame(x: 10, y: 300, width: 100, height: 44))
      if case .mount(var value) = mount {
        value.holes = [NativeFrame(x: 0, y: 30, width: 100, height: 14)]
        value.shades = [NativeShade(x: 0, y: 0, width: 100, height: 30, color: "rgba(0, 0, 0, 0.4)")]
        mount = .mount(value)
      }
      manager.apply(batch(1, mount))
      let cta = manager.islands["cta"]
      #expect(cta?.isShown == true)
      #expect(cta?.drawnShape?.holes == [CGRect(x: 0, y: 30, width: 100, height: 14)])
      #expect(cta?.view.mask is NativeIslandMask)
      #expect(cta?.shadeLayers.count == 1)
      #expect(cta?.shadeLayers.first?.frame == CGRect(x: 0, y: 0, width: 100, height: 30))
      let shadeHost = cta?.shadeLayers.first?.superview
      let parent = cta?.view.superview
      #expect(shadeHost?.superview === parent)
      #expect(shadeHost?.frame == cta?.view.frame)
      if let parent, let shadeHost, let view = cta?.view {
        #expect(parent.subviews.firstIndex(of: shadeHost) == parent.subviews.firstIndex(of: view).map { $0 + 1 })
      }
      manager.apply(
        batch(2, .update(NativeUpdate(id: "cta", frame: NativeFrame(x: 10, y: 300, width: 100, height: 44))))
      )
      #expect(cta?.drawnShape == nil)
      #expect(cta?.view.mask == nil)
      #expect(cta?.shadeLayers.isEmpty == true)
      #expect(shadeHost?.superview == nil)
    }

    @Test
    func turnsAndFadesAnIslandLikeItsElementAndUndoesIt() {
      let registry = NativeComponentRegistry()
      registry.register("glassButton") { _ in Color.clear }
      let surface = NotchedSurface()
      let manager = NativeIslandManager(registry: registry, surface: surface, send: { _ in }, schedule: { _ in })
      var mount = mountOp("tilted", frame: NativeFrame(x: 10, y: 300, width: 100, height: 40))
      if case .mount(var value) = mount {
        value.transform = NativeTransform(a: 0, b: 1, c: -1, d: 0)
        value.opacity = 0.5
        mount = .mount(value)
      }
      manager.apply(batch(1, mount))
      let island = try? #require(manager.islands["tilted"])
      #expect(island?.view.bounds.size == CGSize(width: 100, height: 40))
      #expect(island?.view.center == CGPoint(x: 60, y: 320))
      #expect(island?.view.transform == CGAffineTransform(a: 0, b: 1, c: -1, d: 0, tx: 0, ty: 0))
      #expect(island?.view.alpha == 0.5)
      manager.apply(
        batch(2, .update(NativeUpdate(id: "tilted", frame: NativeFrame(x: 10, y: 300, width: 100, height: 40))))
      )
      #expect(island?.view.transform == .identity)
      #expect(island?.view.frame == CGRect(x: 10, y: 300, width: 100, height: 40))
      #expect(island?.view.alpha == 1)
      manager.apply(batch(3, .update(NativeUpdate(id: "tilted", visible: false))))
      #expect(island?.shownAlpha == 0)
    }

    @Test
    func keepsAnIslandThatRestsInTheTopInsetShown() {
      let registry = NativeComponentRegistry()
      registry.register("closeButton") { _ in Color.clear }
      let surface = NotchedSurface()
      let manager = NativeIslandManager(registry: registry, surface: surface, send: { _ in }, schedule: { _ in })
      manager.apply(
        batch(
          1,
          mountOp("close", component: "closeButton", frame: NativeFrame(x: 340, y: 12, width: 44, height: 44))
        )
      )
      surface.pageScrollView.contentOffset = CGPoint(x: 0, y: 1)
      manager.updateObscured()
      #expect(manager.islands["close"]?.topCut == 0)
      surface.pageScrollView.contentOffset = CGPoint(x: 0, y: 40)
      manager.updateObscured()
      #expect(manager.islands["close"]?.topCut == 0)
      #expect(manager.islands["close"]?.isShown == true)
    }

    @Test
    func followsInnerScrollers() {
      let registry = NativeComponentRegistry()
      registry.register("glassButton") { _ in Color.clear }
      let surface = NotchedSurface()
      let list = UIScrollView(frame: CGRect(x: 0, y: 100, width: 400, height: 300))
      list.contentSize = CGSize(width: 400, height: 900)
      list.contentInsetAdjustmentBehavior = .never
      surface.pageScrollView.addSubview(list)
      let manager = NativeIslandManager(registry: registry, surface: surface, send: { _ in }, schedule: { _ in })
      manager.apply(
        batch(
          1,
          mountOp(
            "row",
            frame: NativeFrame(x: 0, y: 20, width: 100, height: 40),
            anchor: scroller(
              frame: NativeFrame(x: 0, y: 100, width: 400, height: 300),
              contentSize: NativeSize(width: 400, height: 900)
            )
          )
        )
      )
      #expect(manager.islands["row"]?.isShown == true)
      list.contentOffset = CGPoint(x: 0, y: 70)
      #expect(manager.islands["row"]?.view.superview === list)
      #expect(manager.islands["row"]?.topCut == 10)
    }
  }
}
