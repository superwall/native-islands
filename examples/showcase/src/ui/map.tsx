import { useAccent, useNativeEnabled } from "../app/preferences";
import { NativeMap, type MapPlace, type MapRegion, type MapStyle } from "../islands/definitions";
import { projectPlaces } from "./capabilities";
import { WebSymbol } from "./icons";

/**
 * A MapKit map of a few places. Its web version is a drawing with the same
 * pins, since a page has no map of its own to show.
 */
export const PlacesMap = ({
  places,
  style,
  realistic,
  showsUser,
  selectedId,
  onSelect,
  onRegionChange,
}: {
  places: readonly MapPlace[];
  style: MapStyle;
  realistic: boolean;
  showsUser: boolean;
  selectedId?: string;
  onSelect: (id: string | null) => void;
  onRegionChange: (region: MapRegion) => void;
}) => {
  const spots = projectPlaces(places);
  return (
    <NativeMap
      places={places}
      style={style}
      realistic={realistic}
      showsUser={showsUser}
      selectedId={selectedId}
      tint={useAccent()}
      native={useNativeEnabled()}
      accessibility={{ label: "Map" }}
      onSelect={({ id }) => onSelect(id)}
      onRegionChange={onRegionChange}
    >
      <div className="web-map" data-style={style}>
        {places.map((place, index) => {
          const spot = spots[index];
          if (!spot) return null;
          return (
            <button
              key={place.id}
              type="button"
              className="web-map-pin"
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
              aria-pressed={place.id === selectedId}
              onClick={() => onSelect(place.id)}
            >
              <span className="web-map-marker">
                <WebSymbol name={place.symbol ?? "mappin"} />
              </span>
              <span className="web-map-title">{place.title}</span>
            </button>
          );
        })}
      </div>
    </NativeMap>
  );
};
