"use client";

import TripReportCard from "@/components/TripReportCard";
import { LoadScript } from "@react-google-maps/api";

export default function TripRecordPage() {
  // Mock data - replace with real data from your API/database
  const mockPathPoints = [
    { lat: 41.8268, lng: -71.4025 },
    { lat: 41.827, lng: -71.402 },
    { lat: 41.8263, lng: -71.4004 },
    { lat: 41.829, lng: -71.4027 },
  ];

  const mockPhotos = [
    {
      id: "1",
      url: "/placeholder-photo.jpg",
      placeName: "University Hall",
      timestamp: new Date(),
    },
    {
      id: "2",
      url: "/placeholder-photo.jpg",
      placeName: "Sciences Library",
      timestamp: new Date(),
    },
  ];

  return (
    <LoadScript
      libraries={["places", "geometry", "drawing"]}
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
    >
      <TripReportCard
        tripId="trip-123"
        summaryImageUrl="/placeholder-summary.jpg"
        pathPoints={mockPathPoints}
        photos={mockPhotos}
      />
    </LoadScript>
  );
}
