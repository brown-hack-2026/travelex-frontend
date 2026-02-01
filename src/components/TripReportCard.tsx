"use client";

import { useEffect, useRef, useState } from "react";
import { TripRecord } from "@/lib/api";
import { LoadScript } from "@react-google-maps/api";
import html2canvas from "html2canvas";

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
  tripRecord: TripRecord;
  onClose?: () => void;
};

export default function TripReportCard({
  tripRecord,
  onClose,
}: TripReportCardProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const shareableRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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

    const newMap = new google.maps.Map(mapRef.current, {
      center: pathPoints[0],
      zoom: 15,
      disableDefaultUI: true,
      gestureHandling: "none",
      styles: [
        { elementType: "geometry", stylers: [{ color: "#0a0a0a" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0a" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#525252" }] },
        {
          featureType: "road",
          elementType: "geometry",
          stylers: [{ color: "#1a1a1a" }],
        },
        {
          featureType: "road",
          elementType: "geometry.stroke",
          stylers: [{ color: "#0f0f0f" }],
        },
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [{ color: "#050505" }],
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

  const generateImage = async (options?: { hideButtons?: boolean }) => {
    if (!shareableRef.current) return null;

    setIsGenerating(true);

    const shouldHideButtons = options?.hideButtons === true;
    if (shouldHideButtons && buttonsRef.current) {
      buttonsRef.current.style.display = "none";
    }

    // Wait for rendering
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const canvas = await html2canvas(shareableRef.current, {
        backgroundColor: "#000000",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        onclone: (doc) => {
          const style = doc.createElement("style");
          style.textContent = `
            [data-shareable-content], [data-shareable-content] * {
              background: #000000 !important;
              background-image: none !important;
              color: #e5e5e5 !important;
              border-color: #333333 !important;
              box-shadow: none !important;
              text-shadow: none !important;
              filter: none !important;
            }
          `;
          doc.head.appendChild(style);
        },
      });

      return canvas.toDataURL("image/png");
    } catch (error) {
      console.error("Failed to generate image:", error);
      alert(
        `Failed to generate image: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return null;
    } finally {
      if (shouldHideButtons && buttonsRef.current) {
        buttonsRef.current.style.display = "block";
      }
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    const imageDataUrl = await generateImage({ hideButtons: true });
    if (!imageDataUrl) return;

    const link = document.createElement('a');
    link.download = `trip-recap-${tripRecord.sessionId}-${Date.now()}.png`;
    link.href = imageDataUrl;
    link.click();
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/trip_record?sessionId=${tripRecord.sessionId}`;
    const imageDataUrl = await generateImage({ hideButtons: false });
    
    try {
      if (navigator.share) {
        const shareData: ShareData = {
          title: 'My Travel Recap',
          text: `Check out my adventure! ${photos.length} places visited.`,
          url: shareUrl,
        };

        if (imageDataUrl) {
          const blob = await (await fetch(imageDataUrl)).blob();
          const file = new File([blob], 'trip-recap.png', { type: 'image/png' });
          
          if (navigator.canShare?.({ files: [file] })) {
            shareData.files = [file];
          }
        }

        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  // Calculate total distance (mock - replace with actual calculation)
  const totalDistance = (pathPoints.length * 0.5).toFixed(1);

  return (
    <LoadScript
      libraries={["places", "geometry", "drawing"]}
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
    >
    <div className="fixed inset-0 bg-black z-50 overflow-y-auto font-sans">
      {/* Header */}
      <div className="sticky top-0 bg-black z-10 p-6 flex justify-between items-center border-b border-neutral-800">
        <div>
          <h1 className="text-3xl font-normal text-white tracking-tight">
            Your Travel Recap
          </h1>
          <p className="text-sm text-neutral-500 mt-1 font-light">Journey Analysis</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-full p-2 bg-neutral-900 hover:bg-neutral-800 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      <div 
        ref={shareableRef} 
        data-shareable-content
        className="px-6 pb-8 space-y-8"
        style={{ 
          background: 'linear-gradient(180deg, #000000 0%, #0f0f0f 50%, #000000 100%)'
        }}
      >
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 pt-6">
          <div 
            className="rounded-lg p-4 text-center border"
            style={{
              background: 'linear-gradient(135deg, #171717 0%, #262626 100%)',
              borderColor: '#404040',
            }}
          >
            <div className="text-3xl font-light text-white">{photos.length}</div>
            <div className="text-xs font-normal mt-1 text-neutral-400">PLACES</div>
          </div>
          <div 
            className="rounded-lg p-4 text-center border"
            style={{
              background: 'linear-gradient(135deg, #171717 0%, #262626 100%)',
              borderColor: '#404040',
            }}
          >
            <div className="text-3xl font-light text-white">{totalDistance}</div>
            <div className="text-xs font-normal mt-1 text-neutral-400">MILES</div>
          </div>
          <div 
            className="rounded-lg p-4 text-center border"
            style={{
              background: 'linear-gradient(135deg, #171717 0%, #262626 100%)',
              borderColor: '#404040',
            }}
          >
            <div className="text-3xl font-light text-white">{pathPoints.length}</div>
            <div className="text-xs font-normal mt-1 text-neutral-400">STOPS</div>
          </div>
        </div>

        {/* AI Summary Image */}
        {/* {summaryImageUrl && (
          <div 
            className="rounded-lg overflow-hidden border"
            style={{
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
              borderColor: '#262626',
            }}
          >
            <img
              src={summaryImageUrl}
              alt="AI-generated trip summary"
              className="w-full aspect-square object-cover"
            />
          </div> */}

        <div>
          <h2 className="text-xl font-normal mb-4 text-white tracking-tight">
            Journey Map
          </h2>
          <div 
            className="rounded-lg overflow-hidden border"
            style={{
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
              borderColor: '#262626',
            }}
          >
            {!isLoaded && (
              <div className="w-full h-[450px] flex items-center justify-center bg-neutral-950">
                <div className="text-neutral-600">Loading map...</div>
              </div>
            )}
            <div
              ref={mapRef}
              className="w-full h-[450px]"
              style={{ display: isLoaded ? 'block' : 'none' }}
            />
          </div>
        </div>

        {/* Photos Section */}
        <div>
          <h2 className="text-xl font-normal mb-4 text-white tracking-tight">
            Locations
          </h2>
          <div className="space-y-4">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="rounded-lg overflow-hidden border"
                style={{
                  background: 'linear-gradient(135deg, #0a0a0a 0%, #171717 100%)',
                  borderColor: '#262626',
                  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.3)',
                }}
              >
                <img
                  src={photo.url}
                  alt={photo.placeName}
                  className="w-full aspect-[16/9] object-cover"
                />
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div 
                      className="w-8 h-8 rounded flex items-center justify-center text-sm font-normal border"
                      style={{
                        background: '#171717',
                        borderColor: '#404040',
                        color: '#a3a3a3',
                      }}
                    >
                      {index + 1}
                    </div>
                    <div className="text-lg font-normal text-white">{photo.placeName}</div>
                  </div>
                  <div className="text-sm text-neutral-500 font-light">
                    {photo.timestamp.toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                </div>
              ))}
            </div>
          </div>

        {/* Action Buttons */}
        <div ref={buttonsRef} className="space-y-3 pb-4">
          <button
            className="w-full rounded py-4 text-base font-normal transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed border"
            style={{ 
              background: 'linear-gradient(135deg, #262626 0%, #404040 100%)',
              color: '#ffffff',
              borderColor: '#525252',
            }}
            onClick={handleDownload}
            disabled={isGenerating}
          >
            {isGenerating ? 'GENERATING...' : 'DOWNLOAD RECAP'}
          </button>

          <button
            className="w-full rounded py-4 text-base font-normal transition-transform active:scale-[0.98] disabled:opacity-50 border"
            style={{ 
              backgroundColor: '#0a0a0a',
              color: '#a3a3a3',
              borderColor: '#262626',
            }}
            onClick={handleShare}
            disabled={isGenerating}
          >
            SHARE JOURNEY
          </button>
        </div>
      </div>
      </div>
    </LoadScript>
  );
}
