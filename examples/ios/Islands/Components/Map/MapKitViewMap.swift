import MapKit
import NativeIslands
import SwiftUI

/// `MapView` before iOS 17, where SwiftUI's `Map` has no selection, markers
/// or camera: the same places, styles and events on an `MKMapView`.
struct MapKitViewMap: UIViewRepresentable {
  @ObservedObject var component: NativeComponentContext

  func makeCoordinator() -> Coordinator { Coordinator(component: component) }

  func makeUIView(context: Context) -> MKMapView {
    let map = MKMapView()
    map.delegate = context.coordinator
    map.showsCompass = true
    map.showsScale = true
    map.register(MKMarkerAnnotationView.self, forAnnotationViewWithReuseIdentifier: Coordinator.reuse)
    return map
  }

  func updateUIView(_ map: MKMapView, context: Context) {
    let coordinator = context.coordinator
    coordinator.component = component
    let props = component.props
    let places = (props["places"] as? [Any] ?? []).compactMap(MapView.Place.init)
    coordinator.tint = props.color("tint").map(UIColor.init) ?? .systemRed

    let style = props.string("style")
    let realistic = props.bool("realistic") == true
    map.preferredConfiguration = Self.configuration(style, realistic: realistic)

    let showsUser = props.bool("showsUser") == true
    if showsUser, !map.showsUserLocation {
      Task { await LocationAuthorization.shared.request() }
    }
    map.showsUserLocation = showsUser

    let shown = map.annotations.compactMap { $0 as? Marker }
    if shown.map(\.place.id) != places.map(\.id) || shown.map(\.place.symbol) != places.map(\.symbol) {
      map.removeAnnotations(shown)
      map.addAnnotations(places.map(Marker.init))
      if coordinator.selected == nil {
        map.showAnnotations(map.annotations, animated: false)
      }
    }

    let selected = props.string("selectedId")
    guard selected != coordinator.selected else { return }
    coordinator.selected = selected
    let marker = map.annotations.compactMap { $0 as? Marker }.first { $0.place.id == selected }
    if let marker {
      map.selectAnnotation(marker, animated: true)
      map.setCamera(
        MKMapCamera(lookingAtCenter: marker.coordinate, fromDistance: 1_800, pitch: 55, heading: 0),
        animated: true
      )
    } else {
      map.selectedAnnotations.forEach { map.deselectAnnotation($0, animated: true) }
    }
  }

  static func configuration(_ name: String?, realistic: Bool) -> MKMapConfiguration {
    let elevation: MKMapConfiguration.ElevationStyle = realistic ? .realistic : .flat
    switch name {
    case "hybrid": return MKHybridMapConfiguration(elevationStyle: elevation)
    case "imagery": return MKImageryMapConfiguration(elevationStyle: elevation)
    default: return MKStandardMapConfiguration(elevationStyle: elevation)
    }
  }

  final class Marker: NSObject, MKAnnotation {
    let place: MapView.Place
    var coordinate: CLLocationCoordinate2D { place.coordinate }
    var title: String? { place.title }

    init(_ place: MapView.Place) { self.place = place }
  }

  final class Coordinator: NSObject, MKMapViewDelegate {
    static let reuse = "place"
    var component: NativeComponentContext
    var tint: UIColor = .systemRed
    var selected: String?

    init(component: NativeComponentContext) { self.component = component }

    func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
      guard let marker = annotation as? Marker else { return nil }
      let view = mapView.dequeueReusableAnnotationView(withIdentifier: Self.reuse, for: marker)
      if let view = view as? MKMarkerAnnotationView {
        view.markerTintColor = tint
        view.glyphImage = UIImage(systemName: marker.place.symbol)
      }
      return view
    }

    func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
      guard let marker = view.annotation as? Marker, marker.place.id != selected else { return }
      selected = marker.place.id
      MainActor.assumeIsolated {
        component.emit("select", payload: ["id": marker.place.id])
      }
    }

    func mapView(_ mapView: MKMapView, didDeselect view: MKAnnotationView) {
      guard view.annotation is Marker, mapView.selectedAnnotations.isEmpty, selected != nil else { return }
      selected = nil
      MainActor.assumeIsolated {
        component.emit("select", payload: ["id": NSNull()])
      }
    }

    func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
      let region = mapView.region
      MainActor.assumeIsolated {
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
  }
}
