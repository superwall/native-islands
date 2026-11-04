import MapKit
import NativeIslands
import SwiftUI

/// A MapKit map of the page's `places`. `style` is `standard`, `hybrid` or
/// `imagery`, `realistic` raises terrain and buildings, and `showsUser` asks
/// for location to show the user. Tapping a marker sends `select`; when the
/// page selects one, the map flies to it. Moving the map sends `regionChange`.
struct MapView: View {
  @ObservedObject var component: NativeComponentContext

  var body: some View {
    Group {
      if #available(iOS 17.0, *) {
        MapKitMap(component: component)
      } else {
        MapKitViewMap(component: component)
      }
    }
    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
  }

  struct Place: Identifiable {
    let id: String
    let title: String
    let symbol: String
    let coordinate: CLLocationCoordinate2D

    init?(_ value: Any) {
      guard let value = value as? [String: Any],
            let id = value["id"] as? String,
            let latitude = value["latitude"] as? Double,
            let longitude = value["longitude"] as? Double else { return nil }
      self.id = id
      title = value["title"] as? String ?? id
      symbol = value["symbol"] as? String ?? "mappin"
      coordinate = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
  }
}

@available(iOS 17.0, *)
private struct MapKitMap: View {
  @ObservedObject var component: NativeComponentContext
  @State private var position: MapCameraPosition = .automatic
  @State private var selection: String?

  var body: some View {
    let props = component.props
    let places = (props["places"] as? [Any] ?? []).compactMap(MapView.Place.init)
    let showsUser = props.bool("showsUser") == true
    Map(position: $position, selection: $selection) {
      ForEach(places) { place in
        Marker(place.title, systemImage: place.symbol, coordinate: place.coordinate)
          .tint(props.color("tint") ?? .red)
          .tag(place.id)
      }
      if showsUser {
        UserAnnotation()
      }
    }
    .mapStyle(Self.style(props.string("style"), realistic: props.bool("realistic") == true))
    .mapControls {
      MapCompass()
      MapScaleView()
      if showsUser {
        MapUserLocationButton()
      }
    }
    .onAppear { selection = props.string("selectedId") }
    .onChangeOf(selection) { next in
      guard next != component.props.string("selectedId") else { return }
      component.emit("select", payload: ["id": next.map { $0 as Any } ?? NSNull()])
    }
    .onChangeOf(props.string("selectedId")) { next in
      selection = next
      guard let place = places.first(where: { $0.id == next }) else { return }
      withAnimation(.smoothly(duration: 1.2)) {
        position = .camera(MapCamera(centerCoordinate: place.coordinate, distance: 1_800, heading: 0, pitch: 55))
      }
    }
    .onChangeOf(showsUser) { next in
      guard next else { return }
      Task { await LocationAuthorization.shared.request() }
    }
    .onMapCameraChange(frequency: .onEnd) { context in
      let region = context.region
      component.emit(
        "regionChange",
        payload: [
          "latitude": region.center.latitude,
          "longitude": region.center.longitude,
          "latitudeDelta": region.span.latitudeDelta,
          "longitudeDelta": region.span.longitudeDelta
        ]
      )
    }
  }

  static func style(_ name: String?, realistic: Bool) -> MapStyle {
    let elevation: MapStyle.Elevation = realistic ? .realistic : .flat
    switch name {
    case "hybrid": return .hybrid(elevation: elevation, pointsOfInterest: .all)
    case "imagery": return .imagery(elevation: elevation)
    default: return .standard(elevation: elevation, pointsOfInterest: .all)
    }
  }
}
