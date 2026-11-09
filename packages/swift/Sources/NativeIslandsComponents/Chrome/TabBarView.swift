import NativeIslands
import SwiftUI
import UIKit

/// The floating tab bar of iOS 26, drawn by the system `UITabBar` so it has
/// the Liquid Glass selection lens and hold-and-drag selection. Before iOS 26
/// the same bar sits on a material capsule, without its own background. The
/// page sets its `tabs` (id, title, symbol, badge) and selection; a pick
/// selects at once, before the page hears of it, and sends `select` with the
/// tab's index and id. Pages can still pass `titles` and `symbols` instead.
struct TabBarView: UIViewRepresentable {
  @ObservedObject var component: NativeComponentContext

  func makeCoordinator() -> Coordinator { Coordinator(component: component) }

  func makeUIView(context: Context) -> Slot {
    let slot = Slot()
    slot.bar.delegate = context.coordinator
    return slot
  }

  func updateUIView(_ slot: Slot, context: Context) {
    let bar = slot.bar
    let coordinator = context.coordinator
    coordinator.component = component
    let props = component.props
    let tabs = Tab.list(props)
    let rebuilt = tabs != coordinator.tabs
    if rebuilt {
      coordinator.tabs = tabs
      bar.items = tabs.enumerated().map { index, tab in
        let item = UITabBarItem(title: tab.title, image: UIImage(systemName: tab.symbol), tag: index)
        item.badgeValue = tab.badge
        return item
      }
    }
    bar.tintColor = props.color("tint").map(UIColor.init)
    let index = props.string("selectedId").flatMap { id in tabs.firstIndex { $0.id == id } }
      ?? props.int("selectedIndex") ?? 0
    // A pick shows at once; props that still carry the old index until the
    // page answers must not move the selection back.
    if rebuilt || index != coordinator.pageIndex {
      coordinator.pageIndex = index
      let items = bar.items ?? []
      bar.selectedItem = items.indices.contains(index) ? items[index] : nil
    }
  }

  /// Holds the bar so its glass platter, not the bar, fills the island. A
  /// `UITabBar` draws its platter inset from its own edges, as it would sit
  /// above the home indicator, so the bar is laid out that much larger.
  final class Slot: UIView {
    let bar = UITabBar()
    private lazy var platter = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterial))

    override init(frame: CGRect) {
      super.init(frame: frame)
      if #unavailable(iOS 26.0) {
        let appearance = UITabBarAppearance()
        appearance.configureWithTransparentBackground()
        bar.standardAppearance = appearance
        bar.scrollEdgeAppearance = appearance
        platter.clipsToBounds = true
        platter.layer.cornerCurve = .continuous
        platter.layer.borderWidth = 1 / max(1, traitCollection.displayScale)
        addSubview(platter)
      }
      addSubview(bar)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
      super.traitCollectionDidChange(previousTraitCollection)
      setNeedsLayout()
    }

    override func layoutSubviews() {
      super.layoutSubviews()
      if #unavailable(iOS 26.0) {
        platter.frame = bounds
        platter.layer.cornerRadius = min(bounds.width, bounds.height) / 2
        platter.layer.borderColor = UIColor.separator.resolvedColor(with: traitCollection).cgColor
        // The bar keeps its own height and lays its items in it, so it is
        // centred in the capsule rather than stretched to it.
        let height = min(bounds.height, bar.sizeThatFits(bounds.size).height)
        bar.frame = CGRect(x: 0, y: (bounds.height - height) / 2, width: bounds.width, height: height)
        return
      }
      bar.frame = bounds
      bar.layoutIfNeeded()
      let platter = bar.subviews
        .filter { $0.frame.width < bar.bounds.width }
        .max { $0.frame.width < $1.frame.width }
      guard let inset = platter?.frame else { return }
      bar.frame = CGRect(
        x: -inset.minX,
        y: -inset.minY,
        width: bounds.width + bar.bounds.width - inset.width,
        height: bounds.height + bar.bounds.height - inset.height
      )
    }
  }

  struct Tab: Equatable {
    let id: String
    let title: String
    let symbol: String
    let badge: String?

    static func list(_ props: NativeComponentProps) -> [Tab] {
      if let tabs = props["tabs"] as? [Any] {
        return tabs.compactMap { value in
          guard let tab = value as? [String: Any], let title = tab["title"] as? String else { return nil }
          let badge = tab["badge"].flatMap { $0 as? String ?? ($0 as? NSNumber)?.stringValue }
          return Tab(
            id: tab["id"] as? String ?? title,
            title: title,
            symbol: tab["systemImage"] as? String ?? "circle",
            badge: badge?.isEmpty == false ? badge : nil
          )
        }
      }
      let titles = props.strings("titles") ?? []
      let symbols = props.strings("symbols") ?? []
      return titles.enumerated().map { index, title in
        Tab(id: title, title: title, symbol: symbols.indices.contains(index) ? symbols[index] : "circle", badge: nil)
      }
    }
  }

  @MainActor
  final class Coordinator: NSObject, UITabBarDelegate {
    var component: NativeComponentContext
    var tabs: [Tab] = []
    var pageIndex: Int?

    init(component: NativeComponentContext) {
      self.component = component
    }

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
      let id = tabs.indices.contains(item.tag) ? tabs[item.tag].id : String(item.tag)
      component.emit("select", payload: ["index": item.tag, "id": id])
    }
  }
}
