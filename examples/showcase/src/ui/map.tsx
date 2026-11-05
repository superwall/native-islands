import { MapView, type MapPlace, type MapRegion, type MapStyle } from "native-islands/components";
import { useAccent, useNativeEnabled } from "../app/preferences";
import { WebSymbol } from "./icons";

/** A MapKit map of a few places; its web version draws the same pins with the app's symbols. */
export const PlacesMap = ({
  onSelect,
  ...props
}: {
  places: readonly MapPlace[];
  style: MapStyle;
  realistic: boolean;
  showsUser: boolean;
  selectedId?: string;
  onSelect: (id: string | null) => void;
  onRegionChange: (region: MapRegion) => void;
}) => (
  <MapView
    {...props}
    tint={useAccent()}
    native={useNativeEnabled()}
    pinIcon={(place) => <WebSymbol name={place.symbol ?? "mappin"} />}
    onSelect={onSelect}
  />
);
