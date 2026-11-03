import * as React from "react";
import { demoScreens, type ScreenSpec } from "../../app/nav";
import type { MapPlace, MapRegion, MapStyle } from "../../islands/definitions";
import { formatCentre } from "../../ui/capabilities";
import { Segmented, Toggle } from "../../ui/controls";
import { PlacesMap } from "../../ui/map";
import { Readout, Row, Section } from "../../ui/List";

export const PLACES: readonly MapPlace[] = [
  {
    id: "golden-gate",
    title: "Golden Gate Bridge",
    latitude: 37.8199,
    longitude: -122.4783,
    symbol: "camera.fill",
  },
  {
    id: "alcatraz",
    title: "Alcatraz Island",
    latitude: 37.827,
    longitude: -122.423,
    symbol: "building.2.fill",
  },
  {
    id: "coit-tower",
    title: "Coit Tower",
    latitude: 37.8024,
    longitude: -122.4058,
    symbol: "binoculars.fill",
  },
  {
    id: "ferry-building",
    title: "Ferry Building",
    latitude: 37.7955,
    longitude: -122.3937,
    symbol: "ferry.fill",
  },
  {
    id: "painted-ladies",
    title: "Painted Ladies",
    latitude: 37.7763,
    longitude: -122.4328,
    symbol: "house.fill",
  },
];

const STYLES: readonly { value: MapStyle; title: string }[] = [
  { value: "standard", title: "Standard" },
  { value: "hybrid", title: "Hybrid" },
  { value: "imagery", title: "Satellite" },
];

const Maps = () => {
  const [style, setStyle] = React.useState<MapStyle>("standard");
  const [realistic, setRealistic] = React.useState(true);
  const [showsUser, setShowsUser] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string>();
  const [region, setRegion] = React.useState<MapRegion>();
  const selected = PLACES.find((place) => place.id === selectedId);
  return (
    <>
      <div className="nav-gap" />
      <div className="media-card media-card--map">
        <PlacesMap
          places={PLACES}
          style={style}
          realistic={realistic}
          showsUser={showsUser}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id ?? undefined)}
          onRegionChange={setRegion}
        />
      </div>
      <p className="list-footer">
        MapKit, with its gestures, 3D terrain and Look Around data, scrolling with the page.
      </p>
      <Section header="Style">
        <div className="row">
          <Segmented
            segments={STYLES.map((entry) => entry.title)}
            selectedIndex={STYLES.findIndex((entry) => entry.value === style)}
            onChange={(index) => setStyle(STYLES[index]?.value ?? "standard")}
          />
        </div>
        <Row
          title="3D Elevation"
          accessory={<Toggle label="3D Elevation" isOn={realistic} onChange={setRealistic} />}
        />
        <Row
          title="Show My Location"
          subtitle="Asks for location the first time"
          accessory={<Toggle label="Show My Location" isOn={showsUser} onChange={setShowsUser} />}
        />
      </Section>
      <Section header="Places" footer="Pick a place, or tap its marker on the map.">
        {PLACES.map((place) => (
          <Row
            key={place.id}
            title={place.title}
            symbol={place.symbol}
            checked={place.id === selectedId}
            onPress={() => setSelectedId(place.id)}
          />
        ))}
      </Section>
      <Section header="Page sees">
        <Readout title="Selected" value={selected?.title ?? "none"} />
        <Readout title="Centre" value={region ? formatCentre(region) : "not moved yet"} />
      </Section>
    </>
  );
};

export const locationScreens: ScreenSpec[] = demoScreens("capabilities", "Location", [
  {
    id: "maps",
    keywords: ["MapKit", "location", "places", "satellite"],
    title: "Maps",
    symbol: "map.fill",
    Component: Maps,
  },
]);
