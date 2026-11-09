import NativeIslands
import SwiftUI
import UIKit
import WebKit

/// A native presentation of another page: a `sheet` (with `detents`, a
/// `grabber` and interactive dismiss unless `dismissible` is false), a
/// `fullScreenCover`, a `popover` anchored to the element, or an
/// `inspector`, which is a sheet on iPhone and a form sheet on iPad. `url` is
/// read relative to the presenting page.
///
/// Sheets, covers and inspectors get a system navigation bar with `title`
/// and a Done button (no Done when `dismissible` is false); `header: false`
/// leaves the whole page to the presented page. `background` colours the
/// presentation while its page loads, so nothing flashes white.
///
/// The page opens and closes it with `open`. A user dismissal (a swipe, a tap
/// outside or Done) sets `open` to false and sends `dismiss` with
/// `reason: "user"`; the presented page can close it too (`reason: "page"`
/// and its `result`), move it to another detent and send `message`s up;
/// `post` sends data down to it.
struct PresentationView: UIViewRepresentable {
  @ObservedObject var component: NativeComponentContext

  func makeCoordinator() -> Coordinator { Coordinator(component: component) }

  func makeUIView(context: Context) -> AnchorView {
    let anchor = AnchorView()
    context.coordinator.anchor = anchor
    let coordinator = context.coordinator
    component.onCommand { [weak coordinator] name, args in
      switch name {
      case "post": coordinator?.page?.post(args)
      default: throw NativeComponentError.refused("Unknown command \(name).")
      }
      return nil
    }
    return anchor
  }

  func updateUIView(_ anchor: AnchorView, context: Context) {
    context.coordinator.component = component
    // The anchor joins the web view only after this pass.
    DispatchQueue.main.async { context.coordinator.update() }
  }

  static func dismantleUIView(_ anchor: AnchorView, coordinator: Coordinator) {
    coordinator.close(animated: true, report: false)
    coordinator.discardPrepared()
  }

  @MainActor
  final class Coordinator: NSObject, UISheetPresentationControllerDelegate, UIPopoverPresentationControllerDelegate {
    var component: NativeComponentContext
    weak var anchor: AnchorView?
    private(set) var page: PresentedPageController?
    /// The next page, loaded while the presentation is closed, so it opens
    /// with its islands already drawn.
    private var prepared: PresentedPageController?
    private var shown: UIViewController?
    private var shownStyle: String?
    private var applied: [String: String] = [:]

    init(component: NativeComponentContext) {
      self.component = component
    }

    private var props: NativeComponentProps { component.props }

    func update() {
      // Once shown, only `open` closes it: the presenting page's islands can
      // report themselves hidden while a sheet covers them, and that must
      // never close it.
      guard props.bool("open") == true else {
        if page != nil { close(animated: true, report: false) }
        prepare()
        return
      }
      if let page {
        if let url = resolvedURL() { page.load(url) }
        configure(page)
        return
      }
      guard component.isVisible else { return }
      present()
    }

    private func resolvedURL() -> URL? {
      PresentationURL.resolve(props.string("url"), from: anchor?.enclosingWebView?.url)
    }

    private var presenterHost: NativeIslandsHost? {
      anchor?.enclosingWebView.flatMap(NativeIslandsHost.of)
    }

    /// Loads the page before it is asked for (`preload`, on by default), in
    /// a web view off screen, so presenting it shows a page already laid out.
    private func prepare() {
      // A presentation whose page left the screen lets its page go.
      guard component.isVisible else {
        discardPrepared()
        return
      }
      guard props.bool("preload") != false, let anchor,
        let webView = anchor.enclosingWebView, let url = resolvedURL()
      else {
        if props.bool("preload") == false { discardPrepared() }
        return
      }
      let style = props.string("style") ?? "sheet"
      if let prepared, prepared.url == url, prepared.style == style {
        // Prepared before the anchor had a window: wait there now.
        if prepared.view.window == nil, let window = anchor.window { window.insertSubview(prepared.view, at: 0) }
        return
      }
      discardPrepared()
      let page = PresentedPageController(
        url: url,
        configuration: webView.configuration,
        style: style,
        background: props.uiColor("background")
      )
      page.preload(in: anchor.window, size: anchor.window?.bounds.size ?? UIScreen.main.bounds.size)
      prepared = page
    }

    func discardPrepared() {
      prepared?.close()
      prepared = nil
    }

    private func present() {
      guard let anchor, let webView = anchor.enclosingWebView, let url = resolvedURL(),
        let front = anchor.frontController
      else { return }
      let style = props.string("style") ?? "sheet"
      let page: PresentedPageController
      if let prepared, prepared.url == url, prepared.style == style {
        page = prepared
        self.prepared = nil
      } else {
        discardPrepared()
        page = PresentedPageController(
          url: url,
          configuration: webView.configuration,
          style: style,
          background: props.uiColor("background")
        )
      }
      page.webView.islands?.showsOutlines = presenterHost?.showsOutlines ?? false
      page.onDismissRequest = { [weak self] result in
        self?.close(animated: true, report: true, reason: "page", result: result)
      }
      page.onMessage = { [weak self] data in self?.component.emit("message", payload: ["data": data ?? NSNull()]) }
      page.onDetentRequest = { [weak self] name in self?.select(detent: name) }
      page.onDone = { [weak self] in self?.close(animated: true, report: true, reason: "user") }
      shownStyle = style
      applied = [:]
      let header = props.bool("header") ?? (style != "popover")
      let shown: UIViewController = header ? PresentationNavigationController(rootViewController: page) : page
      // Opaque under the transparent bar too: a cover leaves the presenting
      // page in place behind it.
      shown.view.backgroundColor = props.uiColor("background") ?? .systemGroupedBackground
      switch style {
      case "fullScreenCover":
        // Over, not instead of, the presenting page: `.fullScreen` takes the
        // presenting web view out of the window, and its islands with it.
        shown.modalPresentationStyle = .overFullScreen
      case "popover":
        shown.modalPresentationStyle = .popover
        shown.preferredContentSize = CGSize(
          width: props.double("width") ?? 320,
          height: props.double("height") ?? 360
        )
        shown.popoverPresentationController?.sourceView = anchor
        shown.popoverPresentationController?.sourceRect = anchor.bounds
        shown.popoverPresentationController?.delegate = self
      case "inspector" where anchor.traitCollection.horizontalSizeClass == .regular:
        shown.modalPresentationStyle = .formSheet
      default:
        shown.modalPresentationStyle = .pageSheet
      }
      shown.presentationController?.delegate = self
      self.page = page
      self.shown = shown
      configure(page)
      front.present(shown, animated: true)
    }

    /// Applies the props that changed since the last pass, so a re-render of
    /// the presenting page never resets a sheet the person is dragging.
    private func configure(_ page: PresentedPageController) {
      func changed(_ key: String, _ value: String) -> Bool {
        guard applied[key] != value else { return false }
        applied[key] = value
        return true
      }
      let dismissible = props.bool("dismissible") != false
      if changed("dismissible", "\(dismissible)") {
        shown?.isModalInPresentation = !dismissible
        page.showsDone = dismissible
      }
      if changed("title", props.string("title") ?? "") { page.title = props.string("title") }
      guard let sheet = shown?.sheetPresentationController else { return }
      sheet.delegate = self
      let names = props.strings("detents") ?? (shownStyle == "inspector" ? ["medium", "large"] : ["large"])
      let grabber = props.bool("grabber") ?? (names.count > 1)
      let shape = "\(names)|\(grabber)|\(props.bool("undimmed") == true)|\(props.double("cornerRadius") ?? -1)"
      if changed("shape", shape) {
        // The web view stays as tall as the tallest detent, so moving the
        // sheet between detents never lays the page out again. `medium` has
        // no height UIKit tells, so a sheet whose tallest detent it is keeps
        // the web view the sheet's height.
        page.tallestDetent = nil
        let measured = !names.contains("medium") || names.contains("large")
        let detents = names.compactMap { name in
          SheetDetents.detent(name) { [weak page] height in
            guard measured, let page else { return }
            page.tallestDetent = max(page.tallestDetent ?? 0, height)
          }
        }
        sheet.animateChanges {
          sheet.detents = detents.isEmpty ? [.large()] : detents
          sheet.prefersGrabberVisible = grabber
          sheet.prefersScrollingExpandsWhenScrolledToEdge = props.bool("expandsOnScroll") ?? true
          if let radius = props.double("cornerRadius") { sheet.preferredCornerRadius = radius }
          if props.bool("undimmed") == true {
            // Dims nothing up to the tallest detent but the full height.
            let tallest = names.last.map(SheetDetents.identifier) ?? .large
            sheet.largestUndimmedDetentIdentifier = tallest == .large ? .medium : tallest
          } else {
            sheet.largestUndimmedDetentIdentifier = nil
          }
        }
      }
      if let selected = props.string("selectedDetent"), changed("selected", selected),
        sheet.selectedDetentIdentifier != SheetDetents.identifier(selected) {
        sheet.animateChanges { sheet.selectedDetentIdentifier = SheetDetents.identifier(selected) }
      }
      page.detent = SheetDetents.name(of: sheet.selectedDetentIdentifier) ?? names.first ?? "large"
    }

    private func select(detent name: String) {
      guard let sheet = shown?.sheetPresentationController else { return }
      if #available(iOS 16.0, *), !sheet.detents.contains(where: { $0.identifier == SheetDetents.identifier(name) }) {
        return
      }
      sheet.animateChanges { sheet.selectedDetentIdentifier = SheetDetents.identifier(name) }
      sheetPresentationControllerDidChangeSelectedDetentIdentifier(sheet)
    }

    func close(animated: Bool, report: Bool, reason: String = "page", result: Any? = nil) {
      guard let page else { return }
      let shown = self.shown
      self.page = nil
      self.shown = nil
      Self.dismiss(shown, animated: animated) { page.close() }
      guard report else { return }
      component.setState(["open": false])
      component.emit("dismiss", payload: ["reason": reason, "result": result ?? NSNull()])
    }

    /// Dismisses `shown` and then runs `done`. A dismissal asked for while a
    /// transition runs (the person dragging the sheet, or it still sliding
    /// in) is ignored by UIKit, so it waits for that transition to end first;
    /// the page keeps its islands until the sheet is really gone.
    static func dismiss(_ shown: UIViewController?, animated: Bool, done: @escaping @MainActor () -> Void) {
      guard let shown, let presenter = shown.presentingViewController, !shown.isBeingDismissed else {
        done()
        return
      }
      if let transition = shown.transitionCoordinator {
        transition.animate(alongsideTransition: nil) { _ in
          MainActor.assumeIsolated { dismiss(shown, animated: animated, done: done) }
        }
        return
      }
      presenter.dismiss(animated: animated) { MainActor.assumeIsolated { done() } }
    }

    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
      guard let page, presentationController.presentedViewController === shown else { return }
      self.page = nil
      shown = nil
      page.close()
      component.setState(["open": false])
      component.emit("dismiss", payload: ["reason": "user", "result": NSNull()])
    }

    func sheetPresentationControllerDidChangeSelectedDetentIdentifier(
      _ sheet: UISheetPresentationController
    ) {
      guard let name = SheetDetents.name(of: sheet.selectedDetentIdentifier) else { return }
      applied["selected"] = name
      page?.detent = name
      component.setState(["selectedDetent": name])
    }

    func adaptivePresentationStyle(
      for controller: UIPresentationController,
      traitCollection: UITraitCollection
    ) -> UIModalPresentationStyle {
      // A popover stays a popover on iPhone, as with SwiftUI's
      // `presentationCompactAdaptation(.popover)`, unless the page asks for a sheet.
      props.string("compact") == "sheet" ? .pageSheet : .none
    }
  }
}

/// The navigation controller around a presented page, so it gets the system
/// sheet header: the title and Done in a real navigation bar.
final class PresentationNavigationController: UINavigationController {
  override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
    presentingViewController?.supportedInterfaceOrientations ?? .all
  }
}
