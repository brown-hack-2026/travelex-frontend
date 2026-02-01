import { useCallback, useMemo } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";
import type { PlacePin } from "@/types/ui";
import {
  GOOGLE_MAPS_API_KEY,
  useGoogleMapsLoader,
} from "@/hooks/useGoogleMapsLoader";

const DEFAULT_CENTER = { lat: 41.8268, lng: -71.4025 }; // Brown University
const MAP_CONTAINER_STYLE = {
  width: "100%",
  height: "100%",
  minHeight: "320px",
};

interface MapViewProps {
  pins: PlacePin[];
  highlightIndex: number | null;
  selectedPin: PlacePin | null;
  currentPosition: { lat: number; lng: number } | null;
  onPinClick: (pin: PlacePin) => void;
}

export default function MapView({
  pins,
  highlightIndex,
  selectedPin,
  currentPosition,
  onPinClick,
}: MapViewProps) {
  const { isLoaded, loadError } = useGoogleMapsLoader();
  const hasApiKey = Boolean(GOOGLE_MAPS_API_KEY);

  const center = useMemo(() => {
    if (currentPosition) return currentPosition;
    return DEFAULT_CENTER;
  }, [currentPosition]);

  const mapOptions = useMemo(
    () => ({
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        {
          featureType: "all",
          elementType: "geometry",
          stylers: [{ color: "#242f3e" }],
        },
        {
          featureType: "all",
          elementType: "labels.text.stroke",
          stylers: [{ color: "#242f3e" }],
        },
        {
          featureType: "all",
          elementType: "labels.text.fill",
          stylers: [{ color: "#746855" }],
        },
      ],
    }),
    [],
  );

  const handleMarkerClick = useCallback(
    (pin: PlacePin) => {
      onPinClick(pin);
    },
    [onPinClick],
  );

  if (!hasApiKey) {
    return (
      <div className="h-full w-full flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-lg font-semibold">Map View</div>
          <div className="text-sm text-neutral-300">
            Google Maps API key not configured. Please set
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full w-full flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-lg font-semibold">Map View</div>
          <div className="text-sm text-neutral-300">
            Failed to load Google Maps. Please try again.
          </div>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-full w-full flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-lg font-semibold">Loading Map...</div>
        </div>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={MAP_CONTAINER_STYLE}
      mapContainerClassName="h-full w-full min-h-[320px] sm:min-h-[420px]"
      center={center}
      zoom={15}
      options={mapOptions}
    >
      {pins.map((pin, index) => {
        const isSelected = selectedPin && pin.placeId === selectedPin.placeId;
        const isHighlighted =
          highlightIndex !== null ? highlightIndex === index : false;

        let fillColor = "#10b981"; // default green
        let strokeWidth = 2;
        let size = 24;

        if (isSelected) {
          fillColor = "#fbbf24"; // yellow
          strokeWidth = 3;
          size = 32;
        } else if (isHighlighted) {
          fillColor = "#f97316"; // orange
          strokeWidth = 3;
          size = 28;
        }

        return (
          <Marker
            key={pin.placeId}
            position={{
              lat: pin.location?.lat ?? 0,
              lng: pin.location?.lon ?? 0,
            }}
            onClick={() => handleMarkerClick(pin)}
            icon={{
              url:
                "data:image/svg+xml;charset=UTF-8," +
                encodeURIComponent(`
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="${fillColor}" stroke="#ffffff" stroke-width="${strokeWidth}"/>
                    <text x="12" y="16" text-anchor="middle" fill="#ffffff" font-size="12" font-family="Arial">${pin.placeName.charAt(0)}</text>
                  </svg>
                `),
              scaledSize: new google.maps.Size(size, size),
            }}
          />
        );
      })}
      {currentPosition && (
        <Marker
          position={currentPosition}
          icon={{
            url:
              "data:image/svg+xml;charset=UTF-8," +
              encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
                </svg>
              `),
            scaledSize: new google.maps.Size(24, 24),
          }}
        />
      )}
    </GoogleMap>
  );
}
