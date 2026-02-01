"use client";

import { useEffect, useRef, useState } from "react";

type TripPhoto = {
  id: string;
  url: string;
  placeName: string;
  timestamp: Date;
};

type PathPoint = {
  lat: number;
  lng: number;
};

type TripReportCardProps = {
  tripId: string;
  summaryImageUrl?: string;
  pathPoints: PathPoint[];
  photos: TripPhoto[];
  onClose?: () => void;
};

export default function TripReportCard({
  tripId,
  summaryImageUrl,
  pathPoints,
  photos,
  onClose,
}: TripReportCardProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Wait for Google Maps to load
    const checkGoogleMaps = () => {
      if (typeof google !== 'undefined' && google.maps) {
        setIsLoaded(true);
      } else {
        setTimeout(checkGoogleMaps, 100);
      }
    };
    checkGoogleMaps();
  }, []);

  useEffect(() => {
    if (!mapRef.current || map || !isLoaded) return;

    // Initialize Google Map
    const newMap = new google.maps.Map(mapRef.current, {
      center: pathPoints[0] || { lat: 0, lng: 0 },
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
    if (pathPoints.length > 0) {
      new google.maps.Polyline({
        path: pathPoints,
        geodesic: true,
        strokeColor: "#3B82F6",
        strokeOpacity: 1.0,
        strokeWeight: 4,
        map: newMap,
      });

      // Fit bounds to path
      const bounds = new google.maps.LatLngBounds();
      pathPoints.forEach((point) => bounds.extend(point));
      newMap.fitBounds(bounds);
    }

    setMap(newMap);
  }, [pathPoints, map, isLoaded]);

  return (
    <div className="fixed inset-0 bg-black z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gradient-to-b from-black to-transparent z-10 p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Your Trip Recap</h1>
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
        {/* AI Summary Image */}
        {summaryImageUrl && (
          <div className="rounded-3xl overflow-hidden">
            <img
              src={summaryImageUrl}
              alt="AI-generated trip summary"
              className="w-full aspect-square object-cover"
            />
          </div>
        )}

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
            style={{ display: isLoaded ? 'block' : 'none' }}
          />
        </div>

        {/* Photos Grid */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Places You Visited</h2>
          <div className="grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="rounded-2xl overflow-hidden bg-neutral-900 border border-white/10"
              >
                <img
                  src={photo.url}
                  alt={photo.placeName}
                  className="w-full aspect-square object-cover"
                />
                <div className="p-3">
                  <div className="text-sm font-medium">{photo.placeName}</div>
                  <div className="text-xs text-neutral-400">
                    {photo.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Share Button */}
        <button
          className="w-full rounded-full bg-white text-black font-semibold py-4 active:scale-[0.98]"
          onClick={() => {
            navigator.share?.({
              title: "My Trip Recap",
              text: `Check out my trip recap! Trip ID: ${tripId}`,
            }).catch(() => {});
          }}
        >
          Share Your Journey
        </button>
      </div>
    </div>
  );
}