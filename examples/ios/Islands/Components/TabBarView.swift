import NativeIslands
import SwiftUI
import UIKit

/// The floating tab bar of iOS 26, drawn by the system `UITabBar` so it has
/// the Liquid Glass selection lens and hold-and-drag selection. The page sets
/// its tabs and selection; a pick selects at once, before the page hears of it.
@available(iOS 26.0, *)
struct TabBarView: UIViewRepresentable {
  @ObservedObject var component: NativeComponentContext

  func makeCoordinator() -> Coordinator { Coordinator(component: component) }

  func makeUIView(context: Context) -> UITabBar {
    let bar = UITabBar()
    bar.delegate = context.coordinator
    return bar
  }

  func updateUIView(_ bar: UITabBar, context: Context) {
    let coordinator = context.coordinator
    coordinator.component = component
    let props = component.props
    let titles = props.strings("titles") ?? []
    let symbols = props.strings("symbols") ?? []
    let tabs = titles.enumerated().map { index, title in
      Tab(title: title, symbol: symbols.indices.contains(index) ? symbols[index] : "circle")
    }
    let rebuilt = tabs != coordinator.tabs
    if rebuilt {
      coordinator.tabs = tabs
      bar.items = tabs.enumerated().map { index, tab in
        UITabBarItem(title: tab.title, image: UIImage(systemName: tab.symbol), tag: index)
      }
    }
    bar.tintColor = props.color("tint").map(UIColor.init)
    let index = props.int("selectedIndex") ?? 0
    // A pick shows at once; props that still carry the old index until the
    // page answers must not move the selection back.
    if rebuilt || index != coordinator.pageIndex {
      coordinator.pageIndex = index
      let items = bar.items ?? []
      bar.selectedItem = items.indices.contains(index) ? items[index] : nil
    }
  }

  struct Tab: Equatable {
    let title: String
    let symbol: String
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
      component.emit("select", payload: ["index": item.tag])
    }
  }
}
