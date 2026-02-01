"use client";

import { useEffect, useRef, useState } from "react";
import { TripRecord } from "@/lib/api";
import { LoadScript } from "@react-google-maps/api";

type TripReportCardProps = {
  tripRecord: TripRecord;
  onClose?: () => void;
};

export default function TripReportCard({
  tripRecord,
  onClose,
}: TripReportCardProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Derive data from tripRecord
  const locations = Object.values(tripRecord.locationPhotoMap).sort(
    (a, b) => a.timestamp - b.timestamp,
  );
  const pathPoints = locations.map((loc) => ({
    lat: loc.location.location.lat,
    lng: loc.location.location.lon,
  }));
  const photos = locations.flatMap((loc) =>
    loc.photos.map((photo) => ({
      id: photo.photoId,
      url: photo.url,
      placeName: loc.location.placeName,
      timestamp: new Date(photo.uploadedAt),
    })),
  );

  const tripDuration = tripRecord.endedAt - tripRecord.startedAt;
  const durationText =
    tripDuration > 60000
      ? `${Math.floor(tripDuration / 60000)}m ${Math.floor((tripDuration % 60000) / 1000)}s`
      : `${Math.floor(tripDuration / 1000)}s`;

  useEffect(() => {
    // Wait for Google Maps to load
    const checkGoogleMaps = () => {
      if (typeof google !== "undefined" && google.maps) {
        setIsLoaded(true);
      } else {
        setTimeout(checkGoogleMaps, 100);
      }
    };
    checkGoogleMaps();
  }, []);

  useEffect(() => {
    if (!mapRef.current || map || !isLoaded || pathPoints.length === 0) return;

    // Initialize Google Map
    const newMap = new google.maps.Map(mapRef.current, {
      center: pathPoints[0],
      zoom: 15,
      disableDefaultUI: true,
      gestureHandling: "none",
      styles: [
        {
          featureType: "all",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
      ],
    });

    // Draw path polyline
    new google.maps.Polyline({
      path: pathPoints,
      geodesic: true,
      strokeColor: "#3B82F6",
      strokeOpacity: 1.0,
      strokeWeight: 4,
      map: newMap,
    });

    // Add markers for each location
    locations.forEach((loc) => {
      new google.maps.Marker({
        position: {
          lat: loc.location.location.lat,
          lng: loc.location.location.lon,
        },
        map: newMap,
        title: loc.location.placeName,
      });
    });

    // Fit bounds to path
    const bounds = new google.maps.LatLngBounds();
    pathPoints.forEach((point) => bounds.extend(point));
    newMap.fitBounds(bounds);

    setMap(newMap);
  }, [pathPoints, locations, map, isLoaded]);

  return (
    <LoadScript
      libraries={["places", "geometry", "drawing"]}
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
    >
      <div className="fixed inset-0 bg-black z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-b from-black to-transparent z-10 p-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Your Trip Recap</h1>
            <p className="text-sm text-neutral-400">
              {new Date(tripRecord.startedAt).toLocaleString()} - Duration:{" "}
              {durationText}
            </p>
            <p className="text-sm text-neutral-400">User: {tripRecord.user}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-full p-2 bg-white/10 hover:bg-white/20"
            >
              ✕
            </button>
          )}
        </div>

        <div className="px-4 pb-8 space-y-6">
          {/* Map with Path */}
          <div className="rounded-3xl overflow-hidden border border-white/10">
            {!isLoaded && (
              <div className="w-full h-[400px] bg-neutral-900 flex items-center justify-center">
                <div className="text-neutral-400">Loading map...</div>
              </div>
            )}
            <div
              ref={mapRef}
              className="w-full h-[400px] bg-neutral-900"
              style={{ display: isLoaded ? "block" : "none" }}
            />
          </div>

          {/* Places Visited */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Places You Visited</h2>
            <div className="space-y-4">
              {locations.map((loc) => (
                <div
                  key={loc.location.placeId}
                  className="rounded-2xl bg-white/5 border border-white/10 p-4"
                >
                  <h3 className="text-lg font-medium mb-2">
                    {loc.location.placeName}
                  </h3>
                  <p className="text-sm text-neutral-300 mb-3">
                    {loc.location.script}
                  </p>
                  {loc.photos.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {loc.photos.map((photo) => (
                        <img
                          key={photo.photoId}
                          src={photo.url}
                          alt={loc.location.placeName}
                          className="rounded-lg w-full aspect-square object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Share Button */}
          <button
            className="w-full rounded-full bg-white text-black font-semibold py-4 active:scale-[0.98]"
            onClick={() => {
              navigator
                .share?.({
                  title: "My Trip Recap",
                  text: `Check out my trip recap! Session ID: ${tripRecord.sessionId}`,
                })
                .catch(() => {});
            }}
          >
            Share Your Journey
          </button>
        </div>
      </div>
    </LoadScript>
  );
}
